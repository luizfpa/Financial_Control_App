
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  CheckCircle, 
  Sparkles,
  Trash2,
  Files,
  XCircle,
  AlertCircle,
  CreditCard,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Moon,
  Sun,
  Link2,
  Lock,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Copy,
  Check,
  ArrowRight,
  Info,
  MousePointer2,
  Keyboard,
  Zap,
  Star,
  Loader2,
  Table,
  Plus
} from 'lucide-react';
import { Transaction, ProcessedTransaction, AiSummary, FileStatus } from './types';
import { 
  parseCSV, 
  processTransactions, 
  convertToCSV, 
  parseAmountToNumber, 
  mergeAndDeduplicate, 
  FileOrigin
} from './utils/csvProcessor';
import { getFinancialSummary } from './services/geminiService';

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
  
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [wsStep, setWsStep] = useState<1 | 2 | 3>(1);
  const [wsPasteContent, setWsPasteContent] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  
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

  const magicSyncCode = useMemo(() => {
    const code = `javascript:(async function(){
      const notify = (msg, color="#3b82f6") => {
        let div = document.getElementById('ws-sync-status');
        if(!div){
          div = document.createElement('div');
          div.id = 'ws-sync-status';
          div.style = 'position:fixed;bottom:30px;right:30px;z-index:999999;padding:12px 20px;border-radius:12px;color:white;font-weight:900;font-family:sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.3);transition:all 0.3s;font-size:12px;';
          document.body.appendChild(div);
        }
        div.style.backgroundColor = color;
        div.innerText = msg;
      };

      notify("🚀 Syncing...");

      let lastHeight = document.body.scrollHeight;
      for(let i=0; i<6; i++){
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 800));
        let newHeight = document.body.scrollHeight;
        if(newHeight === lastHeight) break;
        lastHeight = newHeight;
        notify("⏳ Scrolling ("+(i+1)+"/6)...");
      }

      const rows = [];
      const dateHeaders = Array.from(document.querySelectorAll('h2, [class*="DateHeader"]'));
      
      dateHeaders.forEach(header => {
        const dateText = header.innerText.trim();
        let container = header.nextElementSibling;
        if(!container) return;

        const items = Array.from(container.querySelectorAll('button, [role="button"], li'));
        items.forEach(item => {
          const textParts = Array.from(item.querySelectorAll('p, span, div, b'))
            .map(el => el.innerText.trim())
            .filter(t => t.length > 0 && !t.includes('\\n'));

          const amount = textParts.find(t => t.includes('$') && /[0-9]/.test(t));
          if (!amount) return;

          const merchant = textParts.find(t => 
            t !== amount && 
            !['purchase', 'wealthsimple', 'card', 'pending', 'refund', 'interac', 'e-transfer', 'cad', 'visa', 'mastercard'].some(f => t.toLowerCase().includes(f)) &&
            t.length > 2
          ) || textParts[0];

          if(amount && merchant && dateText) {
            rows.push({ Date: dateText, Description: merchant, Amount: amount, Account: "Wealthsimple" });
          }
        });
      });

      if(rows.length === 0) {
        notify("❌ No items found!", "#ef4444");
        return;
      }

      const csv = "Date,Description,Amount,Account\\n" + rows.map(r => \`"\${r.Date}","\${r.Description}","\${r.Amount}","\${r.Account}"\`).join("\\n");
      
      const el = document.createElement('textarea');
      el.value = csv;
      document.body.appendChild(el);
      el.select();
      const success = document.execCommand('copy');
      document.body.removeChild(el);

      if(success) notify("✅ Copied " + rows.length + " transactions.", "#10b981");
      else notify("⚠️ Error copying!", "#f59e0b");
    })();`;
    return code.replace(/\s+/g, ' ');
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | null } }) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    let currentData = [...processedData];
    const newStatuses: FileStatus[] = [];

    const processFile = (file: File): Promise<void> => {
      return new Promise((resolve) => {
        const fileNameUpper = file.name.toUpperCase();
        let accountName = "Other";
        let origin: FileOrigin = 'OTHER';
        
        if (fileNameUpper.includes('EQ')) { 
          accountName = "EQ Bank"; 
          origin = 'EQ'; 
        } else if (fileNameUpper.includes('CIBC')) { 
          accountName = "CIBC"; 
          origin = 'CIBC'; 
        } else if (fileNameUpper.includes('WS')) { 
          accountName = "Wealthsimple"; 
          origin = 'WS'; 
        } else if (fileNameUpper.startsWith('PC_')) { 
          accountName = "PC Financial"; 
          origin = 'PC'; 
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const parsed = parseCSV(text);
          const processed = processTransactions(parsed, accountName, origin);
          currentData = [...currentData, ...processed];
          newStatuses.push({ name: file.name, status: 'processed', count: processed.length });
          resolve();
        };
        reader.readAsText(file);
      });
    };

    for (const file of Array.from(files) as File[]) { await processFile(file); }
    setProcessedData(mergeAndDeduplicate(currentData));
    setFileStatuses(prev => [...prev, ...newStatuses]);
    setIsProcessing(false);
    setShowConnectModal(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleWsSync = () => {
    if (!wsPasteContent.trim()) return;
    setIsProcessing(true);
    const parsed = parseCSV(wsPasteContent);
    const processed = processTransactions(parsed, "Wealthsimple Card", 'WS');
    if (processed.length > 0) {
      setProcessedData(mergeAndDeduplicate([...processedData, ...processed]));
      setFileStatuses(prev => [...prev, {
        name: `WS Sync ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
        status: 'processed',
        count: processed.length
      }]);
    }
    setWsPasteContent("");
    setIsProcessing(false);
    setShowConnectModal(false);
    setWsStep(1);
  };

  const sortedData = useMemo(() => {
    let items = [...processedData];
    if (sortConfig) {
      items.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (sortConfig.key === 'Date') {
          return sortConfig.direction === 'asc' 
            ? new Date(aVal).getTime() - new Date(bVal).getTime() 
            : new Date(bVal).getTime() - new Date(aVal).getTime();
        }
        return sortConfig.direction === 'asc' 
          ? (aVal < bVal ? -1 : 1) 
          : (aVal > bVal ? -1 : 1);
      });
    }
    return items;
  }, [processedData, sortConfig]);

  const copyScriptFallback = () => {
    navigator.clipboard.writeText(magicSyncCode);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-xl shadow-blue-200 dark:shadow-none shadow-lg">
              <Zap className="text-white w-5 h-5 fill-white" />
            </div>
            <h1 className="text-xl font-black tracking-tight">EQ Nando <span className="text-blue-600">Sync</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Statements
            </button>
            <button 
              onClick={() => setShowConnectModal(true)} 
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-md active:scale-95"
            >
              <Link2 className="w-4 h-4" /> Wealthsimple
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
          </div>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" multiple className="hidden" />
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-10">
        {processedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in zoom-in duration-500">
            <div className="w-full max-w-2xl p-16 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[3rem] bg-white dark:bg-slate-900 shadow-sm">
              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <Upload className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-4xl font-black mb-4 tracking-tight">Financial Auditor</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-10 text-lg max-w-md mx-auto">Merge your bank statements and visualize your spending habits.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95"
                >
                  Upload CSVs
                </button>
                <button 
                  onClick={() => setShowConnectModal(true)} 
                  className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-10 py-5 rounded-2xl font-black text-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  Magic Sync
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in slide-in-from-bottom duration-500">
            <div className="lg:col-span-3 space-y-6">
              <section className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-center gap-3">
                    <Table className="w-5 h-5 text-blue-600" />
                    <h3 className="font-black text-lg">Activity History</h3>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => {
                        const csv = convertToCSV(sortedData);
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Audit_Report_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                    }} className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors">
                      <Download className="w-4 h-4" /> Export
                    </button>
                    <button onClick={() => setProcessedData([])} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors">
                      <Trash2 className="w-4 h-4" /> Clear
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[700px] custom-scrollbar">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="px-8 py-5 font-bold text-slate-400 uppercase text-[10px] tracking-[0.2em] cursor-pointer group" onClick={() => setSortConfig({ key: 'Date', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>
                          <span className="flex items-center gap-2">Date {sortConfig?.key === 'Date' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"/>}</span>
                        </th>
                        <th className="px-8 py-5 font-bold text-slate-400 uppercase text-[10px] tracking-[0.2em]">Source</th>
                        <th className="px-8 py-5 font-bold text-slate-400 uppercase text-[10px] tracking-[0.2em]">Merchant</th>
                        <th className="px-8 py-5 font-bold text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {sortedData.map((row, idx) => {
                        const isWS = row['Account/Card'].includes('Wealthsimple');
                        const isNeg = row.Amount.includes('-');
                        return (
                          <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-8 py-5 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">{row.Date}</td>
                            <td className="px-8 py-5">
                              <span className={`whitespace-nowrap px-3 py-1 rounded-lg text-[10px] font-black uppercase border tracking-wider ${isWS ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-100 dark:border-amber-900' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-900'}`}>
                                {row['Account/Card']}
                              </span>
                            </td>
                            <td className="px-8 py-5 font-bold text-slate-800 dark:text-slate-100 text-base">{row.Description}</td>
                            <td className={`px-8 py-5 text-right font-black text-base ${isNeg ? 'text-rose-500' : 'text-emerald-500'}`}>{row.Amount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
            <div className="space-y-6">
               <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center sticky top-24 overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles className="w-20 h-20 text-blue-600" />
                  </div>
                  <h4 className="font-black text-xl mb-3 tracking-tight">AI Insights</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Analyze spending patterns with AI.</p>
                  
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center py-10">
                      <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                      <p className="font-bold text-slate-600 animate-pulse text-sm">Analyzing transactions...</p>
                    </div>
                  ) : aiSummary ? (
                    <div className="text-left space-y-6 animate-in fade-in duration-500">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Summary</span>
                        <p className="text-sm leading-relaxed mt-2 text-slate-700 dark:text-slate-300">{aiSummary.overview}</p>
                      </div>
                      <div className="bg-slate-900 dark:bg-slate-800 p-5 rounded-2xl border border-blue-900/30">
                        <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Savings Goal</span>
                        <p className="text-xs italic text-white/90 mt-2">"{aiSummary.savingsAdvice}"</p>
                      </div>
                      <button onClick={() => setAiSummary(null)} className="w-full text-slate-400 text-[10px] font-black uppercase hover:text-blue-600 transition-colors">Refresh Analysis</button>
                    </div>
                  ) : (
                    <button 
                      onClick={async () => {
                        setIsAnalyzing(true);
                        setAiSummary(await getFinancialSummary(processedData));
                        setIsAnalyzing(false);
                      }} 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
                    >
                      Audit Spendings
                    </button>
                  )}
               </div>
            </div>
          </div>
        )}
      </main>

      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="bg-amber-500 h-2 w-full"></div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-2xl">
                  <Zap className="w-6 h-6 text-amber-500 fill-amber-500" />
                </div>
                <button onClick={() => setShowConnectModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><XCircle className="w-6 h-6 text-slate-300" /></button>
              </div>

              <div className="flex items-center gap-2 mb-8">
                {[1, 2, 3].map(step => (
                  <React.Fragment key={step}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all ${wsStep === step ? 'bg-amber-500 text-white scale-110 shadow-lg shadow-amber-200 dark:shadow-none' : wsStep > step ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      {wsStep > step ? <Check className="w-4 h-4" /> : step}
                    </div>
                    {step < 3 && <div className={`flex-1 h-1 rounded-full ${wsStep > step ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-800'}`}></div>}
                  </React.Fragment>
                ))}
              </div>

              {wsStep === 1 && (
                <div className="animate-in slide-in-from-right duration-300 text-center">
                  <h2 className="text-2xl font-black mb-3 tracking-tight text-left">Wealthsimple Sync</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-8 leading-relaxed text-left">
                    Copy the sync code below and create a bookmark manually in your browser with this code as the URL.
                  </p>
                  
                  <div className="mb-8">
                    <button 
                      onClick={copyScriptFallback}
                      className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-black text-sm transition-all shadow-xl active:scale-95 hover:bg-slate-800 dark:hover:bg-blue-700"
                    >
                      <Copy className="w-5 h-5" />
                      {copyFeedback ? 'Copied Successfully!' : 'Copy Sync Code'}
                    </button>
                  </div>

                  <button onClick={() => setWsStep(2)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-all border border-slate-200 dark:border-slate-700">
                    I've Added It <ArrowRight className="w-4 h-4"/>
                  </button>
                </div>
              )}

              {wsStep === 2 && (
                <div className="animate-in slide-in-from-right duration-300">
                  <h2 className="text-2xl font-black mb-6 tracking-tight">Run Extraction</h2>
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <div className="bg-amber-500 text-white w-6 h-6 rounded flex items-center justify-center font-black text-[10px]">1</div>
                      <p className="text-xs font-medium">Open <span className="text-amber-600 font-bold">Wealthsimple</span> activity.</p>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <div className="bg-amber-500 text-white w-6 h-6 rounded flex items-center justify-center font-black text-[10px]">2</div>
                      <p className="text-xs font-medium">Click your new <span className="text-amber-600 font-bold">"Sync"</span> bookmark.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setWsStep(1)} className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs">Back</button>
                    <button onClick={() => setWsStep(3)} className="flex-1 bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2">Next Step <ArrowRight className="w-4 h-4"/></button>
                  </div>
                </div>
              )}

              {wsStep === 3 && (
                <div className="animate-in slide-in-from-right duration-300">
                   <h2 className="text-2xl font-black mb-3 tracking-tight">Merge Data</h2>
                   <p className="text-slate-500 dark:text-slate-400 text-xs mb-4 leading-relaxed">The bookmarklet copied your data. Paste it here.</p>
                   <textarea 
                    value={wsPasteContent}
                    onChange={(e) => setWsPasteContent(e.target.value)}
                    placeholder="Ctrl+V (Paste) here..."
                    className="w-full h-40 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-[10px] font-mono mb-6 focus:border-amber-500 outline-none resize-none transition-all"
                   ></textarea>
                   <div className="flex gap-3">
                    <button onClick={() => setWsStep(2)} className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl font-black text-xs">Back</button>
                    <button 
                      onClick={handleWsSync} 
                      disabled={!wsPasteContent.trim()} 
                      className="flex-1 bg-amber-500 disabled:opacity-30 text-white py-4 rounded-xl font-black text-sm active:scale-95 transition-all shadow-md"
                    >
                      Complete Sync
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 text-center border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center justify-center gap-1"><Lock className="w-3 h-3" /> Encrypted Processing</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
