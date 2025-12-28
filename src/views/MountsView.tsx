import React, { useState, useEffect } from 'react';
import { MountPoint, Repository, Archive } from '../types';
import Button from '../components/Button';
import { FolderOpen, XCircle, HardDrive, Terminal, Laptop } from 'lucide-react';

interface MountsViewProps {
  mounts: MountPoint[];
  repos: Repository[];
  archives: Archive[];
  onUnmount: (id: string) => void;
  onMount: (repoId: string, archiveName: string, path: string) => void;
}

const MountsView: React.FC<MountsViewProps> = ({ mounts, repos, archives, onUnmount, onMount }) => {
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
     
     // Use a unique path in /mnt/wsl which is robust and shareable
     const randomId = Math.floor(Math.random() * 9000) + 1000;
     setMountPath(wslEnabled ? `/mnt/wsl/winborg-${randomId}` : 'Z:');

     if (!selectedRepo && repos.length > 0) {
        setSelectedRepo(repos[0].id);
     }
     if (!selectedArchive && archives.length > 0) {
        setSelectedArchive(archives[0].name);
     }
  }, [repos, archives, selectedRepo, selectedArchive]);

  const handleMount = () => {
    onMount(selectedRepo, selectedArchive, mountPath);
    setIsCreating(false);
  };

  const handleOpenFolder = (path: string) => {
    // Basic heuristics: if it looks like a Linux path, try to open via \\wsl$
    // NOTE: This assumes 'Ubuntu' is the distro, ideally we'd store the distro name too.
    if (path.startsWith('/')) {
        // Alert user for now as we can't spawn explorer.exe directly from here easily without IPC extension
        alert(`Access this in Windows Explorer via: \\\\wsl$\\Ubuntu${path.replace(/\//g, '\\')}`);
    } else {
        // Windows drive
        alert(`Opening ${path}`);
    }
  };

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
               <label className="block text-xs font-medium text-slate-500 mb-1">Archive</label>
               <select 
                 className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                 value={selectedArchive}
                 onChange={(e) => setSelectedArchive(e.target.value)}
               >
                 {archives.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
               </select>
             </div>

             <div>
               <label className="block text-xs font-medium text-slate-500 mb-1">{useWsl ? 'WSL Mount Path' : 'Drive Letter'}</label>
               {useWsl ? (
                   <input 
                      type="text" 
                      className="w-full p-2 bg-white border border-gray-200 rounded-md text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={mountPath}
                      onChange={(e) => setMountPath(e.target.value)}
                      placeholder="/mnt/wsl/mybackup"
                   />
               ) : (
                   <select 
                     className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                     value={mountPath}
                     onChange={(e) => setMountPath(e.target.value)}
                   >
                     {drives.map(l => <option key={l} value={l}>{l}</option>)}
                   </select>
               )}
               {useWsl && <p className="text-[10px] text-slate-400 mt-1">Directory inside your WSL distro</p>}
             </div>
           </div>

           <div className="flex justify-end pt-2">
             <Button onClick={handleMount}>Mount Archive</Button>
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
                       Mounted at <span className="font-medium text-slate-700 font-mono bg-gray-50 px-1 rounded">{mount.localPath}</span>
                    </p>
                 </div>
              </div>

              <div className="flex items-center gap-3">
                 <Button variant="secondary" size="sm" onClick={() => handleOpenFolder(mount.localPath)}>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Info
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