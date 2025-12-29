
import React, { useMemo, useState, useEffect } from 'react';
import { Repository, MountPoint, View, ActivityLogEntry } from '../types';
import { 
  ShieldCheck, 
  HardDrive, 
  Server, 
  Activity, 
  ArrowUpRight, 
  Database, 
  Clock, 
  AlertTriangle,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  XSquare,
  Timer,
  Lock,
  Moon,
  Sun,
  FileText
} from 'lucide-react';
import Button from '../components/Button';
import { parseSizeString, formatBytes, formatDate, formatDuration } from '../utils/formatters';

interface DashboardViewProps {
  repos: Repository[];
  mounts: MountPoint[];
  activityLogs: ActivityLogEntry[];
  onQuickMount: (repo: Repository) => void;
  onConnect: (repo: Repository) => void;
  onCheck: (repo: Repository) => void;
  onChangeView: (view: any) => void;
  onAbortCheck?: (repo: Repository) => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ 
    repos, mounts, activityLogs, onQuickMount, onConnect, onCheck, onChangeView, onAbortCheck, isDarkMode, toggleTheme 
}) => {
  
  // Real-time Current File Logic
  const [currentFile, setCurrentFile] = useState<string>('');
  
  // Listen for terminal logs to extract "Current File" being backed up
  // Borg outputs "A /path/to/file" or "M /path/to/file" on stdout
  useEffect(() => {
    const handleTerminalLog = (_: any, data: { id: string, text: string }) => {
        // Simple regex to find file paths starting with A (Added), M (Modified), U (Unchanged)
        // Format is usually: "A path/to/file"
        const lines = data.text.split('\n');
        for (const line of lines) {
            const match = line.match(/^[AMU]\s+(.+)$/);
            if (match) {
                setCurrentFile(match[1]);
                break; // Just take the first one found in chunk
            }
        }
    };
    
    try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.on('terminal-log', handleTerminalLog);
        return () => {
            ipcRenderer.removeListener('terminal-log', handleTerminalLog);
        };
    } catch(e) {}
  }, []);


  // Force update to recalculate ETA every second if needed
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
      const hasRunningCheck = repos.some(r => r.checkStatus === 'running');
      if (hasRunningCheck) {
          const interval = setInterval(() => setNow(Date.now()), 1000);
          return () => clearInterval(interval);
      }
  }, [repos]);

  // Calculate Statistics
  const stats = useMemo(() => {
    const totalRepos = repos.length;
    const activeMounts = mounts.length;
    const connectedRepos = repos.filter(r => r.status === 'connected').length;
    
    // Check Statuses
    const runningChecks = repos.filter(r => r.checkStatus === 'running').length;
    const errorChecks = repos.filter(r => r.checkStatus === 'error').length;
    
    // Calculate total size stored
    const totalBytes = repos.reduce((acc, repo) => acc + parseSizeString(repo.size), 0);
    
    // Simulate Original Size
    const simulatedOriginalBytes = totalBytes * 2.4; 
    
    const savingsBytes = simulatedOriginalBytes - totalBytes;
    const savingsPercent = totalBytes > 0 ? Math.round((savingsBytes / simulatedOriginalBytes) * 100) : 0;

    return {
        totalRepos,
        activeMounts,
        connectedRepos,
        runningChecks,
        errorChecks,
        totalBytes,
        formattedTotal: formatBytes(totalBytes),
        formattedOriginal: formatBytes(simulatedOriginalBytes),
        formattedSavings: formatBytes(savingsBytes),
        savingsPercent
    };
  }, [repos, mounts]);

  const handleSmartVerify = () => {
    if (repos.length === 1 && repos[0].status === 'connected') {
        onCheck(repos[0]);
    } else {
        onChangeView(View.REPOSITORIES);
    }
  };

  // Helper to format rough relative time for dashboard
  const getRelativeTime = (iso: string) => {
      try {
          const diff = Date.now() - new Date(iso).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 1) return 'Just now';
          if (mins < 60) return `${mins}m ago`;
          const hours = Math.floor(mins / 60);
          if (hours < 24) return `${hours}h ago`;
          return formatDate(iso);
      } catch { return iso; }
  };
  
  // Calculate ETA for specific repo
  const getEta = (repo: Repository) => {
      if (repo.checkStatus !== 'running' || !repo.checkStartTime || !repo.checkProgress || repo.checkProgress <= 0.5) return null;
      
      const elapsedMs = now - repo.checkStartTime;
      if (elapsedMs < 2000) return "Calculating..."; // Buffer for initial calculation

      const timePerPercent = elapsedMs / repo.checkProgress;
      const remainingPercent = 100 - repo.checkProgress;
      const remainingMs = timePerPercent * remainingPercent;
      
      return formatDuration(remainingMs / 1000) + ' remaining';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header / Hero Section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Backup Infrastructure Status</p>
        </div>
        <div className="flex items-center gap-4">
             {/* Theme Toggle */}
             {toggleTheme && (
                 <button 
                    onClick={toggleTheme}
                    className="p-2 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors shadow-sm"
                    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                 >
                     {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                 </button>
             )}

             {stats.runningChecks > 0 ? (
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running Integrity Check...</span>
                 </div>
             ) : stats.errorChecks > 0 ? (
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-full text-red-700 dark:text-red-300 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Integrity Issues Found</span>
                 </div>
             ) : (
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-full text-green-700 dark:text-green-300 text-sm font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    <span>All Systems Operational</span>
                 </div>
             )}
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
             title="Total Repositories" 
             value={stats.totalRepos.toString()} 
             icon={Server} 
             color="blue"
             subtext={`${stats.connectedRepos} Connected`}
          />
          <StatCard 
             title="Active Mounts" 
             value={stats.activeMounts.toString()} 
             icon={HardDrive} 
             color="indigo"
             subtext={stats.activeMounts > 0 ? "Filesystem Accessible" : "No mounts active"}
          />
          <StatCard 
             title="Storage Used" 
             value={stats.formattedTotal} 
             icon={Database} 
             color="emerald"
             subtext="Deduplicated Size"
          />
          <StatCard 
             title="Est. Savings" 
             value={`${stats.savingsPercent}%`} 
             icon={ArrowUpRight} 
             color="purple"
             subtext={`~ ${stats.formattedSavings} saved`}
          />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Column: Storage Efficiency & Repos */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Efficiency Visualizer */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        Storage Efficiency
                    </h3>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Borg Deduplication</span>
                </div>
                
                <div className="space-y-6">
                    {/* Visual Bars */}
                    <div className="relative pt-6 pb-2">
                         {/* Original Size Bar */}
                         <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                             <span>Original Data Size (Est.)</span>
                             <span>{stats.formattedOriginal}</span>
                         </div>
                         <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                             <div className="h-full bg-gray-300 dark:bg-slate-600 rounded-full w-full"></div>
                         </div>

                         {/* Compressed Size Bar */}
                         <div className="flex justify-between text-xs font-medium text-blue-600 dark:text-blue-400 mt-4 mb-1">
                             <span>Actual Repository Size</span>
                             <span>{stats.formattedTotal}</span>
                         </div>
                         <div className="w-full h-3 bg-blue-50/50 dark:bg-blue-900/30 rounded-full overflow-hidden border border-blue-100 dark:border-blue-900">
                             <div 
                                className="h-full bg-blue-500 dark:bg-blue-600 rounded-full shadow-sm transition-all duration-1000" 
                                style={{ width: `${100 - stats.savingsPercent}%` }}
                             ></div>
                         </div>
                    </div>
                </div>
            </div>

            {/* Repositories List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                    <h3 className="font-semibold text-slate-800 dark:text-white">Repository Status</h3>
                    <Button variant="ghost" size="sm" onClick={() => onChangeView('REPOSITORIES')} className="dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700">Manage</Button>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {repos.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            No repositories configured.
                        </div>
                    ) : (
                        repos.map(repo => {
                            const eta = getEta(repo);
                            return (
                                <div key={repo.id} className="px-6 py-4 flex flex-col gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className={`w-2 h-2 rounded-full ${repo.status === 'connected' ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`}></div>
                                            <div className="flex-1">
                                                <div className="font-medium text-slate-800 dark:text-slate-200">{repo.name}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                                    <span className="truncate max-w-[150px]">{repo.url}</span>
                                                    
                                                    {/* LOCKED BADGE */}
                                                    {repo.isLocked && (
                                                        <span className="flex items-center gap-1 text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded ml-2 border border-orange-200 dark:border-orange-800" title="This repository is currently locked by a process (lock.roster found)">
                                                            <Lock className="w-3 h-3" /> Locked
                                                        </span>
                                                    )}

                                                    {/* Integrity Status Badge */}
                                                    {repo.checkStatus === 'running' && (
                                                        <div className="flex flex-col gap-1.5 ml-2 w-48">
                                                            <div className="flex justify-between items-end">
                                                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                                                                    <Loader2 className="w-3 h-3 animate-spin" /> 
                                                                    {typeof repo.checkProgress === 'number' ? `${Math.round(repo.checkProgress)}%` : '0%'}
                                                                </span>
                                                                {eta && (
                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                                                                        <Timer className="w-3 h-3" /> {eta}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="h-1.5 w-full bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-blue-500 dark:bg-blue-500 rounded-full transition-all duration-300" 
                                                                    style={{ width: `${repo.checkProgress || 0}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {repo.checkStatus === 'ok' && (
                                                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded ml-2" title={`Verified: ${repo.lastCheckTime}`}>
                                                            <CheckCircle2 className="w-3 h-3" /> Verified
                                                        </span>
                                                    )}
                                                    {repo.checkStatus === 'error' && (
                                                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded ml-2">
                                                            <XCircle className="w-3 h-3" /> Check Failed
                                                        </span>
                                                    )}
                                                     {repo.checkStatus === 'aborted' && (
                                                        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 rounded ml-2">
                                                            <XSquare className="w-3 h-3" /> Aborted
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right mr-2 hidden sm:block">
                                                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Last Backup</div>
                                                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-end gap-1">
                                                    <Clock className="w-3 h-3" /> {repo.lastBackup}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {repo.checkStatus === 'running' ? (
                                                    <Button size="sm" variant="danger" onClick={() => onAbortCheck?.(repo)}>
                                                        Abort
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button 
                                                            size="sm" 
                                                            variant="secondary"
                                                            onClick={() => onConnect(repo)}
                                                            disabled={repo.status === 'connected'}
                                                            className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
                                                        >
                                                            {repo.status === 'connected' ? 'Connected' : 'Connect'}
                                                        </Button>
                                                        {repo.status === 'connected' && (
                                                            <Button size="sm" onClick={() => onQuickMount(repo)}>
                                                                Mount
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* CURRENT FILE PROCESSING INDICATOR */}
                                    {currentFile && (repo.checkStatus === 'running' || repo.status === 'connecting') && (
                                        <div className="mt-1 flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-900 p-1.5 rounded truncate">
                                            <FileText className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">{currentFile}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>

        {/* Right Column: Recent Activity & Quick Actions */}
        <div className="space-y-6">
            
            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-blue-900 dark:to-slate-900 rounded-xl p-6 text-white shadow-lg">
                <h3 className="font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-3">
                    <button 
                        onClick={() => onChangeView(View.REPOSITORIES)}
                        className="w-full text-left px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-3 border border-white/5"
                    >
                        <Server className="w-5 h-5 text-blue-300" />
                        <div>
                            <div className="text-sm font-medium">Add Repository</div>
                            <div className="text-xs text-slate-400 dark:text-slate-300">Connect to a new SSH remote</div>
                        </div>
                    </button>
                    <button 
                         onClick={handleSmartVerify}
                         disabled={stats.runningChecks > 0}
                         className="w-full text-left px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-3 border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <AlertTriangle className="w-5 h-5 text-yellow-300" />
                        <div>
                            <div className="text-sm font-medium">Verify Integrity</div>
                            <div className="text-xs text-slate-400 dark:text-slate-300">Run consistency checks</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* REAL Activity Log */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Activity Log</h3>
                <div className="relative border-l border-gray-200 dark:border-slate-700 ml-2 space-y-6">
                    {activityLogs.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 text-xs">
                            No recent activity
                        </div>
                    ) : (
                        activityLogs.slice(0, 5).map(log => (
                            <ActivityItem 
                                key={log.id}
                                status={log.status}
                                title={log.title}
                                desc={log.detail}
                                time={getRelativeTime(log.time)}
                            />
                        ))
                    )}
                </div>
                <button 
                    onClick={() => onChangeView(View.ACTIVITY)}
                    className="w-full mt-6 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                    View Full Logs
                </button>
            </div>

        </div>

      </div>
    </div>
  );
};

// --- Subcomponents ---

const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{value}</h3>
                </div>
                <div className={`p-2 rounded-lg ${colors[color as keyof typeof colors]}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">
                {subtext}
            </p>
        </div>
    );
}

const ActivityItem = ({ status, title, desc, time }: any) => {
    const statusColors = {
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };
    
    // Fallback if an unknown status string is passed
    const dotColor = statusColors[status as keyof typeof statusColors] || 'bg-gray-400';

    return (
        <div className="ml-6 relative">
            <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ring-1 ring-gray-100 dark:ring-slate-700 ${dotColor}`}></div>
            <div className="flex justify-between items-start">
                <div className="flex-1 overflow-hidden mr-2">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate" title={desc}>{desc}</div>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 whitespace-nowrap">{time}</div>
            </div>
        </div>
    )
}

export default DashboardView;
