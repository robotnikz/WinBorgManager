import React, { useState, useEffect } from 'react';
import { Repository } from '../types';
import Button from './Button';
import { X, FolderPlus, Trash2, ArrowRight, Loader2, Play } from 'lucide-react';
import { borgService } from '../services/borgService';

interface CreateBackupModalProps {
  repo: Repository;
  isOpen: boolean;
  onClose: () => void;
  onLog: (title: string, logs: string[]) => void;
  onRefreshRepo: (repo: Repository) => void;
}

const CreateBackupModal: React.FC<CreateBackupModalProps> = ({ repo, isOpen, onClose, onLog, onRefreshRepo }) => {
  const [archiveName, setArchiveName] = useState('');
  const [sourcePaths, setSourcePaths] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<'config' | 'running'>('config');
  const [lastLine, setLastLine] = useState('');

  // Auto-generate archive name
  useEffect(() => {
      if (isOpen) {
          const date = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
          setArchiveName(`backup-${date}`);
          setSourcePaths([]);
          setActiveStep('config');
          setProgressLog([]);
          setIsProcessing(false);
      }
  }, [isOpen]);

  const handleAddFolder = async () => {
      const paths = await borgService.selectDirectory();
      if (paths && paths.length > 0) {
          // Avoid duplicates
          setSourcePaths(prev => {
              const newSet = new Set([...prev, ...paths]);
              return Array.from(newSet);
          });
      }
  };

  const removePath = (pathToRemove: string) => {
      setSourcePaths(prev => prev.filter(p => p !== pathToRemove));
  };

  const handleStartBackup = async () => {
      setActiveStep('running');
      setIsProcessing(true);
      setProgressLog([]);
      const logs: string[] = [];
      
      const logCollector = (l: string) => {
          const trimmed = l.trim();
          if (!trimmed) return;
          logs.push(trimmed);
          setProgressLog(prev => [...prev, trimmed]);
          setLastLine(trimmed);
      };

      try {
          const success = await borgService.createArchive(
              repo.url,
              archiveName,
              sourcePaths,
              logCollector,
              { repoId: repo.id, disableHostCheck: repo.trustHost }
          );

          if (success) {
             onRefreshRepo(repo);
             borgService.notify("Backup Successful", `Archive ${archiveName} created.`);
             onClose();
             onLog(`Create Backup: ${archiveName}`, logs);
          } else {
             borgService.notify("Backup Failed", `Could not create archive ${archiveName}.`);
             setIsProcessing(false); // Stay on running screen but stop spinner
          }
      } catch (e: any) {
          console.error(e);
          borgService.notify("Backup Error", e.message);
          setIsProcessing(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
       <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
           
           {/* Header */}
           <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
               <div>
                   <h3 className="font-bold text-slate-800 dark:text-slate-100">Create New Backup</h3>
                   <p className="text-xs text-slate-500 dark:text-slate-400">Target: {repo.name}</p>
               </div>
               <button onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50">
                 <X size={20} />
               </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6">
               {activeStep === 'config' ? (
                   <div className="space-y-6">
                       {/* Name Input */}
                       <div>
                           <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Archive Name</label>
                           <input 
                             type="text" 
                             className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 dark:text-white font-mono shadow-sm"
                             value={archiveName}
                             onChange={e => setArchiveName(e.target.value)}
                           />
                       </div>

                       {/* Source Selection */}
                       <div>
                           <div className="flex justify-between items-end mb-2">
                               <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Source Folders</label>
                               <Button size="sm" variant="secondary" onClick={handleAddFolder} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                                   <FolderPlus className="w-3.5 h-3.5 mr-1.5" /> Add Folder
                               </Button>
                           </div>
                           
                           <div className="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg min-h-[120px] max-h-[200px] overflow-y-auto">
                               {sourcePaths.length === 0 ? (
                                   <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-8">
                                       <FolderPlus className="w-8 h-8 mb-2 opacity-50" />
                                       <p className="text-sm">No folders selected</p>
                                   </div>
                               ) : (
                                   <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
                                       {sourcePaths.map((path, idx) => (
                                           <div key={idx} className="flex items-center justify-between p-3 hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                                               <span className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">{path}</span>
                                               <button onClick={() => removePath(path)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all">
                                                   <Trash2 className="w-4 h-4" />
                                               </button>
                                           </div>
                                       ))}
                                   </div>
                               )}
                           </div>
                           <p className="text-[10px] text-slate-400 mt-2">
                              Note: Windows paths will be automatically converted to WSL paths (e.g. <code>C:\Data</code> → <code>/mnt/c/Data</code>).
                           </p>
                       </div>
                   </div>
               ) : (
                   /* RUNNING STATE */
                   <div className="flex flex-col h-full">
                       <div className="flex items-center gap-3 mb-4">
                           {isProcessing ? (
                               <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                               </div>
                           ) : (
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                                    <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                           )}
                           <div>
                               <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                                   {isProcessing ? 'Creating Backup...' : 'Backup Process Stopped'}
                               </h4>
                               <p className="text-xs text-slate-500 truncate max-w-xs">{lastLine || 'Initializing...'}</p>
                           </div>
                       </div>
                       
                       <div className="flex-1 bg-slate-900 rounded-lg p-3 border border-slate-700 overflow-y-auto font-mono text-xs text-slate-300 min-h-[200px]">
                           {progressLog.map((line, i) => (
                               <div key={i} className="whitespace-pre-wrap break-all border-l-2 border-transparent pl-2 hover:border-slate-600 hover:bg-slate-800/50">
                                   {line}
                               </div>
                           ))}
                           <div id="log-end" />
                       </div>
                   </div>
               )}
           </div>

           <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
               {activeStep === 'config' ? (
                   <>
                       <Button variant="secondary" onClick={onClose} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Cancel</Button>
                       <Button onClick={handleStartBackup} disabled={!archiveName || sourcePaths.length === 0}>
                           <Play className="w-4 h-4 mr-2" /> Start Backup
                       </Button>
                   </>
               ) : (
                   <Button onClick={onClose} disabled={isProcessing} variant={isProcessing ? "ghost" : "primary"}>
                       {isProcessing ? "Running in Background..." : "Close"}
                   </Button>
               )}
           </div>
       </div>
    </div>
  );
};

export default CreateBackupModal;