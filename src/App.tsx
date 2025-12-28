
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import RepositoriesView from './views/RepositoriesView';
import MountsView from './views/MountsView';
import SettingsView from './views/SettingsView';
import DashboardView from './views/DashboardView';
import ActivityView from './views/ActivityView';
import ArchivesView from './views/ArchivesView';
import TerminalModal from './components/TerminalModal';
import FuseSetupModal from './components/FuseSetupModal';
import { View, Repository, MountPoint, Archive, ActivityLogEntry } from './types';
import { MOCK_REPOS } from './constants';
import { borgService } from './services/borgService';
import { formatDate } from './utils/formatters';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  
  // --- STATE: REPOS ---
  const [repos, setRepos] = useState<Repository[]>(() => {
    const isInitialized = localStorage.getItem('winborg_initialized');
    const savedRepos = localStorage.getItem('winborg_repos');

    if (isInitialized) {
        if (savedRepos) {
            try {
                const parsed = JSON.parse(savedRepos);
                return parsed.map((r: Repository) => ({
                    ...r,
                    // RESET Connection: SSH connections die on app close
                    status: 'disconnected', 
                    // RESET Stuck Checks
                    checkStatus: r.checkStatus === 'running' ? 'idle' : r.checkStatus,
                    checkProgress: r.checkStatus === 'running' ? undefined : r.checkProgress,
                    activeCommandId: undefined
                }));
            } catch (e) {
                console.error("Failed to parse repos", e);
                return [];
            }
        }
        return [];
    } else {
        localStorage.setItem('winborg_initialized', 'true');
        return MOCK_REPOS;
    }
  });

  // --- STATE: ARCHIVES ---
  const [archives, setArchives] = useState<Archive[]>(() => {
    const savedArchives = localStorage.getItem('winborg_archives');
    return savedArchives ? JSON.parse(savedArchives) : [];
  });

  // --- STATE: MOUNTS ---
  const [mounts, setMounts] = useState<MountPoint[]>([]);
  const [preselectedRepoId, setPreselectedRepoId] = useState<string | null>(null);

  // --- STATE: ACTIVITY LOGS ---
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(() => {
      const saved = localStorage.getItem('winborg_activity');
      return saved ? JSON.parse(saved) : [];
  });
  
  // Persist State
  useEffect(() => { localStorage.setItem('winborg_repos', JSON.stringify(repos)); }, [repos]);
  useEffect(() => { localStorage.setItem('winborg_archives', JSON.stringify(archives)); }, [archives]);
  useEffect(() => { localStorage.setItem('winborg_activity', JSON.stringify(activityLogs)); }, [activityLogs]);

  // Helper to add activity
  const addActivity = (title: string, detail: string, status: 'success' | 'warning' | 'error' | 'info', cmd?: string) => {
      const newLog: ActivityLogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          title,
          detail,
          time: new Date().toISOString(),
          status,
          cmd
      };
      // Keep only last 100 logs to prevent lag
      setActivityLogs(prev => [newLog, ...prev].slice(0, 100));
  };

  // NEW: Listen for unexpected mount crashes to keep UI in sync
  useEffect(() => {
    try {
        const { ipcRenderer } = (window as any).require('electron');
        const handleMountExited = (_: any, { mountId, code }: { mountId: string, code: number }) => {
            console.log(`Mount ${mountId} exited with code ${code}`);
            // Remove from UI
            setMounts(prev => {
                const mount = prev.find(m => m.id === mountId);
                if (mount) {
                     addActivity('Mount Crashed', `Mount point ${mount.localPath} exited unexpectedly (Code ${code})`, 'error');
                }
                return prev.filter(m => m.id !== mountId);
            });
        };

        ipcRenderer.on('mount-exited', handleMountExited);
        return () => {
            ipcRenderer.removeListener('mount-exited', handleMountExited);
        };
    } catch (e) {
        console.warn("Could not attach mount-exited listener");
    }
  }, []);

  // Terminal State
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [terminalTitle, setTerminalTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // FUSE Help Modal State
  const [showFuseHelp, setShowFuseHelp] = useState(false);

  // Helper to run commands with terminal feedback
  const runCommand = async (
      title: string, 
      args: string[], 
      onSuccess?: (output: string) => void,
      overrides?: { passphrase?: string, disableHostCheck?: boolean }
  ) => {
    // SILENT MODE: Do not open terminal by default
    // setIsTerminalOpen(true); 
    setTerminalTitle(title);
    setTerminalLogs([]);
    setIsProcessing(true);

    let fullOutput = '';
    const success = await borgService.runCommand(args, (log) => {
        setTerminalLogs(prev => [...prev, log.trimEnd()]); 
        fullOutput += log;
    }, overrides);

    setIsProcessing(false);
    if (success) {
        if (onSuccess) onSuccess(fullOutput);
        // No need to close terminal if it wasn't open
    } else {
        setTerminalLogs(prev => [...prev, "Command failed. Please check the error above."]);
        // ERROR: Open terminal so user sees what happened
        setIsTerminalOpen(true);
    }
  };

  const handleMount = async (repoId: string, archiveName: string, path: string) => {
    const repo = repos.find(r => r.id === repoId);
    if (!repo) return;

    // SILENT MODE: Do not open terminal initially
    setTerminalTitle(`Mounting ${archiveName}`);
    setTerminalLogs([`Requesting mount of ${repo.url}::${archiveName} to ${path}...`]);
    setIsProcessing(true);
    
    // Log Start
    addActivity('Mount Requested', `Mounting ${archiveName} to ${path}`, 'info');

    // IMPORTANT: Pass the repository specific settings (passphrase, trustHost)
    const result = await borgService.mount(
        repo.url, 
        archiveName, 
        path, 
        (log) => {
            setTerminalLogs(prev => [...prev, log.trim()]);
        }, 
        {
            passphrase: repo.passphrase,
            disableHostCheck: repo.trustHost
        }
    );

    setIsProcessing(false);

    if (result.success) {
        addActivity('Mount Successful', `Archive ${archiveName} mounted at ${path}`, 'success');
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
        
        // AUTO OPEN EXPLORER ON SUCCESS
        try {
            const { ipcRenderer } = (window as any).require('electron');
            // If it's a linux path, convert for Explorer
            let explorerPath = path;
            if (path.startsWith('/')) {
                 explorerPath = `\\\\wsl$\\Ubuntu${path.replace(/\//g, '\\')}`;
            }
            ipcRenderer.send('open-path', explorerPath);
        } catch(e) { console.error("Could not auto-open explorer"); }
        
    } else {
        addActivity('Mount Failed', `Failed to mount ${archiveName}: ${result.error || 'Unknown error'}`, 'error');
        setTerminalLogs(prev => [...prev, "Failed to mount."]);
        
        // Open terminal on error so they can debug
        setIsTerminalOpen(true);

        // Check for specific FUSE error
        if (result.error === 'FUSE_MISSING') {
            setTimeout(() => {
                setIsTerminalOpen(false); // Close terminal to show helpful modal
                setShowFuseHelp(true);
            }, 500);
        }
    }
  };

  const handleUnmount = async (id: string) => {
    const mount = mounts.find(m => m.id === id);
    if (!mount) return;

    // SILENT MODE
    setTerminalTitle(`Unmounting ${mount.localPath}`);
    setIsProcessing(true);

    await borgService.unmount(mount.id, mount.localPath);
    
    addActivity('Unmount', `Unmounted ${mount.localPath}`, 'success');
    setMounts(prev => prev.filter(m => m.id !== id));
    setIsProcessing(false);
  };

  // Helper to robustly extract JSON from mixed output (stdout + stderr)
  const extractJson = (text: string) => {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start > -1 && end > start) {
          return text.substring(start, end + 1);
      }
      return text;
  };

  /**
   * Fetch specific stats (Size, Duration) for a single archive
   */
  const handleFetchArchiveStats = async (repo: Repository, archiveName: string) => {
     // Set specific archive to "loading" (optional UI enhancement, but for now we rely on async update)
     console.log(`Fetching stats for ${archiveName}...`);
     
     const stats = await borgService.getArchiveInfo(repo.url, archiveName, {
         passphrase: repo.passphrase,
         disableHostCheck: repo.trustHost
     });

     if (stats) {
         setArchives(prev => prev.map(a => 
             a.name === archiveName ? { ...a, size: stats.size, duration: stats.duration } : a
         ));
         addActivity('Archive Stats Updated', `Fetched stats for ${archiveName} (${stats.size})`, 'success', `borg info ${repo.url}::${archiveName}`);
     } else {
         addActivity('Stats Fetch Failed', `Could not get info for ${archiveName}`, 'warning');
     }
  };

  // Standard Connect (uses global settings)
  const handleConnect = (repo: Repository, overrides?: { passphrase?: string, disableHostCheck?: boolean }) => {
    setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, status: 'connecting' } : r));
    
    // Prefer repo-specific passphrase if available
    const effectivePassphrase = overrides?.passphrase || repo.passphrase;
    const effectiveHostCheck = overrides?.disableHostCheck !== undefined ? overrides.disableHostCheck : repo.trustHost;

    // Step 1: List Archives
    runCommand(
        `Connecting to ${repo.name}`, 
        ['list', '--json', repo.url], 
        (rawOutput) => {
            try {
                // Robust parsing: Strip SSH warnings/banners before the actual JSON
                const jsonString = extractJson(rawOutput);
                const data = JSON.parse(jsonString);
                
                const newArchives: Archive[] = data.archives.map((a: any) => ({
                    id: a.id || a.name,
                    name: a.name,
                    time: formatDate(a.time), // Format Date immediately
                    size: 'Unknown',
                    duration: 'Unknown'
                })).reverse();

                setArchives(newArchives);
                addActivity('Connection Successful', `Connected to ${repo.name} and retrieved ${newArchives.length} archives.`, 'success', `borg list ${repo.url}`);

                // AUTO-FETCH LATEST: Fetch info for the first archive automatically
                if (newArchives.length > 0) {
                    setTimeout(() => {
                        handleFetchArchiveStats(repo, newArchives[0].name);
                    }, 500);
                }

                setRepos(prev => prev.map(r => 
                r.id === repo.id ? { 
                    ...r, 
                    status: 'connected', 
                    lastBackup: newArchives[0]?.time || 'Never',
                    fileCount: newArchives.length 
                } : r
                ));

                // Step 2: Fetch Stats (Chain call)
                setTimeout(() => {
                     runCommand(
                        `Fetching Stats for ${repo.name}`,
                        ['info', '--json', repo.url],
                        (infoRawOutput) => {
                             try {
                                 const infoJson = extractJson(infoRawOutput);
                                 const infoData = JSON.parse(infoJson);
                                 
                                 // Parse stats
                                 const stats = infoData.cache?.stats || infoData.repository?.stats;
                                 let sizeStr = 'Unknown';
                                 
                                 if (stats && stats.unique_csize) {
                                     const gb = stats.unique_csize / 1024 / 1024 / 1024;
                                     sizeStr = gb.toFixed(2) + ' GB';
                                 }

                                 setRepos(prev => prev.map(r => 
                                    r.id === repo.id ? { ...r, size: sizeStr } : r
                                 ));
                             } catch(e) {
                                 console.warn("Could not parse info stats", e);
                             }
                        },
                        { passphrase: effectivePassphrase, disableHostCheck: effectiveHostCheck }
                     );
                }, 800);

            } catch (e) {
                console.error("Failed to parse Borg JSON", e);
                addActivity('Connection Failed', `Failed to parse response from ${repo.name}`, 'error');
                setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, status: 'error' } : r));
            }
        },
        { passphrase: effectivePassphrase, disableHostCheck: effectiveHostCheck }
    );
  };

  /**
   * Refresh the archives for the currently connected repo
   */
  const handleRefreshArchives = () => {
      const activeRepo = repos.find(r => r.status === 'connected');
      if (activeRepo) {
          handleConnect(activeRepo);
      }
  };

  /**
   * Run Integrity Check in BACKGROUND (Non-Blocking) with Progress
   */
  const handleCheckIntegrity = async (repo: Repository) => {
      // 1. Generate ID and Set Status to Running with 0 progress
      const commandId = `check-${repo.id}-${Date.now()}`;
      
      setRepos(prev => prev.map(r => r.id === repo.id ? { 
          ...r, 
          checkStatus: 'running', 
          checkProgress: 0,
          activeCommandId: commandId
      } : r));
      
      addActivity('Integrity Check Started', `Started deep consistency check on ${repo.name}`, 'info', `borg check --progress ${repo.url}`);
      console.log(`Starting background check for ${repo.name}... (ID: ${commandId})`);

      const progressCallback = (log: string) => {
         // Attempt to parse percentage from Borg output
         const matches = [...log.matchAll(/(\d+\.\d+|\d+)%/g)];
         
         if (matches.length > 0) {
             const lastMatch = matches[matches.length - 1];
             const progress = parseFloat(lastMatch[1]);
             if (!isNaN(progress)) {
                 setRepos(prev => prev.map(r => 
                     r.id === repo.id ? { ...r, checkProgress: progress } : r
                 ));
             }
         }
      };

      // 2. Run command using --progress AND passing commandId
      const success = await borgService.runCommand(
          ['check', '--progress', repo.url], 
          progressCallback,
          { 
              passphrase: repo.passphrase, 
              disableHostCheck: repo.trustHost,
              commandId: commandId 
          }
      );

      // 3. Update Status
      const timestamp = new Date().toLocaleString();
      
      setRepos(prev => {
          // Check if it was already aborted manually
          const current = prev.find(r => r.id === repo.id);
          if (current?.checkStatus === 'aborted') {
              return prev; // Don't overwrite aborted status
          }
          
          if (success) {
              addActivity('Integrity Check Passed', `Repository ${repo.name} verified successfully.`, 'success');
          } else {
              addActivity('Integrity Check Failed', `Consistency check failed for ${repo.name}. See terminal output.`, 'error');
          }

          return prev.map(r => r.id === repo.id ? { 
            ...r, 
            checkStatus: success ? 'ok' : 'error',
            checkProgress: success ? 100 : undefined,
            lastCheckTime: timestamp,
            activeCommandId: undefined // Clear ID
          } : r);
      });
  };

  const handleAbortCheck = async (repo: Repository) => {
      // Force UI cleanup even if ID is missing (fix for zombie states)
      setRepos(prev => prev.map(r => r.id === repo.id ? {
          ...r,
          checkStatus: 'aborted',
          checkProgress: undefined,
          activeCommandId: undefined
      } : r));
      
      addActivity('Integrity Check Aborted', `User manually cancelled check for ${repo.name}`, 'warning');

      if (repo.activeCommandId) {
          console.log(`Aborting check for ${repo.name} (ID: ${repo.activeCommandId})`);
          await borgService.stopCommand(repo.activeCommandId);
      }
  };
  
  /**
   * BREAK LOCK HANDLER
   * Runs 'borg break-lock' and then FORCE delete lock files
   */
  const handleBreakLock = async (repo: Repository) => {
      if(!window.confirm(`FORCE UNLOCK REPO:\n\n1. Run 'borg break-lock' to clear stale lock entries.\n2. Force delete 'lock.roster' and 'lock.exclusive' files from server via SSH.\n\nUse this only if the repo is definitely not in use!`)) {
          return;
      }

      // SILENT MODE: No terminal unless error
      setTerminalTitle(`Unlocking Repo: ${repo.name}`);
      setTerminalLogs([]);
      setIsProcessing(true);
      
      addActivity('Force Unlock Started', `Attempting to break lock on ${repo.name}`, 'warning');

      // Step 1: Standard Break Lock
      setTerminalLogs(prev => [...prev, "--- Step 1: Running borg break-lock ---"]);
      await borgService.breakLock(
          repo.url,
          (log) => setTerminalLogs(prev => [...prev, log.trim()]),
          { passphrase: repo.passphrase, disableHostCheck: repo.trustHost }
      );
      
      // Step 2: Force Delete Files
      setTerminalLogs(prev => [...prev, " ", "--- Step 2: Force deleting lock files (rm -rf) ---"]);
      const deleteSuccess = await borgService.forceDeleteLockFiles(
          repo.url,
          (log) => setTerminalLogs(prev => [...prev, log.trim()]),
          { passphrase: repo.passphrase, disableHostCheck: repo.trustHost }
      );

      setIsProcessing(false);
      
      if(deleteSuccess) {
          addActivity('Unlock Successful', `Lock files removed for ${repo.name}`, 'success');
          setTerminalLogs(prev => [...prev, " ", "✅ Lock files deleted successfully."]);
      } else {
          addActivity('Unlock Failed', `Could not delete lock files for ${repo.name}`, 'error');
          setTerminalLogs(prev => [...prev, " ", "❌ Failed to delete lock files. Check SSH permissions."]);
          // ERROR: Show terminal
          setIsTerminalOpen(true);
      }
  };

  /**
   * New Quick Mount: 
   * Instead of blindly mounting 'latest', we open the Mount UI 
   * and trigger a list command to fetch available archives.
   */
  const handleQuickMount = (repo: Repository) => {
    // 1. Switch to Mounts View and Preselect the repo
    setPreselectedRepoId(repo.id);
    setCurrentView(View.MOUNTS);
    
    // 2. Trigger connection to refresh archive list
    handleConnect(repo);
  };
  
  // Specific handler for mounting from Archives View (where we already have the archive name)
  const handleArchiveMount = (repo: Repository, archiveName: string) => {
      setPreselectedRepoId(repo.id);
      setCurrentView(View.MOUNTS);
      // We assume archives are already loaded if we are clicking from Archives view
      // But triggering connect doesn't hurt to ensure mount view has context
      if (repo.status !== 'connected') {
          handleConnect(repo);
      }
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
       fileCount: 0,
       passphrase: repoData.passphrase,
       trustHost: repoData.trustHost,
       checkStatus: 'idle',
       lastCheckTime: 'Never'
    };
    setRepos(prev => [...prev, newRepo]);
    addActivity('Repository Added', `Added configuration for ${repoData.name}`, 'info');
    
    // Auto try to connect using the provided credentials
    handleConnect(newRepo);
  };

  const handleEditRepo = (id: string, repoData: { name: string; url: string; encryption: 'repokey' | 'keyfile' | 'none', passphrase?: string, trustHost?: boolean }) => {
     setRepos(prev => prev.map(r => {
         if (r.id === id) {
             return {
                 ...r,
                 name: repoData.name,
                 url: repoData.url,
                 encryption: repoData.encryption,
                 passphrase: repoData.passphrase,
                 trustHost: repoData.trustHost,
                 // Reset status on edit to force reconnect logic
                 status: 'disconnected' as const
             };
         }
         return r;
     }));
     addActivity('Repository Edited', `Updated configuration for ${repoData.name}`, 'info');
  };

  const handleDeleteRepo = (repoId: string) => {
      if (window.confirm("Are you sure you want to remove this repository configuration?")) {
          setRepos(prev => prev.filter(r => r.id !== repoId));
          addActivity('Repository Deleted', `Removed repository configuration`, 'warning');
      }
  };

  const renderContent = () => {
    switch (currentView) {
      case View.REPOSITORIES:
        return (
          <RepositoriesView 
            repos={repos} 
            onAddRepo={handleAddRepo} 
            onEditRepo={handleEditRepo}
            onConnect={handleConnect}
            onMount={handleQuickMount}
            onCheck={handleCheckIntegrity}
            onBreakLock={handleBreakLock}
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
            preselectedRepoId={preselectedRepoId}
          />
        );
      case View.ARCHIVES:
        return (
            <ArchivesView 
                archives={archives} 
                repos={repos} 
                onMount={handleArchiveMount}
                onRefresh={handleRefreshArchives}
                onGetInfo={(archiveName) => {
                    const repo = repos.find(r => r.status === 'connected');
                    // Important: Return the promise so the view can await it
                    if(repo) return handleFetchArchiveStats(repo, archiveName);
                    return Promise.resolve();
                }}
            />
        );
      case View.SETTINGS:
        return <SettingsView />;
      case View.ACTIVITY:
        return (
            <ActivityView 
                logs={activityLogs} 
                onClearLogs={() => setActivityLogs([])} 
            />
        );
      case View.DASHBOARD:
      default:
        return (
           <DashboardView 
              repos={repos} 
              mounts={mounts}
              activityLogs={activityLogs}
              onQuickMount={handleQuickMount}
              onConnect={handleConnect}
              onCheck={handleCheckIntegrity}
              onChangeView={setCurrentView}
              onAbortCheck={handleAbortCheck}
           />
        );
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f3f3f3]">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden pt-9">
          <Sidebar 
            currentView={currentView} 
            onChangeView={(view) => {
                setCurrentView(view);
                // Reset preselection when manually changing views
                setPreselectedRepoId(null);
            }} 
          />
          
          <TerminalModal 
            isOpen={isTerminalOpen}
            title={terminalTitle}
            logs={terminalLogs}
            onClose={() => setIsTerminalOpen(false)}
            isProcessing={isProcessing}
          />
          
          <FuseSetupModal 
            isOpen={showFuseHelp} 
            onClose={() => setShowFuseHelp(false)} 
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
