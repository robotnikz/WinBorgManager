import React, { useState } from 'react';
import { Repository } from '../types';
import Button from './Button';
import { Trash2, HardDrive, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { borgService } from '../services/borgService';

interface MaintenanceModalProps {
  repo: Repository;
  isOpen: boolean;
  onClose: () => void;
  onLog: (title: string, logs: string[]) => void;
  onRefreshRepo: (repo: Repository) => void;
}

type MaintenanceTab = 'prune' | 'compact';

const MaintenanceModal: React.FC<MaintenanceModalProps> = ({ repo, isOpen, onClose, onLog, onRefreshRepo }) => {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('prune');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Prune Settings
  const [keepDaily, setKeepDaily] = useState(7);
  const [keepWeekly, setKeepWeekly] = useState(4);
  const [keepMonthly, setKeepMonthly] = useState(6);

  if (!isOpen) return null;

  const handlePrune = async () => {
      setIsProcessing(true);
      const logs: string[] = [];
      const logCollector = (l: string) => logs.push(l);

      try {
          const success = await borgService.prune(
              repo.url,
              { daily: keepDaily, weekly: keepWeekly, monthly: keepMonthly },
              logCollector,
              { passphrase: repo.passphrase, disableHostCheck: repo.trustHost }
          );
          
          onClose(); // Close this modal
          onLog(`Prune: ${repo.name}`, logs); // Open Terminal with logs
          
          if(success) onRefreshRepo(repo);
      } catch (e) {
          console.error(e);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleCompact = async () => {
      setIsProcessing(true);
      const logs: string[] = [];
      const logCollector = (l: string) => logs.push(l);

      try {
          const success = await borgService.compact(
              repo.url,
              logCollector,
              { passphrase: repo.passphrase, disableHostCheck: repo.trustHost }
          );
          
          onClose();
          onLog(`Compact: ${repo.name}`, logs);
          
          if(success) onRefreshRepo(repo);
      } catch (e) {
          console.error(e);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
       <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
           
           {/* Header */}
           <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <div>
                   <h3 className="font-bold text-slate-800">Repository Maintenance</h3>
                   <p className="text-xs text-slate-500">{repo.name}</p>
               </div>
               <button onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-slate-600 transition-colors">
                 <X size={20} />
               </button>
           </div>

           {/* Tabs */}
           <div className="flex border-b border-gray-200">
               <button 
                  onClick={() => setActiveTab('prune')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'prune' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-gray-50'}`}
               >
                   Prune (Cleanup)
               </button>
               <button 
                  onClick={() => setActiveTab('compact')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'compact' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-gray-50'}`}
               >
                   Compact (Free Space)
               </button>
           </div>

           <div className="p-6">
               {activeTab === 'prune' && (
                   <div className="space-y-6">
                       <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-3 text-amber-800 text-xs">
                           <AlertCircle className="w-5 h-5 shrink-0" />
                           <p>
                               Pruning permanently deletes old archives to save space. 
                               Archives matching the rules below will be <b>kept</b>, others deleted.
                           </p>
                       </div>

                       <div className="grid grid-cols-3 gap-4">
                           <div>
                               <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Keep Daily</label>
                               <input 
                                   type="number" 
                                   className="w-full border border-gray-300 rounded p-2 text-sm"
                                   value={keepDaily}
                                   onChange={e => setKeepDaily(parseInt(e.target.value) || 0)}
                               />
                           </div>
                           <div>
                               <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Keep Weekly</label>
                               <input 
                                   type="number" 
                                   className="w-full border border-gray-300 rounded p-2 text-sm"
                                   value={keepWeekly}
                                   onChange={e => setKeepWeekly(parseInt(e.target.value) || 0)}
                               />
                           </div>
                           <div>
                               <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Keep Monthly</label>
                               <input 
                                   type="number" 
                                   className="w-full border border-gray-300 rounded p-2 text-sm"
                                   value={keepMonthly}
                                   onChange={e => setKeepMonthly(parseInt(e.target.value) || 0)}
                               />
                           </div>
                       </div>

                       <div className="pt-2">
                           <Button onClick={handlePrune} disabled={isProcessing} className="w-full" variant="danger">
                               {isProcessing ? 'Pruning...' : 'Prune Repository Now'}
                           </Button>
                       </div>
                   </div>
               )}

               {activeTab === 'compact' && (
                   <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                            <div className="p-4 bg-indigo-50 rounded-full text-indigo-600">
                                <HardDrive className="w-8 h-8" />
                            </div>
                            <h4 className="text-lg font-semibold text-slate-800">Free Up Disk Space</h4>
                            <p className="text-sm text-slate-500 max-w-xs mx-auto">
                                Run this command to physically free up space in the repository that was marked as deleted by "Prune" or "Delete".
                            </p>
                        </div>

                        <Button onClick={handleCompact} disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-700">
                            {isProcessing ? 'Compacting...' : 'Run Compact Command'}
                        </Button>
                   </div>
               )}
           </div>
       </div>
    </div>
  );
};

export default MaintenanceModal;