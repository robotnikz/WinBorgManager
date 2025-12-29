
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
import CreateBackupModal from './components/CreateBackupModal';
import { View, Repository, MountPoint, Archive, ActivityLogEntry, BackupJob } from './types';
import { borgService } from './services/borgService';
import { formatDate } from './utils/formatters';
import { ToastContainer } from './components/ToastContainer';
import { toast } from './utils/eventBus';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  
  // --- THEME STATE ---
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
      const saved = localStorage.getItem('winborg_theme');
      return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
      localStorage.setItem('winborg_theme', isDarkMode ? 'dark' : 'light');
      if (isDarkMode) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- INITIALIZE SETTINGS SYNC ---
  useEffect(() => {
      // Sync the Close-to-Tray setting to main process on startup
      const storedCloseToTray = localStorage.getItem('winborg_close_to_tray') === 'true';
      try {
          const { ipcRenderer } = (window as any).require('electron');
          ipcRenderer.send('set-close-behavior', storedCloseToTray);
      } catch(e) {}
  }, []);

  // --- STATE: REPOS ---
  const [repos, setRepos] = useState<Repository[]>(() => {
    const isInitialized = localStorage.getItem('winborg_initialized');
    const savedRepos = localStorage.getItem('winborg_repos');

    if (isInitialized) {
        if (savedRepos) {
            try {
                const parsed = JSON.parse(savedRepos);
                // Sanitize: ensure no passphrase fields are ever loaded from old localstorage
                return parsed.map((r: Repository) => ({
                    ...r,
                    passphrase: undefined, // SECURITY: Never keep plain text in state
                    status: 'disconnected', 
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
        return [];
    }
  });

  // --- STATE: JOBS ---
  const [jobs, setJobs] = useState<BackupJob[]>(() => {
      const savedJobs = localStorage.getItem('winborg_jobs');
      if (savedJobs) {
          try {
              return JSON.parse(savedJobs).map((j: BackupJob) => ({
                  ...j,
                  status: 'idle' // Reset status on load
              }));
          } catch(e) { return []; }
      }
      return [];
  });

  // --- STATE: ARCHIVES ---
  const [archives, setArchives] = useState<Archive[]>(() => {
    const savedArchives = localStorage.getItem('winborg_archives');
    return savedArchives ? JSON.parse(savedArchives) : [];
  });

  // --- STATE: MOUNTS ---
  const [mounts, setMounts] = useState<MountPoint[]>([]);
  const [preselectedRepoId, setPreselectedRepoId] = useState<string | null>(null);

  // --- MODAL STATES FOR DASHBOARD ACCESS ---
  const [backupRepo, setBackupRepo] = useState<Repository | null>(null);

  // --- STATE: ACTIVITY LOGS ---
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(() => {
      const saved = localStorage.getItem('winborg_activity');
      return saved ? JSON.parse(saved) : [];
  });
  
  // Persist State
  useEffect(() => { 
      // Security: Strip passphrases (if any accidentally exist) before saving
      const safeRepos = repos.map(r => {
          const { passphrase, ...safe } = r;
          return safe;
      });
      localStorage.setItem('winborg_repos', JSON.stringify(safeRepos)); 
  }, [repos]);

  useEffect(() => { localStorage.setItem('winborg_archives', JSON.stringify(archives)); }, [archives]);
  useEffect(() => { localStorage.setItem('winborg_activity', JSON.stringify(activityLogs)); }, [activityLogs]);
  useEffect(() => { localStorage.setItem('winborg_jobs', JSON.stringify(jobs)); }, [jobs]);

  // --- SYNC SCHEDULER (New) ---
  useEffect(() => {
      try {
          const { ipcRenderer } = (window as any).require('electron');
          // Only send safe repo data (no sensitive flags if any existed, though we sanitized already)
          const safeRepos = repos.map(r => ({ id: r.id, url: r.url, name: r.name }));
          ipcRenderer.send('sync-scheduler-data', { jobs, repos: safeRepos });
      } catch(e) {}
  }, [jobs, repos]);

  // --- BACKGROUND LISTENER (New) ---
  useEffect(() => {
      try {
          const { ipcRenderer } = (window as any).require('electron');
          
          // Listen for background job completions to refresh UI state
          const handleJobComplete = (_: any, jobId: string) => {
              setJobs(prev => prev.map(j => j.id === jobId ? { ...j, lastRun: new Date().toISOString(), status: 'success' } : j));
              // Also refresh activity log via the generic activity-log listener below
          };

          const handleActivityLog = (_: any, log: ActivityLogEntry) => {
              // Add ID and Time if missing from backend
              const newLog: ActivityLogEntry = {
                  id: Math.random().toString(36).substr(2, 9),
                  time: new Date().toISOString(),
                  ...log
              };
              setActivityLogs(prev => [newLog, ...prev].slice(0, 100));
              
              if(log.status === 'success') toast.success(log.title);
              if(log.status === 'error') toast.error(log.title);
          };

          ipcRenderer.on('job-complete', handleJobComplete);
          ipcRenderer.on('activity-log', handleActivityLog);

          return () => {
              ipcRenderer.removeListener('job-complete', handleJobComplete);
              ipcRenderer.removeListener('activity-log', handleActivityLog);
          };
      } catch(e) {}
  }, []);

  // --- TASKBAR PROGRESS ---
  useEffect(() => {
      // Find max progress of any running check
      const runningRepo = repos.find(r => r.checkStatus === 'running');
      try {
          const { ipcRenderer } = (window as any).require('electron');
          if (runningRepo && runningRepo.checkProgress !== undefined) {
              ipcRenderer.send('set-progress', runningRepo.checkProgress / 100);
          } else {
              ipcRenderer.send('set-progress', -1); // Remove
          }
      } catch(e) {}
  }, [repos]);

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
      setActivityLogs(prev => [newLog, ...prev].slice(0, 100));
  };

  // Helper to check lock status for a repo
  const checkRepoLock = async (repo: Repository) => {
      if(!repo.url) return;
      const isLocked = await borgService.checkLockStatus(repo.url, { disableHostCheck: repo.trustHost });
      setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, isLocked } : r));
  };

  // INITIAL LOAD
  useEffect(() => {
      repos.forEach(repo => checkRepoLock(repo));
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Mount Listener
  useEffect(() => {
    try {
        const { ipcRenderer } = (window as any).require('electron');
        const handleMountExited = (_: any, { mountId, code }: { mountId: string, code: number }) => {
            console.log(`Mount ${mountId} exited with code ${code}`);
            
            const affectedMount = mounts.find(m => m.id === mountId);
            if(affectedMount) {
                const repo = repos.find(r => r.id === affectedMount.repoId);
                if(repo) setTimeout(() => checkRepoLock(repo), 1000);
            }

            setMounts(prev => {
                const mount = prev.find(m => m.id === mountId);
                if (mount) {
                     addActivity('Mount Crashed', `Mount point ${mount.localPath} exited unexpectedly (Code ${code})`, 'error');
                     toast.error(`Mount exited unexpectedly: ${mount.archiveName}`);
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
  }, [mounts, repos]);

  // Terminal State
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [terminalTitle, setTerminalTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFuseHelp, setShowFuseHelp] = useState(false);

  // Helper to run commands (UPDATED for Secure Backend Injection)
  const runCommand = async (
      title: string, 
      args: string[], 
      onSuccess?: (output: string) => void,
      overrides?: { repoId?: string, disableHostCheck?: boolean }
  ) => {
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
    } else {
        setTerminalLogs(prev => [...prev, "Command failed. Please check the error above."]);
        setIsTerminalOpen(true);
    }
  };

  const handleMount = async (repoId: string, archiveName: string, path: string) => {
    const repo = repos.find(r => r.id === repoId);
    if (!repo) return;

    setTerminalTitle(`Mounting ${archiveName}`);
    setTerminalLogs([`Requesting mount of ${repo.url}::${archiveName} to ${path}...`]);
    setIsProcessing(true);
    
    addActivity('Mount Requested', `Mounting ${archiveName} to ${path}`, 'info');

    const result = await borgService.mount(
        repo.url, 
        archiveName, 
        path, 
        (log) => {
            setTerminalLogs(prev => [...prev, log.trim()]);
        }, 
        {
            repoId: repo.id, // Secure Injection
            disableHostCheck: repo.trustHost
        }
    );

    setIsProcessing(false);
    setTimeout(() => checkRepoLock(repo), 1000);

    if (result.success) {
        addActivity('Mount Successful', `Archive ${archiveName} mounted at ${path}`, 'success');
        toast.success(`Mounted ${archiveName}`);
        
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
        
        try {
            const { ipcRenderer } = (window as any).require('electron');
            ipcRenderer.send('open-path', path);
        } catch(e) { console.error("Could not auto-open explorer"); }
        
    } else {
        addActivity('Mount Failed', `Failed to mount ${archiveName}: ${result.error || 'Unknown error'}`, 'error');
        toast.error(`Mount failed. See activity logs.`);
        setIsTerminalOpen(true);

        if (result.error === 'FUSE_MISSING') {
            setTimeout(() => {
                setIsTerminalOpen(false);
                setShowFuseHelp(true);
            }, 500);
        }
    }
  };

  const handleUnmount = async (id: string) => {
    const mount = mounts.find(m => m.id === id);
    if (!mount) return;

    setTerminalTitle(`Unmounting ${mount.localPath}`);
    setIsProcessing(true);

    await borgService.unmount(mount.id, mount.localPath);
    
    addActivity('Unmount', `Unmounted ${mount.localPath}`, 'success');
    toast.info(`Unmounted ${mount.localPath}`);
    
    setMounts(prev => prev.filter(m => m.id !== id));
    setIsProcessing(false);
    
    const repo = repos.find(r => r.id === mount.repoId);
    if (repo) setTimeout(() => checkRepoLock(repo), 1000);
  };

  const extractJson = (text: string) => {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start > -1 && end > start) return text.substring(start, end + 1);
      return text;
  };

  const handleFetchArchiveStats = async (repo: Repository, archiveName: string) => {
     const stats = await borgService.getArchiveInfo(repo.url, archiveName, {
         repoId: repo.id,
         disableHostCheck: repo.trustHost
     });

     if (stats) {
         setArchives(prev => prev.map(a => 
             a.name === archiveName ? { ...a, size: stats.size, duration: stats.duration } : a
         ));
         addActivity('Archive Stats Updated', `Fetched stats for ${archiveName} (${stats.size})`, 'success');
     } else {
         addActivity('Stats Fetch Failed', `Could not get info for ${archiveName}`, 'warning');
     }
  };

  const handleConnect = (repo: Repository) => {
    setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, status: 'connecting' } : r));

    runCommand(
        `Connecting to ${repo.name}`, 
        ['list', '--json', repo.url], 
        (rawOutput) => {
            checkRepoLock(repo);

            try {
                const jsonString = extractJson(rawOutput);
                const data = JSON.parse(jsonString);
                const newArchives: Archive[] = data.archives.map((a: any) => ({
                    id: a.id || a.name,
                    name: a.name,
                    time: formatDate(a.time),
                    size: 'Unknown',
                    duration: 'Unknown'
                })).reverse();

                setArchives(newArchives);
                addActivity('Connection Successful', `Connected to ${repo.name}`, 'success');
                toast.success(`Connected to ${repo.name}`);

                if (newArchives.length > 0) {
                    setTimeout(() => handleFetchArchiveStats(repo, newArchives[0].name), 500);
                }

                setRepos(prev => prev.map(r => 
                r.id === repo.id ? { 
                    ...r, 
                    status: 'connected', 
                    lastBackup: newArchives[0]?.time || 'Never',
                    fileCount: newArchives.length 
                } : r
                ));

                setTimeout(() => {
                     runCommand(
                        `Fetching Stats for ${repo.name}`,
                        ['info', '--json', repo.url],
                        (infoRawOutput) => {
                             try {
                                 const infoJson = extractJson(infoRawOutput);
                                 const infoData = JSON.parse(infoJson);
                                 const stats = infoData.cache?.stats || infoData.repository?.stats;
                                 let sizeStr = 'Unknown';
                                 if (stats && stats.unique_csize) {
                                     const gb = stats.unique_csize / 1024 / 1024 / 1024;
                                     sizeStr = gb.toFixed(2) + ' GB';
                                 }
                                 setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, size: sizeStr } : r));
                             } catch(e) {}
                        },
                        { repoId: repo.id, disableHostCheck: repo.trustHost }
                     );
                }, 800);

            } catch (e) {
                addActivity('Connection Failed', `Failed to parse response from ${repo.name}`, 'error');
                toast.error(`Failed to connect to ${repo.name}`);
                setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, status: 'error' } : r));
            }
        },
        { repoId: repo.id, disableHostCheck: repo.trustHost } // Secure Injection
    );
  };

  const handleRefreshArchives = () => {
      const activeRepo = repos.find(r => r.status === 'connected');
      if (activeRepo) handleConnect(activeRepo);
  };

  const handleCheckIntegrity = async (repo: Repository) => {
      const commandId = `check-${repo.id}-${Date.now()}`;
      setRepos(prev => prev.map(r => r.id === repo.id ? { 
          ...r, 
          checkStatus: 'running', 
          checkProgress: 0, 
          checkStartTime: Date.now(),
          activeCommandId: commandId
      } : r));
      
      addActivity('Integrity Check Started', `Started check on ${repo.name}`, 'info');
      toast.info(`Integrity check started for ${repo.name}`);

      const progressCallback = (log: string) => {
         const matches = [...log.matchAll(/(\d+\.\d+|\d+)%/g)];
         if (matches.length > 0) {
             const progress = parseFloat(matches[matches.length - 1][1]);
             if (!isNaN(progress)) {
                 setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, checkProgress: progress } : r));
             }
         }
      };

      const success = await borgService.runCommand(
          ['check', '--progress', repo.url], 
          progressCallback,
          { repoId: repo.id, disableHostCheck: repo.trustHost, commandId: commandId }
      );

      await checkRepoLock(repo);

      setRepos(prev => {
          if (prev.find(r => r.id === repo.id)?.checkStatus === 'aborted') return prev;
          
          if (success) {
              addActivity('Integrity Check Passed', `Repository ${repo.name} verified.`, 'success');
              toast.success(`Integrity check passed for ${repo.name}`);
          } else {
              addActivity('Integrity Check Failed', `Check failed for ${repo.name}.`, 'error');
              toast.error(`Integrity check failed for ${repo.name}`);
          }

          return prev.map(r => r.id === repo.id ? { 
            ...r, 
            checkStatus: success ? 'ok' : 'error', 
            checkProgress: success ? 100 : undefined,
            checkStartTime: undefined, 
            lastCheckTime: new Date().toLocaleString(), 
            activeCommandId: undefined
          } : r);
      });
  };

  const handleAbortCheck = async (repo: Repository) => {
      setRepos(prev => prev.map(r => r.id === repo.id ? {
          ...r, checkStatus: 'aborted', checkProgress: undefined, checkStartTime: undefined, activeCommandId: undefined
      } : r));
      addActivity('Integrity Check Aborted', `Cancelled check for ${repo.name}`, 'warning');
      if (repo.activeCommandId) {
          await borgService.stopCommand(repo.activeCommandId);
          setTimeout(() => checkRepoLock(repo), 1000);
      }
  };
  
  const handleBreakLock = async (repo: Repository) => {
      if(!window.confirm(`FORCE UNLOCK REPO?\n\nThis will run 'borg break-lock'.`)) return;
      setTerminalTitle(`Unlocking Repo: ${repo.name}`);
      setTerminalLogs([]);
      setIsProcessing(true);
      
      await borgService.breakLock(
          repo.url,
          (log) => setTerminalLogs(prev => [...prev, log.trim()]),
          { repoId: repo.id, disableHostCheck: repo.trustHost }
      );
      
      const deleteSuccess = await borgService.forceDeleteLockFiles(
          repo.url,
          (log) => setTerminalLogs(prev => [...prev, log.trim()]),
          { disableHostCheck: repo.trustHost }
      );

      setIsProcessing(false);
      await checkRepoLock(repo);

      if(deleteSuccess) {
          addActivity('Unlock Successful', `Lock files removed for ${repo.name}`, 'success');
          toast.success("Repository unlocked.");
      } else {
          setIsTerminalOpen(true);
      }
  };

  const handleQuickMount = (repo: Repository) => {
    setPreselectedRepoId(repo.id);
    setCurrentView(View.MOUNTS);
    handleConnect(repo);
  };
  
  const handleArchiveMount = (repo: Repository, archiveName: string) => {
      setPreselectedRepoId(repo.id);
      setCurrentView(View.MOUNTS);
      if (repo.status !== 'connected') handleConnect(repo);
  };

  const handleAddRepo = (repoData: any) => {
    const newRepo: Repository = {
       id: repoData.id || Math.random().toString(36).substr(2, 9),
       name: repoData.name,
       url: repoData.url,
       encryption: repoData.encryption,
       trustHost: repoData.trustHost,
       lastBackup: 'Never',
       status: 'disconnected',
       size: 'Unknown',
       fileCount: 0,
       checkStatus: 'idle',
       lastCheckTime: 'Never'
    };
    setRepos(prev => [...prev, newRepo]);
    handleConnect(newRepo);
  };

  const handleEditRepo = (id: string, repoData: any) => {
     setRepos(prev => prev.map(r => r.id === id ? { ...r, ...repoData, status: 'disconnected' } : r));
  };

  const handleDeleteRepo = async (repoId: string) => {
      if (window.confirm("Remove this repository?")) {
          // Clean up secret
          await borgService.deletePassphrase(repoId);
          setRepos(prev => prev.filter(r => r.id !== repoId));
          // Clean up jobs for this repo
          setJobs(prev => prev.filter(j => j.repoId !== repoId));
          toast.success("Repository removed.");
      }
  };

  // --- JOB HANDLERS ---
  const handleAddJob = (job: BackupJob) => {
      setJobs(prev => [...prev, job]);
      toast.success("Backup Job created.");
  };

  const handleDeleteJob = (jobId: string) => {
      setJobs(prev => prev.filter(j => j.id !== jobId));
      toast.info("Backup Job deleted.");
  };

  const handleRunJob = async (jobId: string) => {
      const job = jobs.find(j => j.id === jobId);
      if (!job) return;
      const repo = repos.find(r => r.id === job.repoId);
      if (!repo) {
          toast.error("Repository not found for this job");
          return;
      }

      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'running' } : j));
      addActivity('Backup Job Started', `Job: ${job.name} (Repo: ${repo.name})`, 'info');

      // Construct Archive Name: prefix-YYYY-MM-DD-HHMM
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
      const archiveName = `${job.archivePrefix}-${dateStr}-${timeStr}`;

      const logs: string[] = [];
      const logCollector = (l: string) => logs.push(l);

      try {
          const success = await borgService.createArchive(
              repo.url,
              archiveName,
              [job.sourcePath],
              logCollector,
              { repoId: repo.id, disableHostCheck: repo.trustHost }
          );

          if (success) {
              addActivity('Backup Job Success', `Created archive: ${archiveName}`, 'success');
              toast.success(`Job '${job.name}' finished successfully!`);
              
              // --- AUTO PRUNE IF ENABLED ---
              if (job.pruneEnabled) {
                  addActivity('Auto Prune Started', `Pruning repo for job ${job.name}...`, 'info');
                  const pruneSuccess = await borgService.prune(
                      repo.url,
                      { daily: job.keepDaily, weekly: job.keepWeekly, monthly: job.keepMonthly, yearly: job.keepYearly },
                      logCollector,
                      { repoId: repo.id, disableHostCheck: repo.trustHost }
                  );
                  if (pruneSuccess) {
                      addActivity('Auto Prune Success', `Repository pruned according to retention policy.`, 'success');
                  } else {
                      addActivity('Auto Prune Failed', `Pruning step failed. Check logs.`, 'warning');
                  }
              }

              setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'success', lastRun: new Date().toISOString() } : j));
              if (repo.status === 'connected') handleConnect(repo); // Refresh archive list
          } else {
              setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error' } : j));
              addActivity('Backup Job Failed', `Job: ${job.name} failed`, 'error');
              toast.error(`Job '${job.name}' failed. Check activity log.`);
          }
      } catch (e: any) {
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error' } : j));
          addActivity('Backup Job Error', e.message, 'error');
          toast.error(`Job '${job.name}' error: ${e.message}`);
      }
  };

  const renderContent = () => {
    switch (currentView) {
      case View.REPOSITORIES:
        return (
          <RepositoriesView 
            repos={repos} 
            jobs={jobs}
            onAddRepo={handleAddRepo} 
            onEditRepo={handleEditRepo}
            onConnect={handleConnect}
            onMount={handleQuickMount}
            onCheck={handleCheckIntegrity}
            onBreakLock={handleBreakLock}
            onDelete={handleDeleteRepo}
            onAddJob={handleAddJob}
            onDeleteJob={handleDeleteJob}
            onRunJob={handleRunJob}
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
                    if(repo) return handleFetchArchiveStats(repo, archiveName);
                    return Promise.resolve();
                }}
            />
        );
      case View.SETTINGS: return <SettingsView />;
      case View.ACTIVITY: return <ActivityView logs={activityLogs} onClearLogs={() => setActivityLogs([])} />;
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
              onOneOffBackup={(r) => setBackupRepo(r)}
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
           />
        );
    }
  };

  return (
    <div className="h-screen w-screen relative">
        <ToastContainer />
        
        {/* GLOBAL BACKUP MODAL (ACCESSIBLE FROM DASHBOARD) */}
        {backupRepo && (
          <CreateBackupModal 
              initialRepo={backupRepo}
              repos={repos} // CHANGED: Pass all repos, allowing user to select disconnected ones
              isOpen={!!backupRepo}
              onClose={() => setBackupRepo(null)}
              onLog={(title, logs) => {
                  // If we wanted to show a log modal here we could, for now just toast/close
              }}
              onSuccess={() => {
                  if(backupRepo) handleConnect(backupRepo);
              }}
          />
        )}

        <div className="flex flex-col h-full w-full overflow-hidden bg-[#f3f3f3] dark:bg-[#0f172a] transition-colors duration-300">
          <TitleBar />
          <div className="flex flex-1 overflow-hidden pt-9">
              <Sidebar currentView={currentView} onChangeView={(view) => { setCurrentView(view); setPreselectedRepoId(null); }} />
              <TerminalModal isOpen={isTerminalOpen} title={terminalTitle} logs={terminalLogs} onClose={() => setIsTerminalOpen(false)} isProcessing={isProcessing} />
              <FuseSetupModal isOpen={showFuseHelp} onClose={() => setShowFuseHelp(false)} />
              <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <div className="flex-1 overflow-y-auto p-8 pt-4">
                   {renderContent()}
                </div>
              </main>
          </div>
        </div>
    </div>
  );
};

export default App;
