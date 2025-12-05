
import React, { useEffect } from 'react';
import { ArrowRight, BarChart3, Calendar, Users, GitMerge, FileDigit } from 'lucide-react';
import { AnalysisConfig } from '../types';

interface ColumnSelectorProps {
  columns: string[];
  dateColumns: string[];
  categoryColumns: string[];
  idColumns: string[]; // New: Potential ID columns
  onSelect: (column: string, dateColumn?: string, categoryColumn?: string, sourceColumn?: string, invoiceColumn?: string) => void;
  fileName: string;
  initialSelection?: AnalysisConfig | null;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({ columns, dateColumns, categoryColumns, idColumns, onSelect, fileName, initialSelection }) => {
  const [selectedCol, setSelectedCol] = React.useState<string>(columns[0] || '');
  const [selectedDateCol, setSelectedDateCol] = React.useState<string>('');
  const [selectedCatCol, setSelectedCatCol] = React.useState<string>('');
  const [selectedSrcCol, setSelectedSrcCol] = React.useState<string>('');
  const [selectedInvCol, setSelectedInvCol] = React.useState<string>('');

  // Pre-fill selection if config is provided (e.g. from Auto-Detect or Edit)
  useEffect(() => {
    if (initialSelection) {
        if (initialSelection.amountColumn) setSelectedCol(initialSelection.amountColumn);
        if (initialSelection.dateColumn) setSelectedDateCol(initialSelection.dateColumn);
        if (initialSelection.categoryColumn) setSelectedCatCol(initialSelection.categoryColumn);
        if (initialSelection.sourceColumn) setSelectedSrcCol(initialSelection.sourceColumn);
        if (initialSelection.invoiceColumn) setSelectedInvCol(initialSelection.invoiceColumn);
    }
  }, [initialSelection]);

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 className="text-blue-600" size={20} />
          Configure Analysis
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          File: <span className="font-medium text-slate-700">{fileName}</span>
        </p>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Value Column Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">1</span>
                Amount Column (Required)
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar pl-7">
                {columns.map((col) => (
                <label 
                    key={col}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedCol === col 
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <input
                    type="radio"
                    name="valueColumn"
                    value={col}
                    checked={selectedCol === col}
                    onChange={() => setSelectedCol(col)}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium text-slate-700 truncate" title={col}>{col}</span>
                </label>
                ))}
            </div>
          </div>

          {/* Date Column Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">2</span>
                Date Column (Optional)
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar pl-7">
                 <label className={`flex items-center p-2 rounded-lg border cursor-pointer ${selectedDateCol === '' ? 'border-slate-400 bg-slate-50' : 'border-slate-200'}`}>
                    <input type="radio" name="dateColumn" value="" checked={selectedDateCol === ''} onChange={() => setSelectedDateCol('')} className="w-4 h-4 text-slate-400" />
                    <span className="ml-3 text-sm text-slate-500 italic">None</span>
                </label>
                {dateColumns.map((col) => (
                <label key={col} className={`flex items-center p-2 rounded-lg border cursor-pointer ${selectedDateCol === col ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                    <input type="radio" name="dateColumn" value={col} checked={selectedDateCol === col} onChange={() => setSelectedDateCol(col)} className="w-4 h-4 text-indigo-600" />
                    <Calendar size={14} className="ml-3 mr-2 text-indigo-400" />
                    <span className="text-sm font-medium text-slate-700 truncate">{col}</span>
                </label>
                ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
             {/* Category Column Selection */}
            <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">3</span>
                Target / Category (e.g. Vendor)
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar pl-7">
                 <label className={`flex items-center p-2 rounded-lg border cursor-pointer ${selectedCatCol === '' ? 'border-slate-400 bg-slate-50' : 'border-slate-200'}`}>
                    <input type="radio" name="catColumn" value="" checked={selectedCatCol === ''} onChange={() => setSelectedCatCol('')} className="w-4 h-4 text-slate-400" />
                    <span className="ml-3 text-sm text-slate-500 italic">None</span>
                </label>
                {categoryColumns.map((col) => (
                <label key={col} className={`flex items-center p-2 rounded-lg border cursor-pointer ${selectedCatCol === col ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}>
                    <input type="radio" name="catColumn" value={col} checked={selectedCatCol === col} onChange={() => setSelectedCatCol(col)} className="w-4 h-4 text-teal-600" />
                    <Users size={14} className="ml-3 mr-2 text-teal-400" />
                    <span className="text-sm font-medium text-slate-700 truncate">{col}</span>
                </label>
                ))}
            </div>
            </div>

            {/* Source & Invoice Columns */}
            <div className="grid grid-cols-1 gap-4">
                {/* Source */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">4</span>
                        Source (e.g. Employee)
                    </label>
                    <select 
                        value={selectedSrcCol} 
                        onChange={(e) => setSelectedSrcCol(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">None (Skip Network Graph)</option>
                        {categoryColumns.filter(c => c !== selectedCatCol).map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                {/* Invoice ID */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">5</span>
                        Invoice / ID (Benford)
                    </label>
                    <select 
                        value={selectedInvCol} 
                        onChange={(e) => setSelectedInvCol(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                         <option value="">Same as Amount (Default)</option>
                        {idColumns.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                     <p className="text-[10px] text-slate-400 mt-1 pl-1">
                        Select if you want to test Benford's Law on Invoice IDs instead of Amounts.
                    </p>
                </div>
            </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 bg-slate-50">
        <button
            onClick={() => onSelect(selectedCol, selectedDateCol || undefined, selectedCatCol || undefined, selectedSrcCol || undefined, selectedInvCol || undefined)}
            disabled={!selectedCol}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-sm"
            >
            Run Advanced Fraud Analysis
            <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default ColumnSelector;
