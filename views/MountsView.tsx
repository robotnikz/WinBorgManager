import React, { useState, useEffect } from 'react';
import { MountPoint, Repository, Archive } from '../types';
import Button from '../components/Button';
import { FolderOpen, XCircle, HardDrive, Terminal } from 'lucide-react';
import { generateBorgCommand } from '../services/geminiService';

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
  const [mountPath, setMountPath] = useState('Z:');
  const [commandPreview, setCommandPreview] = useState('');

  // Update selected repo if repos list changes (e.g. initial load or add)
  useEffect(() => {
     if (!selectedRepo && repos.length > 0) {
        setSelectedRepo(repos[0].id);
     }
  }, [repos, selectedRepo]);

  // Effect to generate command preview via Gemini
  useEffect(() => {
    if (isCreating) {
      const repo = repos.find(r => r.id === selectedRepo);
      if (repo) {
        generateBorgCommand('mount', {
          repoUrl: repo.url,
          mountPoint: mountPath,
          archive: selectedArchive
        }).then(setCommandPreview);
      }
    }
  }, [isCreating, selectedRepo, selectedArchive, mountPath, repos]);

  const handleMount = () => {
    onMount(selectedRepo, selectedArchive, mountPath);
    setIsCreating(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Active Mounts</h1>
          <p className="text-slate-500 text-sm mt-1">Access your archives directly in File Explorer</p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? "secondary" : "primary"}>
          {isCreating ? "Cancel" : "New Mount"}
        </Button>
      </div>

      {isCreating && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
           <h3 className="font-semibold text-slate-800">New Mount Configuration</h3>
           
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
               <label className="block text-xs font-medium text-slate-500 mb-1">Drive Letter</label>
               <select 
                 className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                 value={mountPath}
                 onChange={(e) => setMountPath(e.target.value)}
               >
                 {['X:', 'Y:', 'Z:', 'M:', 'B:'].map(l => <option key={l} value={l}>{l}</option>)}
               </select>
             </div>
           </div>

           {/* Command Preview Box */}
           <div className="mt-4 bg-slate-900 rounded-md p-3 font-mono text-xs text-green-400 overflow-x-auto">
              <div className="flex items-center gap-2 mb-2 text-slate-400 border-b border-slate-700 pb-1">
                 <Terminal className="w-3 h-3" />
                 <span>Generated Command (Preview)</span>
              </div>
              {commandPreview || 'Generating command...'}
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
          return (
            <div key={mount.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between group">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="font-bold text-blue-600 text-xl">{mount.localPath.replace(':', '')}</span>
                 </div>
                 <div>
                    <h4 className="font-bold text-slate-800">{mount.archiveName}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                       <HardDrive className="w-3 h-3" />
                       Mounted from <span className="font-medium text-slate-700">{repo?.name || 'Unknown Repo'}</span>
                    </p>
                 </div>
              </div>

              <div className="flex items-center gap-3">
                 <Button variant="secondary" size="sm" onClick={() => alert("Opening File Explorer for " + mount.localPath)}>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Browse
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