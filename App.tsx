
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  CheckCircle, 
  Sparkles,
  Table as TableIcon,
  Trash2,
  Files,
  XCircle,
  AlertCircle,
  CreditCard,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Moon,
  Sun
} from 'lucide-react';
import { Transaction, ProcessedTransaction, AiSummary, FileStatus } from './types';
import { parseCSV, processTransactions, convertToCSV, parseAmountToNumber, mergeAndDeduplicate, FileOrigin } from './utils/csvProcessor';
import { getFinancialSummary } from './services/geminiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type SortConfig = {
  key: keyof ProcessedTransaction;
  direction: 'asc' | 'desc';
} | null;

const App: React.FC = () => {
  const [processedData, setProcessedData] = useState<ProcessedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'Date', direction: 'desc' });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const newStatuses: FileStatus[] = [];
    let combinedTransactions: ProcessedTransaction[] = [...processedData];

    const processFile = (file: File): Promise<void> => {
      return new Promise((resolve) => {
        const fileNameUpper = file.name.toUpperCase();
        let accountName = "Other";
        let origin: FileOrigin = 'OTHER';

        if (fileNameUpper.startsWith('EQ_')) {
          accountName = "EQ Bank";
          origin = 'EQ';
        } else if (fileNameUpper.startsWith('CIBC_')) {
          accountName = "CIBC";
          origin = 'CIBC';
        } else if (fileNameUpper.startsWith('PC_')) {
          accountName = "PC Financial";
          origin = 'PC';
        } else {
          accountName = file.name.split('.')[0].replace(/_/g, ' ');
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const parsed = parseCSV(text);
          const processed = processTransactions(parsed, accountName, origin);
          
          combinedTransactions = [...combinedTransactions, ...processed];
          newStatuses.push({
            name: file.name,
            status: 'processed',
            count: processed.length
          });
          resolve();
        };
        reader.readAsText(file);
      });
    };

    // Process all files
    for (const file of Array.from(files) as File[]) {
      await processFile(file);
    }

    // Deduplicate the combined results
    const finalData = mergeAndDeduplicate(combinedTransactions);
    
    setProcessedData(finalData);
    setFileStatuses(prev => [...prev, ...newStatuses]);
    setIsProcessing(false);
  };

  const sortedData = useMemo(() => {
    let sortableItems = [...processedData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        // Custom sorting for dates
        if (sortConfig.key === 'Date') {
          const dateA = new Date(aValue).getTime();
          const dateB = new Date(bValue).getTime();
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }

        // Standard sorting for other fields
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [processedData, sortConfig]);

  const requestSort = (key: keyof ProcessedTransaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDownload = () => {
    const csvContent = convertToCSV(sortedData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'Consolidated_Financial_Data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAiAnalysis = async () => {
    if (processedData.length === 0) return;
    setIsAnalyzing(true);
    const summary = await getFinancialSummary(processedData);
    setAiSummary(summary);
    setIsAnalyzing(false);
  };

  const reset = () => {
    setProcessedData([]);
    setFileStatuses([]);
    setAiSummary(null);
    setSortConfig({ key: 'Date', direction: 'desc' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const chartData = useMemo(() => {
    if (!aiSummary) return [];
    return aiSummary.topCategories.map(item => ({
      name: item.category,
      value: Math.abs(item.amount)
    }));
  }, [aiSummary]);

  const getSortIcon = (key: keyof ProcessedTransaction) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
              <Files className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Financial <span className="text-blue-600">Merger</span></h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-transparent dark:border-slate-700"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            {processedData.length > 0 && (
              <div className="flex items-center gap-2 md:gap-3">
                <button 
                  onClick={reset}
                  className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                  title="Clear all data"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-lg font-medium transition-all shadow-sm hover:shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {processedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
            <div 
              className="w-full max-w-2xl p-16 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2.5rem] bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group cursor-pointer shadow-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="bg-blue-50 dark:bg-blue-900/30 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform shadow-inner">
                <Upload className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">Consolidate Your Data</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg max-w-md mx-auto">
                Upload files starting with <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-base">EQ_</code>, <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-base">CIBC_</code> or <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-base">PC_</code> to automatically merge and clean them.
              </p>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                multiple
                className="hidden" 
              />
              <button className="bg-slate-900 dark:bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl hover:bg-slate-800 dark:hover:bg-blue-500 hover:-translate-y-1 transition-all">
                Select CSV Statements
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-700">
            {/* Left: Files & Preview */}
            <div className="lg:col-span-3 space-y-6">
              {/* File Status Card */}
              <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 transition-colors duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Source Files Connected</h3>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Upload className="w-4 h-4" />
                    Add More
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {fileStatuses.map((file, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-bold shadow-sm transition-colors ${
                        file.status === 'processed' 
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400' 
                          : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-400'
                      }`}
                    >
                      <span className="truncate max-w-[180px]">{file.name}</span>
                      {file.status === 'processed' && (
                        <span className="bg-emerald-200/50 dark:bg-emerald-500/20 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-wider">
                          {file.count} rows
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Transactions Table */}
              <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <TableIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Merged Transaction Ledger</h3>
                  </div>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-1.5 rounded-xl shadow-sm">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                      Total: <span className="text-blue-600 dark:text-blue-400">{sortedData.length}</span> Unique Entries
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[650px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm sticky top-0 z-[5] border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="px-8 py-5">
                          <button 
                            onClick={() => requestSort('Date')}
                            className="flex items-center gap-2 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px] hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                          >
                            Date
                            {getSortIcon('Date')}
                          </button>
                        </th>
                        <th className="px-8 py-5">
                          <button 
                            onClick={() => requestSort('Account/Card')}
                            className="flex items-center gap-2 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            Account
                            {getSortIcon('Account/Card')}
                          </button>
                        </th>
                        <th className="px-8 py-5 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">Description</th>
                        <th className="px-8 py-5 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px] text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {sortedData.map((row, idx) => {
                        const amount = parseAmountToNumber(row.Amount);
                        return (
                          <tr key={idx} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all">
                            <td className="px-8 py-5 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">{row['Date']}</td>
                            <td className="px-8 py-5">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                                row['Account/Card'] === 'EQ Bank' 
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-400' 
                                  : row['Account/Card'] === 'CIBC'
                                  ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-700 dark:text-red-400'
                                  : row['Account/Card'] === 'PC Financial'
                                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}>
                                <CreditCard className="w-3 h-3" />
                                {row['Account/Card']}
                              </span>
                            </td>
                            <td className="px-8 py-5 font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                              {row['Description']}
                            </td>
                            <td className={`px-8 py-5 text-right font-bold whitespace-nowrap tabular-nums text-base ${amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {row.Amount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Right: AI Insights */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 p-8 sticky top-24 overflow-hidden transition-colors duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 dark:bg-violet-900/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
                
                {!aiSummary && !isAnalyzing ? (
                  <div className="text-center py-4 relative z-[1]">
                    <div className="bg-gradient-to-br from-violet-600 to-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-200 dark:shadow-none rotate-3">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Portfolio IQ</h4>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">Let Gemini AI synthesize your combined financial health and uncover hidden spending patterns.</p>
                    <button 
                      onClick={handleAiAnalysis}
                      disabled={isProcessing}
                      className="w-full bg-slate-900 dark:bg-violet-600 hover:bg-slate-800 dark:hover:bg-violet-500 text-white py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                    >
                      <Sparkles className="w-5 h-5 text-violet-400 dark:text-violet-200" />
                      Run Intelligence
                    </button>
                  </div>
                ) : isAnalyzing ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center">
                    <div className="relative w-20 h-20 mb-6">
                      <div className="absolute inset-0 border-8 border-violet-100 dark:border-slate-800 rounded-full"></div>
                      <div className="absolute inset-0 border-8 border-violet-600 dark:border-violet-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-slate-900 dark:text-white font-extrabold text-xl">Synthesizing Data</p>
                    <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">Connecting cross-account trends...</p>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 relative z-[1]">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-600 rounded-xl">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">AI Audit</h3>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div>
                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Strategy Overview</h4>
                        <p className="text-slate-800 dark:text-slate-200 font-medium text-base leading-relaxed">{aiSummary?.overview}</p>
                      </div>

                      <div className="h-56 w-full -mx-2">
                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 mx-2">Spending Breakdown</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={8}
                              dataKey="value"
                              stroke="none"
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                borderRadius: '16px', 
                                border: 'none', 
                                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' 
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-slate-900 dark:bg-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-125 transition-transform">
                          <AlertCircle className="w-12 h-12 text-violet-400" />
                        </div>
                        <h4 className="text-xs font-black text-violet-400 dark:text-violet-300 uppercase tracking-[0.2em] mb-2">Core Advice</h4>
                        <p className="text-white dark:text-slate-100 font-medium text-sm leading-relaxed relative z-[1]">
                          {aiSummary?.savingsAdvice}
                        </p>
                      </div>

                      <button 
                        onClick={handleAiAnalysis}
                        className="w-full border-2 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white transition-all active:scale-95"
                      >
                        Refresh Intelligence
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
