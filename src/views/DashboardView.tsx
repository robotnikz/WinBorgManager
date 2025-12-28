
import React, { useMemo } from 'react';
import { Repository, MountPoint, View } from '../types';
import { 
  ShieldCheck, 
  HardDrive, 
  Server, 
  Activity, 
  ArrowUpRight, 
  Database, 
  Clock, 
  AlertTriangle,
  Zap
} from 'lucide-react';
import Button from '../components/Button';
import { parseSizeString, formatBytes } from '../utils/formatters';

interface DashboardViewProps {
  repos: Repository[];
  mounts: MountPoint[];
  onQuickMount: (repo: Repository) => void;
  onConnect: (repo: Repository) => void;
  onCheck: (repo: Repository) => void;
  onChangeView: (view: any) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ repos, mounts, onQuickMount, onConnect, onCheck, onChangeView }) => {
  
  // Calculate Statistics
  const stats = useMemo(() => {
    const totalRepos = repos.length;
    const activeMounts = mounts.length;
    const connectedRepos = repos.filter(r => r.status === 'connected').length;
    
    // Calculate total size stored
    const totalBytes = repos.reduce((acc, repo) => acc + parseSizeString(repo.size), 0);
    
    // Simulate Original Size (Borg usually has 2x-5x deduplication ratio)
    // We simulate a 2.4x ratio for the visualization to look like Vorta
    const simulatedOriginalBytes = totalBytes * 2.4; 
    
    const savingsBytes = simulatedOriginalBytes - totalBytes;
    const savingsPercent = totalBytes > 0 ? Math.round((savingsBytes / simulatedOriginalBytes) * 100) : 0;

    return {
        totalRepos,
        activeMounts,
        connectedRepos,
        totalBytes,
        formattedTotal: formatBytes(totalBytes),
        formattedOriginal: formatBytes(simulatedOriginalBytes),
        formattedSavings: formatBytes(savingsBytes),
        savingsPercent
    };
  }, [repos, mounts]);

  const handleSmartVerify = () => {
    if (repos.length === 1 && repos[0].status === 'connected') {
        // If only one connected repo, run check immediately
        onCheck(repos[0]);
    } else {
        // Otherwise go to list to select
        onChangeView(View.REPOSITORIES);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header / Hero Section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Overview</h1>
          <p className="text-slate-500 mt-1">Backup Infrastructure Status</p>
        </div>
        <div className="text-right">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 text-sm font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>All Systems Operational</span>
             </div>
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
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-slate-500" />
                        Storage Efficiency
                    </h3>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">Borg Deduplication</span>
                </div>
                
                <div className="space-y-6">
                    {/* Visual Bars */}
                    <div className="relative pt-6 pb-2">
                         {/* Original Size Bar */}
                         <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                             <span>Original Data Size (Est.)</span>
                             <span>{stats.formattedOriginal}</span>
                         </div>
                         <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                             <div className="h-full bg-gray-300 rounded-full w-full"></div>
                         </div>

                         {/* Compressed Size Bar */}
                         <div className="flex justify-between text-xs font-medium text-blue-600 mt-4 mb-1">
                             <span>Actual Repository Size</span>
                             <span>{stats.formattedTotal}</span>
                         </div>
                         <div className="w-full h-3 bg-blue-50/50 rounded-full overflow-hidden border border-blue-100">
                             <div 
                                className="h-full bg-blue-500 rounded-full shadow-sm transition-all duration-1000" 
                                style={{ width: `${100 - stats.savingsPercent}%` }}
                             ></div>
                         </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex gap-4">
                        <Zap className="w-10 h-10 text-yellow-500 shrink-0" />
                        <div>
                            <h4 className="text-sm font-bold text-slate-800">Why makes Borg cool?</h4>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                Borg stores files in variable-length chunks. Only new or modified chunks are stored. This results in massive space savings compared to traditional backups.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Repositories List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-semibold text-slate-800">Repository Status</h3>
                    <Button variant="ghost" size="sm" onClick={() => onChangeView('REPOSITORIES')}>Manage</Button>
                </div>
                <div className="divide-y divide-gray-100">
                    {repos.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            No repositories configured.
                        </div>
                    ) : (
                        repos.map(repo => (
                            <div key={repo.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-2 rounded-full ${repo.status === 'connected' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    <div>
                                        <div className="font-medium text-slate-800">{repo.name}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                            <span className="truncate max-w-[200px]">{repo.url}</span>
                                            <span>•</span>
                                            <span>{repo.size}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right mr-2 hidden sm:block">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Last Backup</div>
                                        <div className="text-xs font-medium text-slate-700 flex items-center justify-end gap-1">
                                            <Clock className="w-3 h-3" /> {repo.lastBackup}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            onClick={() => onConnect(repo)}
                                            disabled={repo.status === 'connected'}
                                        >
                                            {repo.status === 'connected' ? 'Connected' : 'Connect'}
                                        </Button>
                                        {repo.status === 'connected' && (
                                            <Button size="sm" onClick={() => onQuickMount(repo)}>
                                                Mount
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* Right Column: Recent Activity & Quick Actions */}
        <div className="space-y-6">
            
            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-lg">
                <h3 className="font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-3">
                    <button 
                        onClick={() => onChangeView(View.REPOSITORIES)}
                        className="w-full text-left px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-3 border border-white/5"
                    >
                        <Server className="w-5 h-5 text-blue-300" />
                        <div>
                            <div className="text-sm font-medium">Add Repository</div>
                            <div className="text-xs text-slate-400">Connect to a new SSH remote</div>
                        </div>
                    </button>
                    <button 
                         onClick={handleSmartVerify}
                         className="w-full text-left px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-3 border border-white/5"
                    >
                        <AlertTriangle className="w-5 h-5 text-yellow-300" />
                        <div>
                            <div className="text-sm font-medium">Verify Integrity</div>
                            <div className="text-xs text-slate-400">Run consistency checks</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Simulated Activity Log */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-4">Activity Log</h3>
                <div className="relative border-l border-gray-200 ml-2 space-y-6">
                    {/* Mock Data for aesthetics */}
                    <ActivityItem 
                        status="success"
                        title="Backup Successful"
                        desc="Hetzner StorageBox"
                        time="2 hours ago"
                    />
                     <ActivityItem 
                        status="success"
                        title="Archive Pruned"
                        desc="Removed 3 old archives"
                        time="5 hours ago"
                    />
                    <ActivityItem 
                        status="warning"
                        title="Connection Retry"
                        desc="Local NAS (Timeout)"
                        time="1 day ago"
                    />
                </div>
                <button 
                    onClick={() => onChangeView(View.ACTIVITY)}
                    className="w-full mt-6 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
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
        blue: 'bg-blue-50 text-blue-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        purple: 'bg-purple-50 text-purple-600'
    };

    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
                </div>
                <div className={`p-2 rounded-lg ${colors[color as keyof typeof colors]}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">
                {subtext}
            </p>
        </div>
    );
}

const ActivityItem = ({ status, title, desc, time }: any) => {
    return (
        <div className="ml-6 relative">
            <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white ring-1 ring-gray-100 ${
                status === 'success' ? 'bg-green-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-sm font-medium text-slate-800">{title}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{time}</div>
            </div>
        </div>
    )
}

export default DashboardView;
