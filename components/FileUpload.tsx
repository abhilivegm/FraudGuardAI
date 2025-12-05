import React, { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { DataRow } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: DataRow[], fileName: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const processFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<DataRow>(sheet);
        
        if (jsonData.length === 0) {
          setError("The file appears to be empty.");
          return;
        }

        onDataLoaded(jsonData, file.name);
      } catch (err) {
        console.error(err);
        setError("Failed to parse file. Please ensure it is a valid Excel or CSV file.");
      }
    };

    reader.onerror = () => {
      setError("Error reading file.");
    };

    reader.readAsBinaryString(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [onDataLoaded]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div 
        className={`relative border-2 border-dashed rounded-xl p-12 transition-all duration-300 text-center
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-slate-300 hover:border-blue-400 bg-white'
          }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
            <Upload size={32} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-800">
              Upload Financial Data
            </h3>
            <p className="text-slate-500 mt-2">
              Drag & drop your Excel (.xlsx) or CSV file here
            </p>
          </div>
          
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileSelect}
            />
            <button className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Browse Files
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 animate-fade-in">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard 
          icon={<FileSpreadsheet size={20} />}
          title="Auto-Detection"
          desc="Identifies numeric columns automatically"
        />
        <FeatureCard 
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>}
          title="Benford Analysis"
          desc="Advanced statistical distribution checks"
        />
        <FeatureCard 
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>}
          title="AI Insights"
          desc="Powered by Gemini for forensic reporting"
        />
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="p-4 bg-white rounded-lg border border-slate-100 shadow-sm">
    <div className="text-blue-600 mb-2">{icon}</div>
    <h4 className="font-semibold text-slate-800 text-sm">{title}</h4>
    <p className="text-xs text-slate-500 mt-1">{desc}</p>
  </div>
);

export default FileUpload;
