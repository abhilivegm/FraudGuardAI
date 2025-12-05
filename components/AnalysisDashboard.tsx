
import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart, ScatterChart, Scatter, Cell, LineChart, PieChart, Pie
} from 'recharts';
import { 
  AlertTriangle, CheckCircle, Sparkles, RefreshCcw, Copy, MinusCircle, HelpCircle, 
  LayoutDashboard, Table as TableIcon, AlertOctagon, TrendingUp, BarChart2, Activity,
  Network, Grid3X3, Download, GitMerge, PieChart as PieChartIcon, Gauge, Settings, DollarSign, CalendarClock, Filter, XCircle, ChevronRight, FileBarChart, Info, Files
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AnalysisResult, Anomaly, DataRow } from '../types';
import { generateFraudReport } from '../services/geminiService';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  rawData: DataRow[];
  onReset: () => void;
  onEditConfig: () => void;
}

interface ActiveFilter {
    label: string;
    filterFn: (row: DataRow, index: number) => boolean;
}

const ChartDescription = ({ children }: { children?: React.ReactNode }) => (
  <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 leading-relaxed flex gap-3">
    <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
    <div>
        <span className="font-semibold text-slate-700 block mb-1">Forensic Insight:</span>
        {children}
    </div>
  </div>
);

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ result, rawData, onReset, onEditConfig }) => {
  const [report, setReport] = useState<string>('');
  const [loadingReport, setLoadingReport] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'advanced' | 'clusters' | 'relations' | 'details'>('overview');
  const [benfordMode, setBenfordMode] = useState<'1digit' | '2digit'>('1digit');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);

  // Stats Calculations for Tooltips
  const exactDupes = result.anomalies.filter(a => a.type === 'Duplicate Record').length;
  const idDupes = result.anomalies.filter(a => a.type === 'Duplicate Invoice ID').length;

  useEffect(() => {
    const fetchReport = async () => {
      setLoadingReport(true);
      const text = await generateFraudReport(result);
      setReport(text);
      setLoadingReport(false);
    };
    fetchReport();
  }, [result]);

  // Memoize drill-down data based on active filter
  const drillDownData = useMemo(() => {
      if (!activeFilter) return [];
      return rawData.map((row, idx) => ({ ...row, __index: idx + 1 })).filter((row, idx) => activeFilter.filterFn(row, idx));
  }, [rawData, activeFilter]);

  const exportData = (dataToExport: any[], filename: string) => {
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, filename);
  };

  const handleExportAnomalies = () => {
    const anomalyRows = result.anomalies.map(a => ({
          Row_Index: a.rowIndex,
          Issue_Type: a.type,
          Column_Flagged: a.column,
          Suspicious_Value: a.value,
          ...a.data
      }));
      exportData(anomalyRows, "FraudGuard_Anomalies.xlsx");
  };

  const handleExportDrillDown = () => {
      exportData(drillDownData, `FraudGuard_DrillDown_${activeFilter?.label.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  };

  const handleExportPowerBI = () => {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary KPI
      const summaryData = [
          { Metric: 'Overall Risk Score', Value: result.riskScore },
          { Metric: 'Risk Level', Value: result.riskLevel },
          { Metric: 'Duplicate Count', Value: result.stats.duplicateCount },
          { Metric: 'Outlier Count', Value: result.stats.outlierCount },
          { Metric: 'Benford MAD (1-Digit)', Value: result.mad },
          { Metric: 'Benford Conformity', Value: result.conformity }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "KPI Summary");

      // Sheet 2: All Anomalies (Flat table for filtering)
      const anomalyRows = result.anomalies.map(a => ({
          RowIndex: a.rowIndex,
          IssueType: a.type,
          ColumnFlagged: a.column,
          SuspiciousValue: a.value,
          ...a.data // Flatten raw data for PowerBI context
      }));
      const wsAnomalies = XLSX.utils.json_to_sheet(anomalyRows);
      XLSX.utils.book_append_sheet(wb, wsAnomalies, "Anomalies List");

      // Sheet 3: Raw Data (For main visualizations)
      const wsRaw = XLSX.utils.json_to_sheet(rawData);
      XLSX.utils.book_append_sheet(wb, wsRaw, "Raw Dataset");

      // Sheet 4: Benford Distribution Data
      const benfordRows = result.chartData.map(d => ({
          Digit: d.digit,
          ActualFrequency: d.actual,
          ExpectedFrequency: d.expected,
          Count: d.count,
          Type: '1-Digit'
      })).concat(
          result.chartData2Digit.map(d => ({
            Digit: d.digit,
            ActualFrequency: d.actual,
            ExpectedFrequency: d.expected,
            Count: d.count,
            Type: '2-Digit'
          }))
      );
      const wsBenford = XLSX.utils.json_to_sheet(benfordRows);
      XLSX.utils.book_append_sheet(wb, wsBenford, "Benford Stats");

      // Sheet 5: Entity Stats (If available)
      if (result.entityData.length > 0) {
          const wsEntities = XLSX.utils.json_to_sheet(result.entityData);
          XLSX.utils.book_append_sheet(wb, wsEntities, "Entity Risk Stats");
      }

      // Sheet 6: Time Series (If available)
      if (result.timeSeriesData.length > 0) {
           const wsTimeSeries = XLSX.utils.json_to_sheet(result.timeSeriesData);
           XLSX.utils.book_append_sheet(wb, wsTimeSeries, "Time Series Aggregation");
      }

      XLSX.writeFile(wb, "FraudGuard_PowerBI_Dataset.xlsx");
  };

  const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const getStatusColor = (conformity: string) => {
    switch (conformity) {
      case 'Close': return 'text-green-600 bg-green-50 border-green-200';
      case 'Acceptable': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Marginally Acceptable': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Nonconformity': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getRiskColor = (level: string) => {
      switch(level) {
          case 'Critical': return 'text-red-700 bg-red-100 border-red-300';
          case 'High': return 'text-orange-700 bg-orange-100 border-orange-300';
          case 'Medium': return 'text-yellow-700 bg-yellow-100 border-yellow-300';
          default: return 'text-green-700 bg-green-100 border-green-300';
      }
  };

  // --- Interaction Handlers ---

  const handleBenfordClick = (data: any) => {
    if (!data) return;
    const digit = String(data.digit);
    setActiveFilter({
        label: `Leading Digit: ${digit} (${benfordMode})`,
        filterFn: (row) => {
            // Determine which value we are checking (Invoice ID or Amount)
            const val = result.invoiceColumnName ? row[result.invoiceColumnName] : row[result.columnName];
            if (val === null || val === undefined) return false;
            
            // Clean the value to find leading digits
            const str = String(val).replace(/[^0-9]/g, '').replace(/^0+/, '');
            
            return str.startsWith(digit);
        }
    });
  };

  const handleHistogramClick = (data: any) => {
      if (!data) return;
      setActiveFilter({
          label: `Amount Range: ${data.label}`,
          filterFn: (row) => {
              const val = typeof row[result.columnName] === 'string' 
                ? parseFloat(String(row[result.columnName]).replace(/,/g, '')) 
                : Number(row[result.columnName]);
              return !isNaN(val) && val >= data.rangeStart && val < data.rangeEnd;
          }
      });
  };

  const handleParetoClick = (data: any) => {
      if (!data || !result.categoryColumnName) return;
      setActiveFilter({
          label: `Entity: ${data.name}`,
          filterFn: (row) => String(row[result.categoryColumnName!]) === data.name
      });
  };

  const handleScatterClick = (data: any) => {
      if (!data) return;
      setActiveFilter({
          label: `Row #${data.id} (Outlier)`,
          filterFn: (_, idx) => idx + 1 === data.id
      });
  };

  const handleEntityScatterClick = (data: any) => {
      if (!data || !result.categoryColumnName) return;
      setActiveFilter({
          label: `Entity: ${data.id}`,
          filterFn: (row) => String(row[result.categoryColumnName!]) === data.id
      });
  };

  const handleHeatmapClick = (data: any) => {
      if (!data || !result.dateColumnName) return;
      
      const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(data.day);
      
      setActiveFilter({
          label: `Time: ${data.day} @ ${data.hour}:00`,
          filterFn: (row) => {
              const val = row[result.dateColumnName!];
              if (val === null || val === undefined) return false;
              
              let dateObj: Date | null = null;
              if (typeof val === 'number') {
                   // Excel serial date
                   dateObj = new Date(Math.round((val - 25569)*86400*1000));
              } else if (typeof val === 'string') {
                  dateObj = new Date(val);
              }
              
              if (dateObj && !isNaN(dateObj.getTime())) {
                  return dateObj.getDay() === dayIndex && dateObj.getHours() === data.hour;
              }
              return false;
          }
      });
  };

  const handleDuplicateClick = () => {
      setActiveFilter({
          label: 'Duplicate Rows (Exact or ID)',
          filterFn: (_, idx) => {
              const rowIndex = idx + 1;
              return result.anomalies.some(a => a.rowIndex === rowIndex && (a.type === 'Duplicate Record' || a.type === 'Duplicate Invoice ID'));
          }
      });
  };

  const handleUniqueClick = () => {
      setActiveFilter({
          label: 'Unique Rows',
          filterFn: (_, idx) => {
              const rowIndex = idx + 1;
              return !result.anomalies.some(a => a.rowIndex === rowIndex && (a.type === 'Duplicate Record' || a.type === 'Duplicate Invoice ID'));
          }
      });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap
            ${activeTab === 'overview' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <LayoutDashboard size={16} />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap
            ${activeTab === 'advanced' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <Activity size={16} />
          Trends
        </button>
        <button
          onClick={() => setActiveTab('clusters')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap
            ${activeTab === 'clusters' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <Network size={16} />
          Clusters
        </button>
        <button
          onClick={() => setActiveTab('relations')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap
            ${activeTab === 'relations' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <GitMerge size={16} />
          Flows & Pareto
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap
            ${activeTab === 'details' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <TableIcon size={16} />
          Anomaly List
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Risk Banner */}
          <div className={`p-6 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-6 ${getRiskColor(result.riskLevel)}`}>
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-white bg-opacity-40 rounded-full">
                      <Gauge size={32} />
                  </div>
                  <div>
                      <h2 className="text-xl font-bold">Risk Level: {result.riskLevel}</h2>
                      <p className="opacity-80 text-sm">Overall Fraud Risk Score calculated from outliers, Benford deviance, and duplicates.</p>
                  </div>
              </div>
              <div className="text-4xl font-black">{result.riskScore}/100</div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <StatsCard 
              title="Detected Loss" 
              value={formatCurrency(result.stats.totalAtRisk)} 
              icon={<DollarSign size={18} className="text-red-500" />}
              color="red"
              colSpan="lg:col-span-2"
              tooltipContent={
                  <div className="space-y-1">
                      <div className="flex justify-between gap-4"><span>Outliers:</span> <span className="font-mono">{formatCurrency(result.stats.riskBreakdown.outliers)}</span></div>
                      <div className="flex justify-between gap-4"><span>Duplicates:</span> <span className="font-mono">{formatCurrency(result.stats.riskBreakdown.duplicates)}</span></div>
                      <div className="flex justify-between gap-4"><span>Negatives:</span> <span className="font-mono">{formatCurrency(result.stats.riskBreakdown.negatives)}</span></div>
                      <div className="border-t border-slate-600 pt-1 mt-1 text-right font-bold">= {formatCurrency(result.stats.totalAtRisk)}</div>
                  </div>
              }
            />
            <StatsCard 
              title="Forecast (1 Yr)" 
              value={formatCurrency(result.stats.forecastLoss)} 
              icon={<CalendarClock size={18} className="text-purple-500" />}
              color="purple"
              colSpan="lg:col-span-2"
              tooltipContent={
                  <div className="space-y-1">
                      <p className="font-semibold border-b border-slate-600 pb-1 mb-1">Projection Model</p>
                      <p>{result.timeSeriesData.length > 1 ? "Annualized based on actual date range." : "Standard monthly multiplier (x12)."}</p>
                      {result.timeSeriesData.length > 1 && (
                           <p className="text-slate-400 mt-1">Date Range: <br/> {new Date(result.timeSeriesData[0].date).toLocaleDateString()} - {new Date(result.timeSeriesData[result.timeSeriesData.length-1].date).toLocaleDateString()}</p>
                      )}
                  </div>
              }
            />
            <StatsCard 
              title="Duplicates" 
              value={result.stats.duplicateCount} 
              icon={<Copy size={18} className="text-orange-500" />}
              color="orange"
              tooltipContent={
                  <div className="space-y-1">
                      <div className="flex justify-between gap-4"><span>Exact Rows:</span> <span className="font-mono">{exactDupes}</span></div>
                      <div className="flex justify-between gap-4"><span>Duplicate IDs:</span> <span className="font-mono">{idDupes}</span></div>
                      <p className="text-slate-400 text-[10px] mt-1 pt-1 border-t border-slate-600">Total records appearing more than once.</p>
                  </div>
              }
            />
            <StatsCard 
              title="Negatives" 
              value={result.stats.negativeCount} 
              icon={<MinusCircle size={18} className="text-red-500" />}
              color="red"
              tooltipContent={
                  <div className="space-y-1">
                      <div className="flex justify-between gap-4"><span>Total Value:</span> <span className="font-mono">{formatCurrency(result.stats.riskBreakdown.negatives)}</span></div>
                      <p className="text-slate-400 text-[10px] mt-1 pt-1 border-t border-slate-600">Transactions with value less than 0.</p>
                  </div>
              }
            />
             <StatsCard 
              title="Outliers" 
              value={result.stats.outlierCount} 
              icon={<AlertTriangle size={18} className="text-purple-500" />}
              color="purple"
              tooltipContent={
                  <div className="space-y-1">
                      <div className="flex justify-between gap-4"><span>Total Value:</span> <span className="font-mono">{formatCurrency(result.stats.riskBreakdown.outliers)}</span></div>
                      <p className="text-slate-400 text-[10px] mt-1 pt-1 border-t border-slate-600">Values outside statistical norms (IQR).</p>
                  </div>
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Benford's Law Distribution</h3>
                    <p className="text-xs text-slate-400 mt-1">
                        Target: <span className="font-semibold text-slate-600">{result.invoiceColumnName || result.columnName}</span>
                    </p>
                    <p className="text-[10px] text-blue-500 mt-1 flex items-center gap-1 cursor-pointer hover:underline">
                        <Filter size={10} /> Click a bar to filter transactions
                    </p>
                  </div>
                  <div className="flex gap-2">
                       <div className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border ${getStatusColor(result.conformity)}`}>
                        {result.conformity}
                      </div>
                      <div className="flex bg-slate-100 rounded-lg p-1 text-xs font-medium">
                          <button 
                            onClick={() => setBenfordMode('1digit')}
                            className={`px-3 py-1.5 rounded-md transition-all ${benfordMode === '1digit' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              1st Digit
                          </button>
                          <button 
                            onClick={() => setBenfordMode('2digit')}
                            className={`px-3 py-1.5 rounded-md transition-all ${benfordMode === '2digit' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              2-Digit
                          </button>
                      </div>
                  </div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={benfordMode === '1digit' ? result.chartData : result.chartData2Digit}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                        dataKey="digit" 
                        label={{ value: benfordMode === '1digit' ? 'Leading Digit (1-9)' : 'Leading Digits (10-99)', position: 'insideBottom', offset: -10 }} 
                        interval={benfordMode === '2digit' ? 9 : 0}
                        fontSize={10}
                    />
                    <YAxis label={{ value: 'Frequency (%)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Bar 
                        name="Actual" 
                        dataKey="actual" 
                        fill="#3b82f6" 
                        radius={[4, 4, 0, 0]} 
                        barSize={benfordMode === '2digit' ? 6 : 40} 
                        onClick={(data) => handleBenfordClick(data)}
                        cursor="pointer"
                    />
                    <Line name="Expected" type="monotone" dataKey="expected" stroke="#ef4444" strokeWidth={2} dot={benfordMode === '1digit' ? { r: 4 } : false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <ChartDescription>
                  <strong>Why it matters:</strong> Benford's Law (the "First-Digit Law") states that in natural datasets, the digit '1' appears about 30% of the time, while '9' appears less than 5%. 
                  <br />
                  <strong>What to look for:</strong> Bars (Blue) that significantly exceed the expected curve (Red), especially for digits 7, 8, or 9, often indicate invented or manipulated numbers.
              </ChartDescription>
            </div>

            {/* AI Report Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="text-purple-600" size={20} />
                  AI Forensic Report
                </h3>
                {loadingReport && (
                  <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded animate-pulse">
                    Generating...
                  </span>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[400px]">
                {loadingReport ? (
                  <div className="space-y-4 animate-pulse p-2">
                    <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-100 rounded w-full"></div>
                    <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                    <div className="h-32 bg-slate-100 rounded w-full"></div>
                  </div>
                ) : (
                  <div className="prose prose-sm prose-slate max-w-none">
                    <ReactMarkdown children={report} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced (Distribution) Tab */}
      {activeTab === 'advanced' && (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Outlier Detection (Scatter Plot) - Index based */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle size={20} className="text-red-500" />
                            Statistical Outliers (IQR)
                        </h3>
                         <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1 cursor-pointer">
                             <Filter size={10} /> Click point to view
                        </span>
                    </div>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart 
                                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" dataKey="id" name="Row Index" label={{ value: 'Row Number', position: 'insideBottom', offset: -10 }} />
                                <YAxis type="number" dataKey="amount" name="Amount" label={{ value: 'Amount', angle: -90, position: 'insideLeft' }} />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                <Legend verticalAlign="top" height={36}/>
                                <Scatter 
                                    name="Transactions" 
                                    data={result.scatterData} 
                                    fill="#8884d8"
                                    onClick={(data) => handleScatterClick(data)}
                                    cursor="pointer"
                                >
                                    {result.scatterData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.isOutlier ? '#ef4444' : '#3b82f6'} />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                    <ChartDescription>
                        <strong>Visualizes anomalies:</strong> Red points represent transactions that fall outside the Interquartile Range (IQR). <br/>
                        <strong>Audit Risk:</strong> These extremes are statistically rare. High outliers may be inflated invoices or theft; low outliers might be "test" transactions or under-reporting.
                    </ChartDescription>
                </div>

                {/* Histogram */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <BarChart2 size={20} className="text-indigo-500" />
                            Frequency Distribution
                        </h3>
                         <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1 cursor-pointer">
                             <Filter size={10} /> Click bar to filter
                        </span>
                    </div>
                     <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={result.histogramData}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="label" fontSize={10} angle={-45} textAnchor="end" height={60} />
                                <YAxis />
                                <Tooltip />
                                <Bar 
                                    dataKey="count" 
                                    fill="#6366f1" 
                                    radius={[4, 4, 0, 0]} 
                                    activeBar={{ fill: '#4338ca' }} 
                                    onClick={(data) => handleHistogramClick(data)}
                                    cursor="pointer"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <ChartDescription>
                        <strong>Distribution analysis:</strong> Shows how many transactions fall into specific amount ranges. <br/>
                        <strong>Audit Risk:</strong> Look for unexpected spikes in specific bins (e.g., many invoices just below an approval limit) or gaps where data should exist.
                    </ChartDescription>
                </div>
              </div>

              {/* Time Series */}
              {result.timeSeriesData.length > 0 ? (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp size={20} className="text-green-500" />
                            Time Series Analysis
                        </h3>
                    </div>
                     <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={result.timeSeriesData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" minTickGap={30} fontSize={12} />
                                <YAxis />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Total Amount" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <ChartDescription>
                        <strong>Trend analysis:</strong> Plots total transaction value over time. <br/>
                        <strong>Audit Risk:</strong> Identifies sudden spikes in spending, seasonality anomalies, or gaps in record-keeping that don't match business operations.
                    </ChartDescription>
                  </div>
              ) : null}
          </div>
      )}

      {/* Clusters Tab */}
      {activeTab === 'clusters' && (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Cluster Scatter */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Network size={20} className="text-pink-500" />
                            Entity Clustering
                        </h3>
                         {result.categoryColumnName ? (
                             <span className="text-xs bg-pink-50 text-pink-700 px-2 py-1 rounded border border-pink-100">
                                 {result.categoryColumnName}
                             </span>
                         ) : null}
                    </div>
                    {result.entityData.length > 0 ? (
                        <>
                         <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart 
                                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" dataKey="count" name="Frequency" label={{ value: 'Freq', position: 'insideBottom', offset: -10 }} />
                                    <YAxis type="number" dataKey="totalAmount" name="Total Amount" label={{ value: 'Total Amount', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                    <Scatter 
                                        name="Entities" 
                                        data={result.entityData} 
                                        fill="#8884d8" 
                                        onClick={(data) => handleEntityScatterClick(data)}
                                        cursor="pointer"
                                    >
                                        {result.entityData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.isOutlier ? '#ec4899' : '#8b5cf6'} />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                        <ChartDescription>
                            <strong>Clusters by behavior:</strong> Plots Frequency (X) vs Total Amount (Y). <br/>
                            <strong>Audit Risk:</strong> 
                            <ul className="list-disc pl-4 mt-1 space-y-1">
                                <li>High Freq / Low Amount (Bottom Right): Potential "Salami Slicing" fraud.</li>
                                <li>Low Freq / High Amount (Top Left): "One-off Hit" risk.</li>
                                <li>Pink Dots: Entities behaving significantly differently from the average.</li>
                            </ul>
                        </ChartDescription>
                        </>
                    ) : <EmptyState msg="Select Category Column to see Clusters" />}
                </div>

                {/* Heatmap */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Grid3X3 size={20} className="text-orange-500" />
                            Activity Heatmap
                        </h3>
                         <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1 cursor-pointer">
                             <Filter size={10} /> Click cell to filter
                        </span>
                    </div>
                     {result.heatmapData.length > 0 ? (
                        <>
                        <div className="h-[350px] overflow-auto custom-scrollbar">
                           <div className="min-w-[400px]">
                               <div className="grid grid-cols-[auto_repeat(24,1fr)] gap-1 text-xs">
                                   <div className="h-6"></div>
                                   {Array.from({length: 24}).map((_, i) => (
                                       <div key={i} className="flex items-center justify-center text-slate-400 text-[10px]">{i}</div>
                                   ))}
                                   {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                       <React.Fragment key={day}>
                                            <div className="font-medium text-slate-500 pr-2 flex items-center justify-end h-8 text-[10px]">{day}</div>
                                            {Array.from({length: 24}).map((_, hour) => {
                                                const cell = result.heatmapData.find(d => d.day === day && d.hour === hour);
                                                const intensity = cell ? cell.intensity : 0;
                                                const bgColor = intensity === 0 ? 'bg-slate-50' :
                                                                intensity < 0.2 ? 'bg-orange-100' :
                                                                intensity < 0.4 ? 'bg-orange-200' :
                                                                intensity < 0.6 ? 'bg-orange-300' :
                                                                intensity < 0.8 ? 'bg-orange-400' : 'bg-orange-600';
                                                
                                                return (
                                                    <div 
                                                        key={hour} 
                                                        className={`h-8 w-full rounded-sm ${bgColor} relative group cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all`}
                                                        onClick={() => cell && handleHeatmapClick(cell)}
                                                        title={cell ? `${cell.day} ${cell.hour}:00 - ${cell.count} records` : ''}
                                                    >
                                                        {cell && (
                                                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded z-10 whitespace-nowrap">
                                                                 {cell.day} {cell.hour}:00 ({cell.count})
                                                             </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                       </React.Fragment>
                                   ))}
                               </div>
                           </div>
                        </div>
                        <ChartDescription>
                            <strong>Temporal analysis:</strong> Darker squares indicate higher transaction volume during that specific hour/day. <br/>
                            <strong>Audit Risk:</strong> Watch for activity during weekends or late nights (e.g., 2 AM) which typically indicates automated bots, hacking, or employee fraud outside supervision.
                        </ChartDescription>
                        </>
                     ) : <EmptyState msg="Select Date Column to see Heatmap" />}
                </div>
              </div>
          </div>
      )}

      {/* Flows & Relations Tab */}
      {activeTab === 'relations' && (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Pareto Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <PieChartIcon size={20} className="text-teal-500" />
                            Pareto Analysis (80/20 Rule)
                        </h3>
                         <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1 cursor-pointer">
                             <Filter size={10} /> Click bar to filter
                        </span>
                    </div>
                    {result.paretoData.length > 0 ? (
                        <>
                        <div className="h-[400px]">
                             <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart 
                                    data={result.paretoData}
                                >
                                    <CartesianGrid stroke="#f5f5f5" />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} fontSize={10}/>
                                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" unit="%" domain={[0, 100]} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar 
                                        yAxisId="left" 
                                        dataKey="value" 
                                        name="Amount" 
                                        fill="#8884d8" 
                                        barSize={20} 
                                        activeBar={{ fill: '#6366f1' }}
                                        onClick={(data) => handleParetoClick(data)}
                                        cursor="pointer"
                                    />
                                    <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="Cumulative %" stroke="#82ca9d" strokeWidth={2}/>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <ChartDescription>
                            <strong>80/20 Rule:</strong> Shows which entities (vendors/employees) consume the most funds. <br/>
                            <strong>Audit Risk:</strong> If a very small number of vendors accounts for >80% of spend (steep curve), it indicates a concentration risk. Investigate the top vendors thoroughly.
                        </ChartDescription>
                        </>
                    ) : <EmptyState msg="Select Category Column for Pareto" />}
                </div>

                {/* Network / Sankey Visual (Bipartite Graph) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <GitMerge size={20} className="text-indigo-500" />
                            Flow & Collusion Network
                        </h3>
                         <span className="text-xs text-slate-400">Top 50 Links</span>
                    </div>
                    {result.graphData.links.length > 0 ? (
                        <>
                        <div className="h-[400px] overflow-hidden relative border border-slate-100 rounded-lg bg-slate-50">
                             <SankeyGraph nodes={result.graphData.nodes} links={result.graphData.links} />
                        </div>
                        <ChartDescription>
                            <strong>Relationship Mapping:</strong> Visualizes money flow from Source (Left) to Target (Right). <br/>
                            <strong>Audit Risk:</strong> 
                            <ul className="list-disc pl-4 mt-1 space-y-1">
                                <li>Spider Webs: One employee approving payments to many distinct vendors.</li>
                                <li>Thick Lines: Excessive or unusually high payments between specific pairs (Collusion Risk).</li>
                            </ul>
                        </ChartDescription>
                        </>
                    ) : <EmptyState msg="Select both Source & Category Columns" />}
                </div>

                {/* Duplicate Visualization */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Copy size={20} className="text-orange-500" />
                            Uniqueness vs Duplication
                        </h3>
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1 cursor-pointer">
                             <Filter size={10} /> Click bar to filter
                        </span>
                    </div>
                    <div className="h-[200px] flex items-center justify-center">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={[{ name: 'Dataset', unique: result.totalRows - result.stats.duplicateCount, duplicate: result.stats.duplicateCount }]}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={80} />
                                <Tooltip />
                                <Legend />
                                <Bar 
                                    dataKey="unique" 
                                    stackId="a" 
                                    fill="#10b981" 
                                    name="Unique Rows" 
                                    radius={[0, 4, 4, 0]} 
                                    cursor="pointer"
                                    onClick={() => handleUniqueClick()}
                                />
                                <Bar 
                                    dataKey="duplicate" 
                                    stackId="a" 
                                    fill="#f97316" 
                                    name="Duplicate Rows" 
                                    radius={[0, 4, 4, 0]} 
                                    cursor="pointer"
                                    onClick={() => handleDuplicateClick()}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <ChartDescription>
                        <strong>Data Integrity:</strong> Highlights the volume of exact duplicate rows. <br/>
                        <strong>Audit Risk:</strong> High duplication indicates double-billing errors, system integration failures, or potential fraud (submitting the same invoice twice).
                    </ChartDescription>
                 </div>

              </div>
          </div>
      )}

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Detected Anomalies</h3>
              <p className="text-sm text-slate-500">List of rows containing duplicates, negatives, or missing data.</p>
            </div>
            <div className="flex gap-4 items-center">
                <div className="text-sm text-slate-500">
                Total Anomalies: <span className="font-semibold text-slate-800">{result.anomalies.length}</span>
                </div>
                <button 
                    onClick={handleExportAnomalies}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                >
                    <Download size={16} />
                    Export Report
                </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 w-24">Line #</th>
                  <th className="px-6 py-4 w-48">Issue Type</th>
                  <th className="px-6 py-4 w-48">Column Value</th>
                  <th className="px-6 py-4">Context (Row Data)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.anomalies.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      No anomalies detected in this dataset. Good job!
                    </td>
                  </tr>
                ) : (
                  result.anomalies.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-500">{item.rowIndex}</td>
                      <td className="px-6 py-4">
                        <AnomalyBadge type={item.type} />
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {item.value === null ? 'NULL' : String(item.value)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        {JSON.stringify(item.data).slice(0, 80)}...
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drill-Down Slide-Over Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-2/3 lg:w-1/2 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-[9999] flex flex-col h-screen ${
            activeFilter ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {activeFilter && (
            <>
                <div className="p-4 bg-blue-600 text-white flex items-center justify-between shadow-md z-10 shrink-0">
                    <div>
                        <h4 className="font-bold flex items-center gap-2">
                            <Filter size={18} />
                            Forensic Drill-Down
                        </h4>
                        <p className="text-xs text-blue-100 opacity-90 mt-1">
                            Filtering by: <span className="font-semibold">{activeFilter.label}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                         <button 
                            onClick={handleExportDrillDown}
                            className="text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded transition-colors"
                        >
                            Export
                        </button>
                        <button 
                            onClick={() => setActiveFilter(null)}
                            className="p-1 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <XCircle size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
                     <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Ln</th>
                                        {Object.keys(drillDownData[0] || {}).filter(k => k !== '__index').slice(0, 8).map(header => (
                                            <th key={header} className="px-4 py-3 font-semibold text-xs uppercase tracking-wider truncate max-w-[200px]">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {drillDownData.slice(0, 200).map((row: any, i) => (
                                        <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-slate-400 border-r border-slate-100">{row.__index}</td>
                                            {Object.entries(row).filter(([k]) => k !== '__index').slice(0, 8).map(([_, val], j) => (
                                                <td key={j} className="px-4 py-3 text-slate-700 truncate max-w-[250px]">
                                                    {String(val)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {drillDownData.length === 0 && (
                            <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                                <Filter size={48} className="mb-4 opacity-20" />
                                <p>No records found matching this filter.</p>
                            </div>
                        )}
                        {drillDownData.length > 200 && (
                            <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                                Showing first 200 of {drillDownData.length} matches. Export to see full dataset.
                            </div>
                        )}
                     </div>
                </div>
            </>
        )}
      </div>
      
      {/* Backdrop for Slide-Over */}
      {activeFilter && (
          <div 
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[9998] transition-opacity"
            onClick={() => setActiveFilter(null)}
          ></div>
      )}

      {/* Action Bar */}
      <div className="flex justify-between items-center pt-6 border-t border-slate-200">
        <button 
          onClick={handleExportPowerBI}
          className="flex items-center gap-2 px-6 py-2 text-yellow-700 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 font-medium rounded-lg transition-colors"
        >
          <FileBarChart size={18} />
          Export for Power BI
        </button>
        <div className="flex gap-4">
            <button 
              onClick={onEditConfig}
              className="flex items-center gap-2 px-6 py-2 text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 font-medium rounded-lg transition-colors"
            >
              <Settings size={18} />
              Configure Columns
            </button>
            <button 
              onClick={onReset}
              className="flex items-center gap-2 px-6 py-2 text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 font-medium rounded-lg transition-colors"
            >
              <RefreshCcw size={18} />
              Analyze Another File
            </button>
        </div>
      </div>
    </div>
  );
};

// Simple custom component for Bipartite/Sankey-like graph using SVG
const SankeyGraph = ({ nodes, links }: { nodes: any[], links: any[] }) => {
    // Separate sources and targets
    const sources = nodes.filter(n => n.type === 'source');
    const targets = nodes.filter(n => n.type === 'target');
    
    // Calculate layout
    const height = 380; // container height - padding
    const width = 600; // arbitrary svg width
    const padding = 20;
    
    // Scale helper
    const maxVal = Math.max(...nodes.map(n => n.value));
    const getNodeHeight = (val: number) => Math.max(5, (val / maxVal) * (height / sources.length)); 

    // Position Sources (Left)
    let currentY = padding;
    const sourcePos = new Map();
    sources.forEach(n => {
        const h = 20; // Fixed height for dots for now, or dynamic
        sourcePos.set(n.id, { x: 50, y: currentY + (height / sources.length)/2 });
        currentY += height / sources.length;
    });

    // Position Targets (Right)
    currentY = padding;
    const targetPos = new Map();
    targets.forEach(n => {
        targetPos.set(n.id, { x: width - 50, y: currentY + (height / targets.length)/2 });
        currentY += height / targets.length;
    });

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} 400`} preserveAspectRatio="none">
             {/* Links */}
            {links.map((l, i) => {
                const s = sourcePos.get(l.source);
                const t = targetPos.get(l.target);
                if (!s || !t) return null;
                
                // Thickness based on value
                const strokeWidth = Math.max(1, (l.value / maxVal) * 20);
                
                return (
                    <path
                        key={i}
                        d={`M ${s.x} ${s.y} C ${s.x + 100} ${s.y}, ${t.x - 100} ${t.y}, ${t.x} ${t.y}`}
                        fill="none"
                        stroke="#94a3b8"
                        strokeOpacity="0.3"
                        strokeWidth={strokeWidth}
                        className="hover:stroke-blue-500 hover:stroke-opacity-80 transition-all"
                    >
                         <title>{`${l.source} -> ${l.target}: ${l.value}`}</title>
                    </path>
                );
            })}

            {/* Source Nodes */}
            {sources.map((n, i) => {
                const pos = sourcePos.get(n.id);
                return (
                    <g key={i}>
                        <circle cx={pos.x} cy={pos.y} r={6} fill="#ec4899" />
                        <text x={pos.x - 10} y={pos.y} dy="4" textAnchor="end" fontSize="10" fill="#475569">{n.id}</text>
                    </g>
                );
            })}

            {/* Target Nodes */}
            {targets.map((n, i) => {
                const pos = targetPos.get(n.id);
                return (
                    <g key={i}>
                        <circle cx={pos.x} cy={pos.y} r={6} fill="#0ea5e9" />
                        <text x={pos.x + 10} y={pos.y} dy="4" textAnchor="start" fontSize="10" fill="#475569">{n.id}</text>
                    </g>
                );
            })}
        </svg>
    );
};

const EmptyState = ({ msg }: { msg: string }) => (
    <div className="h-[350px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
        <Activity size={32} className="mb-2 opacity-50" />
        <p>{msg}</p>
    </div>
);

const StatsCard = ({ title, value, icon, color, colSpan, tooltipContent }: { title: string, value: string | number, icon: React.ReactNode, color: string, colSpan?: string, tooltipContent?: React.ReactNode }) => {
  const isZero = value === 0 || value === '$0';
  return (
    <div className={`p-4 lg:p-6 rounded-xl shadow-sm border flex flex-col justify-center relative group cursor-default ${colSpan} ${isZero ? 'bg-white border-slate-100' : `bg-${color}-50 border-${color}-100`}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs lg:text-sm font-medium text-slate-500 truncate flex items-center gap-1">
            {title}
            {tooltipContent && <Info size={12} className="text-slate-400" />}
        </span>
      </div>
      <p className={`text-xl lg:text-2xl font-bold ${isZero ? 'text-slate-700' : `text-${color}-700`}`}>
        {value}
      </p>
      
      {/* Tooltip Hover */}
      {tooltipContent && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {tooltipContent}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
          </div>
      )}
    </div>
  );
};

const AnomalyBadge = ({ type }: { type: Anomaly['type'] }) => {
  switch (type) {
    case 'Duplicate Record':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
          <Copy size={12} /> Duplicate Row
        </span>
      );
    case 'Duplicate Invoice ID':
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <Files size={12} /> Duplicate ID
            </span>
        );
    case 'Negative Amount':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
          <MinusCircle size={12} /> Negative
        </span>
      );
    case 'Missing Value':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <HelpCircle size={12} /> Missing
        </span>
      );
    case 'Statistical Outlier':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
          <AlertTriangle size={12} /> Outlier
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">
          <AlertOctagon size={12} /> Other
        </span>
      );
  }
};

export default AnalysisDashboard;
