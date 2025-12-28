import React, { useState, useEffect } from 'react';
import { MountPoint, Repository, Archive } from '../types';
import Button from '../components/Button';
import { FolderOpen, XCircle, HardDrive, Terminal, Loader2, Info } from 'lucide-react';

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
  const [commandPreview, setCommandPreview] = useState('');
  
  // ALWAYS DEFAULT TO TRUE FOR WSL AS REQUESTED
  const [useWsl, setUseWsl] = useState(true);
  
  // Initialize state based on props and config
  useEffect(() => {
     const storedWsl = localStorage.getItem('winborg_use_wsl');
     // Default to TRUE if not set, or if set to true
     setUseWsl(storedWsl === null ? true : storedWsl === 'true');

     // Handle Preselection
     if (preselectedRepoId) {
        setIsCreating(true);
        setSelectedRepo(preselectedRepoId);
     } else if (!selectedRepo && repos.length > 0) {
        setSelectedRepo(repos[0].id);
     }

     // Handle Archive Selection
     if (!selectedArchive && archives.length > 0) {
        setSelectedArchive(archives[0].name);
     } else if (archives.length > 0 && !archives.find(a => a.name === selectedArchive)) {
        setSelectedArchive(archives[0].name);
     }
  }, [repos, archives, selectedRepo, selectedArchive, preselectedRepoId]);

  // Effect to generate command preview locally (No AI needed)
  useEffect(() => {
    if (isCreating) {
      const repo = repos.find(r => r.id === selectedRepo);
      if (repo) {
        // Internal Linux Path logic for preview
        const archiveNameClean = selectedArchive.replace(/[^a-zA-Z0-9._-]/g, '_');
        const internalPath = `/mnt/wsl/winborg/${archiveNameClean}`;
        
        // Simple command construction
        const cmd = `borg mount -o allow_other ${repo.url}::${selectedArchive} ${internalPath}`;
        setCommandPreview(cmd);
      }
    }
  }, [isCreating, selectedRepo, selectedArchive, repos]);

  const handleMount = () => {
    // FORCE PATH LOGIC:
    // If WSL: /mnt/wsl/winborg/<ArchiveName>
    // If Windows Native (Fallback): Z:
    let finalPath = 'Z:';
    
    if (useWsl) {
        // CLEANUP ARCHIVE NAME FOR PATH (remove timestamp parts if messy)
        const archiveNameClean = selectedArchive.replace(/[^a-zA-Z0-9._-]/g, '_');
        finalPath = `/mnt/wsl/winborg/${archiveNameClean}`;
    }

    onMount(selectedRepo, selectedArchive, finalPath);
    setIsCreating(false);
  };

  const handleOpenFolder = (path: string) => {
    try {
        const { ipcRenderer } = (window as any).require('electron');
        
        let pathToSend = path;
        
        // Transform Linux WSL path to Windows UNC path for standard Ubuntu
        if (path.startsWith('/')) {
             // 1. Convert forward slashes to backslashes
             const windowsStyle = path.replace(/\//g, '\\');
             // 2. Prepend the WSL network path for Ubuntu
             // Result: \\wsl.localhost\Ubuntu\mnt\wsl\winborg\archive_name
             pathToSend = `\\\\wsl.localhost\\Ubuntu${windowsStyle}`;
        }

        console.log("Opening Path:", pathToSend);
        ipcRenderer.send('open-path', pathToSend);
    } catch(e) {
        alert(`Could not open path: ${path}`);
    }
  };

  const currentRepoStatus = repos.find(r => r.id === selectedRepo)?.status;
  
  // Dynamic Preview for the UI
  // Note: We display the internal Linux path for tech correctness, but show the UNC hint below
  const internalPath = useWsl 
    ? `/mnt/wsl/winborg/${selectedArchive || '...'}` 
    : 'Z:';

  const explorerPathHint = useWsl 
    ? `\\\\wsl.localhost\\Ubuntu${internalPath.replace(/\//g, '\\')}`
    : internalPath;

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
           
           {/* 2 Column Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="block text-xs font-medium text-slate-500 mb-1">Repository</label>
               <select 
                 className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                 className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
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
           </div>

           {/* Info Banner showing the path */}
           <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
               <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
               <div className="flex-1 font-mono text-xs break-all">
                   <div className="mb-1"><strong>Mount Point (Linux):</strong> {internalPath}</div>
                   <div><strong>Windows Explorer:</strong> {explorerPathHint}</div>
               </div>
           </div>
           
           {/* Command Preview Box */}
           <div className="mt-2 bg-slate-900 rounded-md p-3 font-mono text-xs text-green-400 overflow-x-auto">
              <div className="flex items-center gap-2 mb-2 text-slate-400 border-b border-slate-700 pb-1">
                 <Terminal className="w-3 h-3" />
                 <span>Command Preview</span>
              </div>
              {commandPreview}
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
              <div className="flex items-center gap-4 min-w-0">
                 <div className="w-12 h-12 bg-blue-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                    {isLinuxPath ? (
                        <Terminal className="text-blue-600 w-6 h-6" />
                    ) : (
                        <span className="font-bold text-blue-600 text-xl">{mount.localPath.replace(':', '')}</span>
                    )}
                 </div>
                 <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 truncate" title={mount.archiveName}>{mount.archiveName}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                       <HardDrive className="w-3 h-3 flex-shrink-0" />
                       Mounted at <span className="font-medium text-slate-700 font-mono bg-gray-50 px-1 rounded truncate max-w-[250px]" title={mount.localPath}>{mount.localPath}</span>
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