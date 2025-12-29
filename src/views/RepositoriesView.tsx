import React, { useState, useEffect } from 'react';
import { Repository } from '../types';
import RepoCard from '../components/RepoCard';
import MaintenanceModal from '../components/MaintenanceModal';
import Button from '../components/Button';
import { Plus, Search, X, ShieldAlert, Key, Terminal, AlertCircle, FilePlus } from 'lucide-react';
import { borgService } from '../services/borgService';

interface RepositoriesViewProps {
  repos: Repository[];
  onAddRepo: (repoData: { name: string; url: string; encryption: 'repokey' | 'keyfile' | 'none', passphrase?: string, trustHost?: boolean }) => void;
  onEditRepo: (id: string, repoData: { name: string; url: string; encryption: 'repokey' | 'keyfile' | 'none', passphrase?: string, trustHost?: boolean }) => void;
  onConnect: (repo: Repository) => void;
  onMount: (repo: Repository) => void;
  onCheck: (repo: Repository) => void;
  onDelete: (repoId: string) => void;
  onBreakLock: (repo: Repository) => void;
}

const RepositoriesView: React.FC<RepositoriesViewProps> = ({ repos, onAddRepo, onEditRepo, onConnect, onMount, onCheck, onDelete, onBreakLock }) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRepoId, setEditingRepoId] = useState<string | null>(null);
  const [useWsl, setUseWsl] = useState(true);
  
  // Maintenance Modal State
  const [maintenanceRepo, setMaintenanceRepo] = useState<Repository | null>(null);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  // Terminal/Log Feedback for Maintenance
  // Local Log Viewer
  const [localLogData, setLocalLogData] = useState<{title: string, logs: string[]} | null>(null);
  
  const [repoForm, setRepoForm] = useState<{
    name: string;
    url: string;
    encryption: 'repokey' | 'keyfile' | 'none';
    passphrase?: string;
    trustHost: boolean;
    initialize: boolean; // NEW: Init flag
  }>({
    name: '',
    url: '',
    encryption: 'repokey',
    passphrase: '',
    trustHost: false,
    initialize: false
  });

  const [initProcessing, setInitProcessing] = useState(false);
  const [initLogs, setInitLogs] = useState<string[]>([]);

  // Check backend mode when modal opens
  useEffect(() => {
    if (isModalOpen) {
        const storedWsl = localStorage.getItem('winborg_use_wsl');
        setUseWsl(storedWsl === null ? true : storedWsl === 'true');
    }
  }, [isModalOpen]);

  const handleOpenAdd = () => {
      setRepoForm({ name: '', url: '', encryption: 'repokey', passphrase: '', trustHost: false, initialize: false });
      setEditingRepoId(null);
      setIsModalOpen(true);
      setInitLogs([]);
  };

  const handleOpenEdit = (repo: Repository) => {
      setRepoForm({
          name: repo.name,
          url: repo.url,
          encryption: repo.encryption,
          passphrase: repo.passphrase || '',
          trustHost: repo.trustHost || false,
          initialize: false
      });
      setEditingRepoId(repo.id);
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (repoForm.name && repoForm.url) {
        if (editingRepoId) {
            onEditRepo(editingRepoId, repoForm);
            setIsModalOpen(false);
        } else {
            // New Repo Logic
            if (repoForm.initialize) {
                // RUN BORG INIT
                setInitProcessing(true);
                setInitLogs(['Starting initialization...']);
                
                const success = await borgService.init(
                    repoForm.url,
                    repoForm.encryption,
                    (log) => setInitLogs(prev => [...prev, log]),
                    { passphrase: repoForm.passphrase, disableHostCheck: repoForm.trustHost }
                );

                setInitProcessing(false);
                if (success) {
                    // If successful, add to list and close
                    onAddRepo(repoForm);
                    setIsModalOpen(false);
                } else {
                    // Stay open to show error logs
                    setInitLogs(prev => [...prev, "❌ Initialization Failed. See logs above."]);
                }
            } else {
                // Just add config
                onAddRepo(repoForm);
                setIsModalOpen(false);
            }
        }
    }
  };

  const handleOpenMaintenance = (repo: Repository) => {
      setMaintenanceRepo(repo);
      setIsMaintenanceOpen(true);
  };

  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Maintenance Modal */}
      {maintenanceRepo && (
          <MaintenanceModal 
              repo={maintenanceRepo}
              isOpen={isMaintenanceOpen}
              onClose={() => setIsMaintenanceOpen(false)}
              onRefreshRepo={onConnect}
              onLog={(title, logs) => setLocalLogData({ title, logs })}
          />
      )}

      {/* Local Log Modal (Simple) */}
      {localLogData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-[#1e1e1e] w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="px-4 py-2 bg-[#2d2d2d] border-b border-black/20 flex justify-between items-center text-gray-300">
                      <span className="font-mono text-sm">{localLogData.title}</span>
                      <button onClick={() => setLocalLogData(null)}><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-1">
                      {localLogData.logs.map((l, i) => (
                          <div key={i} className="text-gray-300 break-all">{l}</div>
                      ))}
                  </div>
                  <div className="p-3 bg-[#2d2d2d] flex justify-end">
                      <Button size="sm" onClick={() => setLocalLogData(null)}>Close</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-black/5 flex flex-col max-h-[90vh]">
             <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/80 dark:bg-slate-900/50 shrink-0">
               <h3 className="font-semibold text-slate-800 dark:text-white">{editingRepoId ? 'Edit Repository' : 'Add New Repository'}</h3>
               <button onClick={() => setIsModalOpen(false)} disabled={initProcessing} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                 <X size={18} />
               </button>
             </div>
             
             <div className="p-6 space-y-4 overflow-y-auto flex-1">
               
               {/* INIT TOGGLE (Only for New Repos) */}
               {!editingRepoId && (
                   <div className={`border rounded-lg p-3 flex gap-3 transition-colors cursor-pointer ${
                       repoForm.initialize 
                       ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                       : 'bg-white border-gray-200 hover:border-blue-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-blue-700'
                   }`} onClick={() => setRepoForm({...repoForm, initialize: !repoForm.initialize})}>
                       <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center ${repoForm.initialize ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-slate-600'}`}>
                           {repoForm.initialize && <FilePlus className="w-3 h-3" />}
                       </div>
                       <div className="flex-1">
                           <span className="font-bold text-sm text-slate-800 dark:text-slate-200 block">Initialize new repository</span>
                           <span className="text-xs text-slate-500 dark:text-slate-400">Run <code>borg init</code> to create the repo structure on the server.</span>
                       </div>
                   </div>
               )}

               {/* Pre-Requisite Warning (Only if NOT initializing) */}
               {!editingRepoId && !repoForm.initialize && (
                   <div className="bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 rounded-lg p-3 flex gap-3">
                       <AlertCircle className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                       <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                           Assuming repository already exists. If not, check "Initialize" above.
                       </div>
                   </div>
               )}

               {/* Backend Indicator */}
               <div className="flex items-center gap-2 text-xs bg-slate-100 dark:bg-slate-700 p-2 rounded text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                   <Terminal className="w-3 h-3" />
                   <span>Backend: <strong>{useWsl ? "WSL (Ubuntu/Linux)" : "Windows Native"}</strong></span>
               </div>

               <div>
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Name</label>
                 <input 
                   type="text" 
                   autoFocus
                   className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 dark:text-white transition-all shadow-sm"
                   placeholder="My Remote Backup"
                   value={repoForm.name}
                   onChange={e => setRepoForm({...repoForm, name: e.target.value})}
                 />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">SSH Connection URL</label>
                 <input 
                   type="text" 
                   className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 dark:text-white font-mono transition-all shadow-sm"
                   placeholder="ssh://user@example.com:22/path/to/repo"
                   value={repoForm.url}
                   onChange={e => setRepoForm({...repoForm, url: e.target.value})}
                 />
                 <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Format: ssh://user@host:port/path/to/repo</p>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Encryption</label>
                     <div className="relative">
                        <select 
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 dark:text-white appearance-none shadow-sm"
                          value={repoForm.encryption}
                          onChange={e => setRepoForm({...repoForm, encryption: e.target.value as any})}
                        >
                          <option value="repokey">Repokey</option>
                          <option value="keyfile">Keyfile</option>
                          <option value="none">None</option>
                        </select>
                     </div>
                   </div>
                   
                   <div>
                     <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Passphrase</label>
                     <div className="relative">
                        <input 
                          type="password" 
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 dark:text-white shadow-sm"
                          placeholder={editingRepoId ? "Unchanged" : "Optional"}
                          value={repoForm.passphrase}
                          onChange={e => setRepoForm({...repoForm, passphrase: e.target.value})}
                        />
                     </div>
                   </div>
               </div>

               {/* SSH Options */}
               <div className="pt-2">
                 <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                     <div className="mt-0.5">
                        <input 
                            type="checkbox" 
                            id="trust-host" 
                            className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer bg-white dark:bg-slate-700"
                            checked={repoForm.trustHost}
                            onChange={(e) => setRepoForm({...repoForm, trustHost: e.target.checked})}
                        />
                     </div>
                     <div>
                         <label htmlFor="trust-host" className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">Trust Unknown SSH Host</label>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                             Fixes "Exit Code 1" on first connection.
                         </p>
                     </div>
                 </div>
               </div>

               {/* Logs for Initialization */}
               {initLogs.length > 0 && (
                   <div className="mt-4 bg-black rounded p-3 text-[10px] font-mono text-gray-300 max-h-32 overflow-y-auto">
                       {initLogs.map((l, i) => <div key={i}>{l}</div>)}
                   </div>
               )}

             </div>

             <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 shrink-0">
               <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={initProcessing} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">Cancel</Button>
               <Button onClick={handleSave} disabled={!repoForm.name || !repoForm.url || initProcessing} loading={initProcessing}>
                   {editingRepoId ? 'Save Changes' : (repoForm.initialize ? 'Initialize & Add' : 'Add Repository')}
               </Button>
             </div>
           </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Repositories</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your remote Borg repositories</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Repository
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text"
          placeholder="Search repositories..."
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-900 dark:text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRepos.map(repo => (
          <RepoCard 
            key={repo.id} 
            repo={repo} 
            onConnect={onConnect}
            onMount={onMount}
            onCheck={onCheck}
            onBreakLock={onBreakLock}
            onDelete={() => onDelete(repo.id)}
            onEdit={handleOpenEdit}
            onMaintenance={handleOpenMaintenance}
          />
        ))}
        {filteredRepos.length === 0 && (
            <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                <p className="text-slate-400 dark:text-slate-500">No repositories found.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default RepositoriesView;