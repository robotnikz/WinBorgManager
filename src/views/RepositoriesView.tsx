import React, { useState, useEffect } from 'react';
import { Repository } from '../types';
import RepoCard from '../components/RepoCard';
import Button from '../components/Button';
import { Plus, Search, X, ShieldAlert, Key, Terminal } from 'lucide-react';

interface RepositoriesViewProps {
  repos: Repository[];
  onAddRepo: (repoData: { name: string; url: string; encryption: 'repokey' | 'keyfile' | 'none', passphrase?: string, trustHost?: boolean }) => void;
  onEditRepo: (id: string, repoData: { name: string; url: string; encryption: 'repokey' | 'keyfile' | 'none', passphrase?: string, trustHost?: boolean }) => void;
  onConnect: (repo: Repository) => void;
  onMount: (repo: Repository) => void;
  onDelete: (repoId: string) => void;
}

const RepositoriesView: React.FC<RepositoriesViewProps> = ({ repos, onAddRepo, onEditRepo, onConnect, onMount, onDelete }) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRepoId, setEditingRepoId] = useState<string | null>(null);
  const [useWsl, setUseWsl] = useState(true);
  
  const [repoForm, setRepoForm] = useState<{
    name: string;
    url: string;
    encryption: 'repokey' | 'keyfile' | 'none';
    passphrase?: string;
    trustHost: boolean;
  }>({
    name: '',
    url: '',
    encryption: 'repokey',
    passphrase: '',
    trustHost: false
  });

  // Check backend mode when modal opens
  useEffect(() => {
    if (isModalOpen) {
        const storedWsl = localStorage.getItem('winborg_use_wsl');
        setUseWsl(storedWsl === null ? true : storedWsl === 'true');
    }
  }, [isModalOpen]);

  const handleOpenAdd = () => {
      setRepoForm({ name: '', url: '', encryption: 'repokey', passphrase: '', trustHost: false });
      setEditingRepoId(null);
      setIsModalOpen(true);
  };

  const handleOpenEdit = (repo: Repository) => {
      setRepoForm({
          name: repo.name,
          url: repo.url,
          encryption: repo.encryption,
          passphrase: repo.passphrase || '',
          trustHost: repo.trustHost || false
      });
      setEditingRepoId(repo.id);
      setIsModalOpen(true);
  };

  const handleSave = () => {
    if (repoForm.name && repoForm.url) {
        if (editingRepoId) {
            onEditRepo(editingRepoId, repoForm);
        } else {
            onAddRepo(repoForm);
        }
        setIsModalOpen(false);
    }
  };

  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-black/5">
             <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
               <h3 className="font-semibold text-slate-800">{editingRepoId ? 'Edit Repository' : 'Add New Repository'}</h3>
               <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                 <X size={18} />
               </button>
             </div>
             
             <div className="p-6 space-y-4">
               {/* Backend Indicator */}
               <div className="flex items-center gap-2 text-xs bg-slate-100 p-2 rounded text-slate-600 border border-slate-200">
                   <Terminal className="w-3 h-3" />
                   <span>Backend: <strong>{useWsl ? "WSL (Ubuntu/Linux)" : "Windows Native"}</strong></span>
                   <button 
                    onClick={() => {
                        // Allow quick toggle for troubleshooting
                        const newVal = !useWsl;
                        setUseWsl(newVal);
                        localStorage.setItem('winborg_use_wsl', String(newVal));
                    }}
                    className="ml-auto text-blue-600 hover:underline"
                   >
                       Change
                   </button>
               </div>

               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Name</label>
                 <input 
                   type="text" 
                   autoFocus
                   className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 transition-all shadow-sm"
                   placeholder="My Remote Backup"
                   value={repoForm.name}
                   onChange={e => setRepoForm({...repoForm, name: e.target.value})}
                 />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">SSH Connection URL</label>
                 <input 
                   type="text" 
                   className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 font-mono transition-all shadow-sm"
                   placeholder="ssh://user@hostname:22/path/to/repo"
                   value={repoForm.url}
                   onChange={e => setRepoForm({...repoForm, url: e.target.value})}
                 />
                 <p className="text-[10px] text-slate-400 mt-1">Format: ssh://user@host:port/path/to/repo</p>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Encryption</label>
                     <div className="relative">
                        <select 
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 appearance-none shadow-sm"
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
                     <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Passphrase</label>
                     <div className="relative">
                        <input 
                          type="password" 
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 shadow-sm"
                          placeholder="Optional"
                          value={repoForm.passphrase}
                          onChange={e => setRepoForm({...repoForm, passphrase: e.target.value})}
                        />
                     </div>
                   </div>
               </div>

               {/* SSH Options */}
               <div className="pt-2">
                 <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                     <div className="mt-0.5">
                        <input 
                            type="checkbox" 
                            id="trust-host" 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={repoForm.trustHost}
                            onChange={(e) => setRepoForm({...repoForm, trustHost: e.target.checked})}
                        />
                     </div>
                     <div>
                         <label htmlFor="trust-host" className="text-sm font-semibold text-slate-800 cursor-pointer">Trust Unknown SSH Host</label>
                         <p className="text-xs text-slate-500 mt-0.5">
                             Fixes "Exit Code 1" on first connection. Automatically accepts new SSH host keys (Disable Strict Host Check).
                         </p>
                     </div>
                 </div>
               </div>
             </div>

             <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
               <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
               <Button onClick={handleSave} disabled={!repoForm.name || !repoForm.url}>{editingRepoId ? 'Save Changes' : 'Add Repository'}</Button>
             </div>
           </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Repositories</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your remote Borg repositories</p>
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
          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-900"
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
            onDelete={() => onDelete(repo.id)}
            onEdit={handleOpenEdit}
          />
        ))}
        {filteredRepos.length === 0 && (
            <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-slate-400">No repositories found.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default RepositoriesView;