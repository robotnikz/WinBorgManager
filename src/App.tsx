import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import RepositoriesView from './views/RepositoriesView';
import MountsView from './views/MountsView';
import SettingsView from './views/SettingsView';
import TerminalModal from './components/TerminalModal';
import { View, Repository, MountPoint, Archive } from './types';
import { MOCK_REPOS, MOCK_ARCHIVES } from './constants';
import { HardDrive } from 'lucide-react';
import { borgService } from './services/borgService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  
  // LOGIC FIX: Persistence
  const [repos, setRepos] = useState<Repository[]>(() => {
    const isInitialized = localStorage.getItem('winborg_initialized');
    const savedRepos = localStorage.getItem('winborg_repos');

    if (isInitialized) {
        return savedRepos ? JSON.parse(savedRepos) : [];
    } else {
        localStorage.setItem('winborg_initialized', 'true');
        return MOCK_REPOS;
    }
  });

  const [mounts, setMounts] = useState<MountPoint[]>([]);
  const [archives, setArchives] = useState<Archive[]>([]);
  
  // Persist Repos when they change
  useEffect(() => {
    localStorage.setItem('winborg_repos', JSON.stringify(repos));
  }, [repos]);

  // Terminal State
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [terminalTitle, setTerminalTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper to run commands with terminal feedback
  const runCommand = async (
      title: string, 
      args: string[], 
      onSuccess?: (output: string) => void,
      overrides?: { passphrase?: string, disableHostCheck?: boolean }
  ) => {
    setIsTerminalOpen(true);
    setTerminalTitle(title);
    setTerminalLogs([]);
    setIsProcessing(true);

    let fullOutput = '';
    const success = await borgService.runCommand(args, (log) => {
        const cleanLog = log.trim();
        setTerminalLogs(prev => [...prev, cleanLog]);
        fullOutput += cleanLog;
    }, overrides);

    setIsProcessing(false);
    if (success) {
        if (onSuccess) onSuccess(fullOutput);
        setTimeout(() => setIsTerminalOpen(false), 1000);
    } else {
        setTerminalLogs(prev => [...prev, "Command failed. Please check the error above."]);
    }
  };

  const handleMount = async (repoId: string, archiveName: string, path: string) => {
    const repo = repos.find(r => r.id === repoId);
    if (!repo) return;

    setIsTerminalOpen(true);
    setTerminalTitle(`Mounting ${archiveName}`);
    setTerminalLogs([`Requesting mount of ${repo.url}::${archiveName} to ${path}...`]);
    setIsProcessing(true);

    const result = await borgService.mount(repo.url, archiveName, path, (log) => {
         setTerminalLogs(prev => [...prev, log.trim()]);
    });

    setIsProcessing(false);

    if (result.success) {
        setTerminalLogs(prev => [...prev, "Mount process started successfully."]);
        const newMount: MountPoint = {
          id: result.mountId || Date.now().toString(),
          repoId,
          archiveName,
          localPath: path,
          status: 'mounted',
        };
        setMounts(prev => [...prev, newMount]);
        setCurrentView(View.MOUNTS);
        setTimeout(() => setIsTerminalOpen(false), 1000);
    } else {
        setTerminalLogs(prev => [...prev, "Failed to mount."]);
    }
  };

  const handleQuickMount = (repo: Repository) => {
    const latestArchive = archives.length > 0 ? archives[0].name : 'latest';
    const usedDrives = mounts.map(m => m.localPath);
    const driveLetters = ['Z:', 'Y:', 'X:', 'W:', 'V:'];
    const drive = driveLetters.find(d => !usedDrives.includes(d)) || 'Z:';
    
    const isWsl = localStorage.getItem('winborg_use_wsl') === 'true';
    const mountPath = isWsl ? `/mnt/wsl/borg-${repo.name.replace(/\s+/g, '-')}` : drive;

    handleMount(repo.id, latestArchive, mountPath);
  };

  const handleUnmount = async (id: string) => {
    const mount = mounts.find(m => m.id === id);
    if (!mount) return;

    setIsTerminalOpen(true);
    setTerminalTitle(`Unmounting ${mount.localPath}`);
    setIsProcessing(true);

    await borgService.unmount(mount.id, mount.localPath);
    
    setMounts(prev => prev.filter(m => m.id !== id));
    setIsProcessing(false);
    setTimeout(() => setIsTerminalOpen(false), 500);
  };

  // Standard Connect (uses global settings)
  const handleConnect = (repo: Repository, overrides?: { passphrase?: string, disableHostCheck?: boolean }) => {
    setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, status: 'connecting' } : r));

    runCommand(
        `Connecting to ${repo.name}`, 
        ['list', '--json', repo.url], 
        (jsonOutput) => {
            try {
                const jsonStartIndex = jsonOutput.indexOf('{');
                const jsonString = jsonStartIndex > -1 ? jsonOutput.substring(jsonStartIndex) : jsonOutput;
                const data = JSON.parse(jsonString);
                
                const newArchives: Archive[] = data.archives.map((a: any) => ({
                    id: a.id || a.name,
                    name: a.name,
                    time: a.time,
                    size: 'Unknown',
                    duration: 'Unknown'
                })).reverse();

                setArchives(newArchives);

                setRepos(prev => prev.map(r => 
                r.id === repo.id ? { 
                    ...r, 
                    status: 'connected', 
                    lastBackup: newArchives[0]?.time || 'Never',
                    fileCount: newArchives.length 
                } : r
                ));
            } catch (e) {
                console.error("Failed to parse Borg JSON", e);
                setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, status: 'error' } : r));
            }
        },
        overrides // Pass specific overrides (password/ssh) if provided
    );
  };

  const handleAddRepo = (repoData: { name: string; url: string; encryption: 'repokey' | 'keyfile' | 'none', passphrase?: string, trustHost?: boolean }) => {
    const newRepo: Repository = {
       id: Math.random().toString(36).substr(2, 9),
       name: repoData.name,
       url: repoData.url,
       lastBackup: 'Never',
       encryption: repoData.encryption,
       status: 'disconnected',
       size: 'Unknown',
       fileCount: 0
    };
    setRepos(prev => [...prev, newRepo]);
    
    // Auto try to connect using the provided credentials
    handleConnect(newRepo, {
        passphrase: repoData.passphrase,
        disableHostCheck: repoData.trustHost
    });
  };

  const handleDeleteRepo = (repoId: string) => {
      if (window.confirm("Are you sure you want to remove this repository configuration?")) {
          setRepos(prev => prev.filter(r => r.id !== repoId));
      }
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
            onDelete={handleDeleteRepo}
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
               <p className="text-slate-500">System Status</p>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
                   <div className="opacity-80 text-sm font-medium mb-1">Total Repositories</div>
                   <div className="text-4xl font-bold">{repos.length}</div>
                </div>
                
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                   <div className="text-slate-500 text-sm font-medium mb-1">Active Mounts</div>
                   <div className="text-4xl font-bold text-slate-800">{mounts.length}</div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                   <div className="text-slate-500 text-sm font-medium mb-1">Loaded Archives</div>
                   <div className="text-4xl font-bold text-slate-800">{archives.length}</div>
                   <div className="text-xs text-slate-400 mt-2">From last connection</div>
                </div>
             </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f3f3f3]">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden pt-9">
          <Sidebar currentView={currentView} onChangeView={setCurrentView} />
          
          <TerminalModal 
            isOpen={isTerminalOpen}
            title={terminalTitle}
            logs={terminalLogs}
            onClose={() => setIsTerminalOpen(false)}
            isProcessing={isProcessing}
          />

          <main className="flex-1 flex flex-col h-full overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-8 pt-4">
               {renderContent()}
            </div>
          </main>
      </div>
    </div>
  );
};

export default App;