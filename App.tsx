
import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import FileUpload from './components/FileUpload';
import ColumnSelector from './components/ColumnSelector';
import AnalysisDashboard from './components/AnalysisDashboard';
import { DataRow, AnalysisResult, AppState, AnalysisConfig } from './types';
import { getNumericColumns, getDateColumns, getCategoryColumns, getIdColumns, performAnalysis, detectBestColumns } from './services/analysisService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [data, setData] = useState<DataRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [numericColumns, setNumericColumns] = useState<string[]>([]);
  const [dateColumns, setDateColumns] = useState<string[]>([]);
  const [categoryColumns, setCategoryColumns] = useState<string[]>([]);
  const [idColumns, setIdColumns] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeConfig, setActiveConfig] = useState<AnalysisConfig | null>(null);

  const handleDataLoaded = (loadedData: DataRow[], name: string) => {
    setData(loadedData);
    setFileName(name);
    
    // Extract available column types for manual selection if needed
    const numCols = getNumericColumns(loadedData);
    const dtCols = getDateColumns(loadedData);
    const catCols = getCategoryColumns(loadedData);
    const idCols = getIdColumns(loadedData);

    setNumericColumns(numCols);
    setDateColumns(dtCols);
    setCategoryColumns(catCols);
    setIdColumns(idCols);

    // Auto-Detect Logic
    const bestConfig = detectBestColumns(loadedData);
    
    // If we have at least an Amount column, we can auto-run
    if (bestConfig && bestConfig.amountColumn) {
        console.log("Auto-detection successful:", bestConfig);
        setActiveConfig(bestConfig);
        // Transition directly to analyzing state with auto-detected cols
        setAppState(AppState.ANALYZING);
        setTimeout(() => {
            const result = performAnalysis(
                loadedData, 
                bestConfig.amountColumn, 
                bestConfig.dateColumn, 
                bestConfig.categoryColumn,
                bestConfig.sourceColumn,
                bestConfig.invoiceColumn
            );
            setAnalysisResult(result);
            setAppState(AppState.RESULTS);
        }, 800); // Slight delay for UX
    } else if (numCols.length > 0) {
      // Fallback to manual selection if auto-detect failed but numeric cols exist
      setAppState(AppState.SELECT_COLUMN);
    } else {
      alert("No numeric columns found suitable for analysis.");
    }
  };

  const handleColumnSelected = (column: string, dateColumn?: string, categoryColumn?: string, sourceColumn?: string, invoiceColumn?: string) => {
    setActiveConfig({
        amountColumn: column,
        dateColumn,
        categoryColumn,
        sourceColumn,
        invoiceColumn
    });
    setAppState(AppState.ANALYZING);
    setTimeout(() => {
      const result = performAnalysis(data, column, dateColumn, categoryColumn, sourceColumn, invoiceColumn);
      setAnalysisResult(result);
      setAppState(AppState.RESULTS);
    }, 500);
  };

  const handleEditConfig = () => {
      setAppState(AppState.SELECT_COLUMN);
  };

  const handleReset = () => {
    setData([]);
    setFileName('');
    setNumericColumns([]);
    setDateColumns([]);
    setCategoryColumns([]);
    setIdColumns([]);
    setAnalysisResult(null);
    setActiveConfig(null);
    setAppState(AppState.UPLOAD);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">FraudGuard AI</h1>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Forensic Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {process.env.API_KEY ? (
               <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100 flex items-center gap-1">
                 <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                 AI Connected
               </span>
             ) : (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100 flex items-center gap-1">
                 <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                 Demo Mode (No AI)
               </span>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {appState === AppState.UPLOAD && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900">Detect Financial Anomalies Instantly</h2>
              <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
                Upload your ledger, transaction logs, or expense reports. We automatically detect headers and use Benford's Law, statistical outlier detection, and Gemini AI 
                to flag potential fraud.
              </p>
            </div>
            <FileUpload onDataLoaded={handleDataLoaded} />
          </div>
        )}

        {appState === AppState.SELECT_COLUMN && (
          <div className="animate-fade-in">
             <ColumnSelector 
                columns={numericColumns} 
                dateColumns={dateColumns}
                categoryColumns={categoryColumns}
                idColumns={idColumns}
                onSelect={handleColumnSelected}
                fileName={fileName}
                initialSelection={activeConfig}
             />
          </div>
        )}

        {appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center h-96 animate-fade-in">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-6 text-lg font-medium text-slate-700">Analyzing patterns...</p>
            <p className="text-sm text-slate-500">Checking Benford's Law, Outliers, and Network Flows</p>
          </div>
        )}

        {appState === AppState.RESULTS && analysisResult && (
          <div className="animate-fade-in">
            <AnalysisDashboard 
                result={analysisResult} 
                rawData={data}
                onReset={handleReset} 
                onEditConfig={handleEditConfig} 
            />
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} FraudGuard AI. Designed for forensic accounting.
        </div>
      </footer>
    </div>
  );
};

export default App;
