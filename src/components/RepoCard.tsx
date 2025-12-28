
import React from 'react';
import { Repository } from '../types';
import { Server, Shield, Clock, HardDrive, Trash2, Loader2, Edit2, ShieldCheck, Unlock } from 'lucide-react';

interface RepoCardProps {
  repo: Repository;
  onMount?: (repo: Repository) => void;
  onConnect?: (repo: Repository) => void;
  onDelete?: (repo: Repository) => void;
  onEdit?: (repo: Repository) => void;
  onCheck?: (repo: Repository) => void;
  onBreakLock?: (repo: Repository) => void;
}

const RepoCard: React.FC<RepoCardProps> = ({ repo, onMount, onConnect, onDelete, onEdit, onCheck, onBreakLock }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200/75 p-5 shadow-sm hover:shadow-md transition-all duration-200 group relative overflow-hidden">
      
      {/* Top Row: Icon + Name + Unified Toolbar */}
      <div className="flex justify-between items-start mb-5">
        
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-xl transition-colors ${
            repo.status === 'connected' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-gray-100 text-gray-500'
          }`}>
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">{repo.name}</h3>
            <p className="text-xs text-slate-500 truncate max-w-[180px] font-mono opacity-80">{repo.url}</p>
          </div>
        </div>
        
        {/* Right: Unified Control Pill */}
        <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm gap-1">
            
            {/* Status Section */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              repo.status === 'connected' ? 'bg-green-50 text-green-700' : 
              repo.status === 'connecting' ? 'bg-blue-50 text-blue-700' :
              'bg-gray-50 text-slate-500'
            }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                     repo.status === 'connected' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 
                     repo.status === 'connecting' ? 'bg-blue-500 animate-pulse' :
                     'bg-slate-400'
                }`} />
                {repo.status === 'connected' ? 'Active' : repo.status === 'connecting' ? 'Connecting' : 'Offline'}
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-gray-200 mx-0.5"></div>

            {/* Actions Section */}
            <div className="flex items-center gap-0.5">
                {onEdit && (
                    <button 
                        onClick={() => onEdit(repo)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                        title="Edit Configuration"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                )}

                {onDelete && (
                    <button 
                        onClick={() => onDelete(repo)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                        title="Delete Configuration"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-5 p-3 bg-slate-50/50 rounded-lg border border-slate-100/50">
        <div className="flex items-center gap-2.5 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="truncate">{repo.lastBackup}</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-600">
          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium">{repo.size}</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-600 col-span-2">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span className="capitalize">{repo.encryption === 'none' ? 'No Encryption' : `${repo.encryption} encryption`}</span>
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
                  ? 'bg-white text-slate-600 border-gray-200 hover:bg-gray-50' 
                  : 'bg-slate-800 text-white border-transparent hover:bg-slate-700 shadow-sm'
              } disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {repo.status === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {repo.status === 'connected' ? 'Refresh Connection' : 'Connect'}
            </button>
            
            {repo.status === 'connected' && (
                <button 
                  onClick={() => onMount?.(repo)}
                  className="flex-1 px-3 py-2 text-xs font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-700 transition-colors shadow-sm"
                >
                  Mount Archive
                </button>
            )}
         </div>
         
         {/* Secondary / Maintenance Actions */}
         <div className="flex gap-2 pt-1">
             {onCheck && repo.status === 'connected' && (
                <button 
                   onClick={() => onCheck(repo)}
                   className="flex-1 px-3 py-1.5 text-[10px] font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 border border-transparent rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                   <ShieldCheck className="w-3 h-3" /> Verify Integrity
                </button>
             )}
             
             {onBreakLock && (
                 <button 
                   onClick={() => onBreakLock(repo)}
                   className="flex-1 px-3 py-1.5 text-[10px] font-medium text-slate-400 hover:text-orange-600 hover:bg-orange-50/50 border border-transparent rounded-lg transition-colors flex items-center justify-center gap-1.5"
                   title="Force break lock if repo is stuck"
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
