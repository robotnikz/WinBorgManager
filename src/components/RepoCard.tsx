
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
    <div className="bg-white rounded-xl border border-gray-200/75 p-5 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${repo.status === 'connected' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{repo.name}</h3>
            <p className="text-xs text-slate-500 truncate max-w-[200px]">{repo.url}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded-full text-xs font-medium border ${
              repo.status === 'connected' 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : repo.status === 'connecting'
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}>
              {repo.status === 'connected' ? 'Active' : repo.status === 'connecting' ? 'Connecting...' : 'Offline'}
            </div>
            
            {onEdit && (
                <button 
                    onClick={() => onEdit(repo)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Edit Repository"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
            )}

            {onDelete && (
                <button 
                    onClick={() => onDelete(repo)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete Repository"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>{repo.lastBackup}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <HardDrive className="w-4 h-4 text-slate-400" />
          <span>{repo.size} used</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Shield className="w-4 h-4 text-slate-400" />
          <span>{repo.encryption}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
         <div className="flex gap-2">
            <button 
              onClick={() => onConnect?.(repo)}
              disabled={repo.status === 'connecting'}
              className="flex-1 px-3 py-2 text-xs font-medium bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md text-slate-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {repo.status === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {repo.status === 'connected' ? 'Refresh' : 'Connect'}
            </button>
            {repo.status === 'connected' && (
                <button 
                  onClick={() => onMount?.(repo)}
                  className="flex-1 px-3 py-2 text-xs font-medium bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md text-blue-700 transition-colors"
                >
                  Mount
                </button>
            )}
         </div>
         
         <div className="flex gap-2">
             {onCheck && repo.status === 'connected' && (
                <button 
                   onClick={() => onCheck(repo)}
                   className="flex-1 px-3 py-1.5 text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                   <ShieldCheck className="w-3 h-3" /> Verify Integrity
                </button>
             )}
             
             {onBreakLock && (
                 <button 
                   onClick={() => onBreakLock(repo)}
                   className="flex-1 px-3 py-1.5 text-[10px] font-medium text-orange-500 hover:text-orange-700 hover:bg-orange-50 border border-transparent hover:border-orange-200 rounded-md transition-colors flex items-center justify-center gap-2"
                   title="Delete lock.roster and lock.exclusive to fix locked repo"
                >
                   <Unlock className="w-3 h-3" /> Unlock Repo
                </button>
             )}
         </div>
      </div>
    </div>
  );
};

export default RepoCard;
