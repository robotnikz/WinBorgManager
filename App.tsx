import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import RepositoriesView from './views/RepositoriesView';
import MountsView from './views/MountsView';
import SettingsView from './views/SettingsView';
import TerminalModal from './components/TerminalModal';
import { View, Repository, MountPoint, Archive } from './types';
import { MOCK_REPOS, MOCK_MOUNTS, MOCK_ARCHIVES } from './constants';
import { HardDrive } from 'lucide-react';
import { simulateBorgProcess } from './services/simulationService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  // Persist state in local storage simulation (optional, but good for "feeling real")
  const [repos, setRepos] = useState<Repository[]>(MOCK_REPOS);
  const [mounts, setMounts] = useState<MountPoint[]>(MOCK_MOUNTS);
  const [archives] = useState<Archive[]>(MOCK_ARCHIVES);

  // Simulation State
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [terminalTitle, setTerminalTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const runSimulation = async (title: string, command: string, onSuccess: () => void) => {
    setIsTerminalOpen(true);
    setTerminalTitle(title);
    setTerminalLogs([]);
    setIsProcessing(true);

    const success = await simulateBorgProcess(command, (log) => {
        setTerminalLogs(prev => [...prev, log]);
    });

    setIsProcessing(false);
    if (success) {
        onSuccess();
        // Auto close after 1 second of success
        setTimeout(() => setIsTerminalOpen(false), 1000);
    }
  };

  const handleMount = (repoId: string, archiveName: string, path: string) => {
    const repo = repos.find(r => r.id === repoId);
    const cmd = `borg mount ${repo?.url}::${archiveName} ${path}`;
    
    runSimulation(`Mounting ${archiveName}`, cmd, () => {
        const newMount: MountPoint = {
          id: Math.random().toString(36).substr(2, 9),
          repoId,
          archiveName,
          localPath: path,
          status: 'mounted',
        };
        setMounts(prev => [...prev, newMount]);
        setCurrentView(View.MOUNTS);
    });
  };

  const handleQuickMount = (repo: Repository) => {
    const latestArchive = archives[0]?.name || 'latest-snapshot';
    // Use Z: or Y: depending on what's free
    const drive = mounts.find(m => m.localPath === 'Z:') ? 'Y:' : 'Z:';
    handleMount(repo.id, latestArchive, drive);
  };

  const handleUnmount = (id: string) => {
    const mount = mounts.find(m => m.id === id);
    const cmd = `borg umount ${mount?.localPath}`;
    
    runSimulation(`Unmounting ${mount?.localPath}`, cmd, () => {
        setMounts(prev => prev.filter(m => m.id !== id));
    });
  };

  const handleConnect = (repo: Repository) => {
    const cmd = `borg list ${repo.url}`;
    
    runSimulation(`Connecting to ${repo.name}`, cmd, () => {
        setRepos(prev => prev.map(r => 
          r.id === repo.id ? { ...r, status: 'connected' as const } : r
        ));
    });
  };

  const handleAddRepo = (repoData: { name: string; url: string; encryption: 'repokey' | 'keyfile' | 'none' }) => {
    const newRepo: Repository = {
       id: Math.random().toString(36).substr(2, 9),
       name: repoData.name,
       url: repoData.url,
       lastBackup: 'Never',
       encryption: repoData.encryption,
       status: 'disconnected',
       size: '0 B',
       fileCount: 0
    };
    setRepos(prev => [...prev, newRepo]);
  };

  const renderContent = () => {
    switch (currentView) {
      case View.REPOSITORIES:
        return (
          <RepositoriesView 
            repos={repos} 
            onAddRepo={handleAddRepo} 
            onConnect={handleConnect}
            onMount={handleQuickMount}
          />
        );
      case View.MOUNTS:
        return (
          <MountsView 
            mounts={mounts} 
            repos={repos} 
            archives={archives}
            onUnmount={handleUnmount} 
            onMount={handleMount} 
          />
        );
      case View.SETTINGS:
        return <SettingsView />;
      case View.DASHBOARD:
      default:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="mb-8">
               <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
               <p className="text-slate-500">Overview of your backup infrastructure</p>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
                   <div className="opacity-80 text-sm font-medium mb-1">Total Protected Data</div>
                   <div className="text-4xl font-bold">1.65 TB</div>
                   <div className="mt-4 text-sm bg-white/20 inline-block px-3 py-1 rounded-full">
                      +12GB this week
                   </div>
                </div>
                
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                   <div className="text-slate-500 text-sm font-medium mb-1">Active Mounts</div>
                   <div className="text-4xl font-bold text-slate-800">{mounts.length}</div>
                   <div className="mt-4 text-xs text-slate-400">
                      Filesystem accessible
                   </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                   <div className="text-slate-500 text-sm font-medium mb-1">Repositories</div>
                   <div className="text-4xl font-bold text-slate-800">{repos.length}</div>
                   <div className="mt-4 text-xs text-green-500 font-medium">
                      All systems operational
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4">Recent Activity</h3>
                <div className="space-y-4">
                   {[1,2,3].map((i) => (
                      <div key={i} className="flex items-center gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                         <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <HardDrive className="w-5 h-5" />
                         </div>
                         <div className="flex-1">
                            <div className="text-sm font-medium text-slate-800">Backup verification successful</div>
                            <div className="text-xs text-slate-500">Hetzner StorageBox • 2 hours ago</div>
                         </div>
                         <div className="text-xs font-mono text-slate-400">ID: a7b2...</div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f3f3f3]">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      {/* Simulation Terminal Overlay */}
      <TerminalModal 
        isOpen={isTerminalOpen}
        title={terminalTitle}
        logs={terminalLogs}
        onClose={() => setIsTerminalOpen(false)}
        isProcessing={isProcessing}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="h-8 w-full drag-region" />
        
        <div className="flex-1 overflow-y-auto p-8 pt-4">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
