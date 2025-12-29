
import React from 'react';
import { Repository } from '../types';
import { Server, Shield, Clock, HardDrive, Trash2, Loader2, Edit2, ShieldCheck, Unlock, Lock, Wrench, Key, UploadCloud, Briefcase } from 'lucide-react';

interface RepoCardProps {
  repo: Repository;
  onMount?: (repo: Repository) => void;
  onConnect?: (repo: Repository) => void;
  onDelete?: (repo: Repository) => void;
  onEdit?: (repo: Repository) => void;
  onCheck?: (repo: Repository) => void;
  onBreakLock?: (repo: Repository) => void;
  onMaintenance?: (repo: Repository) => void;
  onExportKey?: (repo: Repository) => void;
  onBackup?: (repo: Repository) => void;
  onManageJobs?: (repo: Repository) => void;
}

const RepoCard: React.FC<RepoCardProps> = ({ repo, onMount, onConnect, onDelete, onEdit, onCheck, onBreakLock, onMaintenance, onExportKey, onBackup, onManageJobs }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200/75 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all duration-200 group relative overflow-hidden flex flex-col h-full">
      
      {/* Top Row: Icon + Name + Unified Toolbar */}
      <div className="flex justify-between items-start mb-5 gap-3">
        
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2.5 rounded-lg transition-colors shrink-0 ${
            repo.status === 'connected' ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/50' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
          }`}>
            <Server className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base truncate" title={repo.name}>{repo.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono opacity-80" title={repo.url}>{repo.url}</p>
          </div>
        </div>
        
        {/* Right: Unified Control Pill */}
        <div className="flex items-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-1 shadow-sm gap-1 shrink-0 ml-auto">
            
            {/* Locked Indicator */}
            {repo.isLocked && (
                 <div className="flex items-center justify-center w-7 h-7 rounded-md bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800" title="Repo is Locked">
                     <Lock className="w-3.5 h-3.5" />
                 </div>
            )}

            {/* Status Section */}
            <div 
                className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                  repo.status === 'connected' ? 'bg-green-50 dark:bg-green-900/30' : 
                  repo.status === 'connecting' ? 'bg-blue-50 dark:bg-blue-900/30' :
                  'bg-gray-50 dark:bg-slate-800'
                }`}
                title={repo.status === 'connected' ? 'Status: Active' : repo.status === 'connecting' ? 'Status: Connecting' : 'Status: Offline'}
            >
                <div className={`w-2 h-2 rounded-full ${
                     repo.status === 'connected' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 
                     repo.status === 'connecting' ? 'bg-blue-500 animate-pulse' :
                     'bg-slate-400'
                }`} />
            </div>

            <div className="w-px h-4 bg-gray-200 dark:bg-slate-700 mx-0.5"></div>

            {/* Actions Section */}
            <div className="flex items-center gap-0.5">
                {onMaintenance && repo.status === 'connected' && (
                    <button 
                        onClick={() => onMaintenance(repo)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-all"
                        title="Maintenance (Prune/Compact)"
                    >
                        <Wrench className="w-3.5 h-3.5" />
                    </button>
                )}
                
                {onExportKey && repo.encryption !== 'none' && (
                    <button 
                        onClick={() => onExportKey(repo)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-md transition-all"
                        title="Export/Recover Key"
                    >
                        <Key className="w-3.5 h-3.5" />
                    </button>
                )}

                {onEdit && (
                    <button 
                        onClick={() => onEdit(repo)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all"
                        title="Edit Configuration"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                )}

                {onDelete && (
                    <button 
                        onClick={() => onDelete(repo)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
                        title="Delete Configuration"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-5 p-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-slate-100/50 dark:border-slate-700/50 mt-auto">
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="truncate">{repo.lastBackup}</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
          <HardDrive className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="font-medium truncate">{repo.size}</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 col-span-2">
          <Shield className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="capitalize truncate">{repo.encryption === 'none' ? 'No Encryption' : `${repo.encryption} encryption`}</span>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="flex flex-col gap-2">
         <div className="flex gap-2">
            <button 
              onClick={() => onConnect?.(repo)}
              disabled={repo.status === 'connecting'}
              className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all border flex items-center justify-center gap-2 ${
                  repo.status === 'connected' 
                  ? 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600' 
                  : 'bg-slate-800 dark:bg-blue-600 text-white border-transparent hover:bg-slate-700 dark:hover:bg-blue-700 shadow-sm'
              } disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {repo.status === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {repo.status === 'connected' ? 'Refresh' : 'Connect'}
            </button>
            
            {repo.status === 'connected' && (
                <>
                <button 
                  onClick={() => onMount?.(repo)}
                  title="Mount existing archives"
                  className="flex-1 px-3 py-2 text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400 transition-colors shadow-sm"
                >
                  Mount
                </button>
                {onManageJobs && (
                    <button 
                        onClick={() => onManageJobs(repo)}
                        title="Manage Backup Jobs"
                        className="px-3 py-2 text-xs font-semibold bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 rounded-lg text-purple-700 dark:text-purple-400 transition-colors shadow-sm"
                    >
                        <Briefcase className="w-4 h-4" />
                    </button>
                )}
                {onBackup && (
                    <button 
                        onClick={() => onBackup(repo)}
                        title="One-off Backup (Snapshot)"
                        className="px-3 py-2 text-xs font-semibold bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 transition-colors shadow-sm"
                    >
                        <UploadCloud className="w-4 h-4" />
                    </button>
                )}
                </>
            )}
         </div>
         
         <div className="flex gap-2 pt-1">
             {onCheck && repo.status === 'connected' && (
                <button 
                   onClick={() => onCheck(repo)}
                   className="flex-1 px-3 py-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 border border-transparent rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                   <ShieldCheck className="w-3 h-3" /> Verify
                </button>
             )}
             
             {onBreakLock && (
                 <button 
                   onClick={() => onBreakLock(repo)}
                   className="flex-1 px-3 py-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 border border-transparent rounded-lg transition-colors flex items-center justify-center gap-1.5"
                   title="Force break lock"
                >
                   <Unlock className="w-3 h-3" /> Unlock
                </button>
             )}
         </div>
      </div>
    </div>
  );
};

export default RepoCard;
