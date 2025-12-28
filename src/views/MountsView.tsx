
import React, { useState, useEffect } from 'react';
import { MountPoint, Repository, Archive } from '../types';
import Button from '../components/Button';
import { FolderOpen, XCircle, HardDrive, Terminal, Loader2, Copy } from 'lucide-react';

interface MountsViewProps {
  mounts: MountPoint[];
  repos: Repository[];
  archives: Archive[];
  onUnmount: (id: string) => void;
  onMount: (repoId: string, archiveName: string, path: string) => void;
  preselectedRepoId?: string | null;
}

const MountsView: React.FC<MountsViewProps> = ({ mounts, repos, archives, onUnmount, onMount, preselectedRepoId }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(repos[0]?.id || '');
  const [selectedArchive, setSelectedArchive] = useState(archives[0]?.name || '');
  const [mountPath, setMountPath] = useState('');
  const [useWsl, setUseWsl] = useState(false);
  
  // Available Windows drive letters
  const drives = "ZYXWVUTSRQPONMLKJIHGFEDCBA".split('').map(l => l + ':');

  useEffect(() => {
     // Check if WSL is enabled
     const wslEnabled = localStorage.getItem('winborg_use_wsl') === 'true';
     setUseWsl(wslEnabled);
     
     // USER REQUEST: Always use unique fixed path to avoid collisions
     // We use /mnt/wsl/winborg because /mnt/wsl is a tmpfs intended for sharing and is writable.
     // We append a random ID so we don't get "Directory not empty"
     if (wslEnabled) {
         // We'll update the path dynamically based on archive selection if we could, 
         // but for now just a unique base is good.
         const randomId = Math.random().toString(36).substring(2, 6);
         setMountPath(`/mnt/wsl/winborg/${randomId}`);
     } else {
         setMountPath('Z:');
     }

     // Handle Preselection from other views
     if (preselectedRepoId) {
        setIsCreating(true);
        setSelectedRepo(preselectedRepoId);
     } else if (!selectedRepo && repos.length > 0) {
        setSelectedRepo(repos[0].id);
     }

     // Auto-select first archive if available and none selected
     if (!selectedArchive && archives.length > 0) {
        setSelectedArchive(archives[0].name);
     } else if (archives.length > 0 && !archives.find(a => a.name === selectedArchive)) {
        // If current selection is not in list (e.g. list refreshed), pick first
        setSelectedArchive(archives[0].name);
     }
  }, [repos, archives, selectedRepo, selectedArchive, preselectedRepoId]);

  const handleMount = () => {
    onMount(selectedRepo, selectedArchive, mountPath);
    setIsCreating(false);
  };

  const handleOpenFolder = (path: string) => {
    // Basic heuristics: if it looks like a Linux path, try to open via \\wsl$
    if (path.startsWith('/')) {
        // Convert linux path to UNC path for Windows Explorer
        // Try generic \\wsl$ which is the root
        // If we knew the distro we could do \\wsl$\Ubuntu
        // But simply opening the path via `explorer.exe` inside WSL works too, 
        // however we are on Windows side.
        // Let's guess default distro (which is usually where wsl --exec runs)
        
        // Strategy: Open \\wsl.localhost\Ubuntu + path
        // We replace forward slashes with backslashes
        const relativePath = path.replace(/\//g, '\\');
        // NOTE: We try accessing the 'Ubuntu' distro by default. 
        // If user uses Debian, they might need to navigate manually.
        // We instruct the user on error.
        
        const uncPath = `\\\\wsl$\\Ubuntu${relativePath}`;
        
        try {
            // Send IPC to main to open
             (window as any).require('electron').ipcRenderer.send('open-path', uncPath);
        } catch(e) {
            alert(`Opening in Explorer: ${uncPath}\n\n(If this fails, open Explorer and type \\\\wsl$)`);
        }
    } else {
        // Windows drive
         try {
            (window as any).require('electron').ipcRenderer.send('open-path', path);
        } catch(e) {
            alert(`Opening ${path}`);
        }
    }
  };

  const currentRepoStatus = repos.find(r => r.id === selectedRepo)?.status;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Active Mounts</h1>
          <p className="text-slate-500 text-sm mt-1">Access your archives directly in {useWsl ? 'WSL / Windows' : 'File Explorer'}</p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? "secondary" : "primary"}>
          {isCreating ? "Cancel" : "New Mount"}
        </Button>
      </div>

      {isCreating && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
           <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">New Mount Configuration</h3>
                {useWsl && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">WSL Mode Active</span>}
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
               <label className="block text-xs font-medium text-slate-500 mb-1">Repository</label>
               <select 
                 className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                 value={selectedRepo}
                 onChange={(e) => setSelectedRepo(e.target.value)}
               >
                 {repos.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
               </select>
             </div>
             
             <div>
               <label className="block text-xs font-medium text-slate-500 mb-1 flex justify-between">
                   Archive
                   {currentRepoStatus === 'connecting' && <span className="text-blue-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Loading...</span>}
               </label>
               <select 
                 className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                 value={selectedArchive}
                 onChange={(e) => setSelectedArchive(e.target.value)}
                 disabled={currentRepoStatus === 'connecting' || archives.length === 0}
               >
                 {archives.length === 0 ? (
                     <option>No archives found (Connect first)</option>
                 ) : (
                     archives.map(a => <option key={a.id} value={a.name}>{a.name} ({a.time})</option>)
                 )}
               </select>
             </div>

             <div>
               <label className="block text-xs font-medium text-slate-500 mb-1">{useWsl ? 'WSL Mount Path' : 'Drive Letter'}</label>
               {useWsl ? (
                   <div className="flex gap-2">
                       <input 
                          type="text" 
                          className="w-full p-2 bg-white border border-gray-200 rounded-md text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={mountPath}
                          onChange={(e) => setMountPath(e.target.value)}
                          placeholder="/mnt/wsl/winborg/..."
                       />
                       <button 
                         className="p-2 text-slate-400 hover:text-slate-600" 
                         onClick={() => setMountPath(`/mnt/wsl/winborg/${Math.random().toString(36).substring(2, 6)}`)}
                         title="Generate new path"
                       >
                           <Loader2 className="w-4 h-4" />
                       </button>
                   </div>
               ) : (
                   <select 
                     className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                     value={mountPath}
                     onChange={(e) => setMountPath(e.target.value)}
                   >
                     {drives.map(l => <option key={l} value={l}>{l}</option>)}
                   </select>
               )}
               {useWsl && <p className="text-[10px] text-slate-400 mt-1">Unique folder to avoid conflicts.</p>}
             </div>
           </div>

           <div className="flex justify-end pt-2">
             <Button onClick={handleMount} disabled={!selectedArchive || currentRepoStatus === 'connecting' || archives.length === 0}>
                {currentRepoStatus === 'connecting' ? 'Loading Archives...' : 'Mount Archive'}
             </Button>
           </div>
        </div>
      )}

      <div className="space-y-3">
        {mounts.length === 0 && !isCreating && (
          <div className="text-center py-12 bg-white/50 rounded-xl border border-dashed border-gray-300">
            <HardDrive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No active mounts</p>
            <p className="text-slate-400 text-sm">Mount an archive to browse files</p>
          </div>
        )}

        {mounts.map(mount => {
          const repo = repos.find(r => r.id === mount.repoId);
          const isLinuxPath = mount.localPath.startsWith('/');
          
          return (
            <div key={mount.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between group">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    {isLinuxPath ? (
                        <Terminal className="text-blue-600 w-6 h-6" />
                    ) : (
                        <span className="font-bold text-blue-600 text-xl">{mount.localPath.replace(':', '')}</span>
                    )}
                 </div>
                 <div>
                    <h4 className="font-bold text-slate-800">{mount.archiveName}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                       <HardDrive className="w-3 h-3" />
                       Mounted at <span className="font-medium text-slate-700 font-mono bg-gray-50 px-1 rounded truncate max-w-[200px]" title={mount.localPath}>{mount.localPath}</span>
                    </p>
                 </div>
              </div>

              <div className="flex items-center gap-3">
                 <Button variant="secondary" size="sm" onClick={() => handleOpenFolder(mount.localPath)}>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Open
                 </Button>
                 <Button variant="danger" size="sm" onClick={() => onUnmount(mount.id)}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Unmount
                 </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MountsView;
