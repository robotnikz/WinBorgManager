
import React, { useState } from 'react';
import { Archive, Repository } from '../types';
import Button from '../components/Button';
import { Database, Clock, HardDrive, Search, Filter, Calendar, RefreshCw, Info, DownloadCloud, Loader2, ListChecks } from 'lucide-react';

interface ArchivesViewProps {
  archives: Archive[];
  repos: Repository[];
  onMount: (repo: Repository, archiveName: string) => void;
  onRefresh: () => void;
  onGetInfo?: (archiveName: string) => Promise<void>;
}

const ArchivesView: React.FC<ArchivesViewProps> = ({ archives, repos, onMount, onRefresh, onGetInfo }) => {
  const [search, setSearch] = useState('');
  const [loadingInfo, setLoadingInfo] = useState<string | null>(null);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  
  // Basic filtering
  const filteredArchives = archives.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  // Helper to find the active connected repo
  const activeRepo = repos.find(r => r.status === 'connected');

  const handleGetInfo = async (archiveName: string) => {
      setLoadingInfo(archiveName);
      if (onGetInfo) {
          await onGetInfo(archiveName);
          setLoadingInfo(null);
      }
  };

  const handleFetchAllStats = async () => {
      if (!onGetInfo || !activeRepo) return;
      
      setIsFetchingAll(true);
      
      // Only process archives that don't have stats yet to save time
      const targets = filteredArchives.filter(a => a.size === 'Unknown');
      
      // Process sequentially to prevent locking issues or spawning 100 processes
      for (const archive of targets) {
          // Check if we should stop (could add an abort controller logic later, simple check for now)
          if (!activeRepo) break; 
          
          setLoadingInfo(archive.name); // Visual feedback on current item
          try {
              await onGetInfo(archive.name);
          } catch (e) {
              console.error(`Failed to fetch info for ${archive.name}`, e);
          }
          // Small breathing room for UI
          await new Promise(r => setTimeout(r, 200));
      }
      
      setLoadingInfo(null);
      setIsFetchingAll(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Archives</h1>
          <p className="text-slate-500 text-sm mt-1">
             {activeRepo 
                ? `Snapshots for ${activeRepo.name}`
                : "Select a repository in the 'Repositories' tab to load archives."}
          </p>
        </div>
        <div className="flex gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search archives..."
                  className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            
            <Button 
                variant="secondary" 
                onClick={handleFetchAllStats} 
                title="Fetch size & duration for all archives" 
                disabled={!activeRepo || isFetchingAll || filteredArchives.every(a => a.size !== 'Unknown')}
                className={isFetchingAll ? "bg-blue-50 text-blue-600 border-blue-200" : ""}
            >
                {isFetchingAll ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ListChecks className="w-4 h-4 mr-2" />}
                {isFetchingAll ? "Fetching..." : "Get All Stats"}
            </Button>

            <Button variant="secondary" onClick={onRefresh} title="Refresh Archives List" disabled={!activeRepo || isFetchingAll}>
                <RefreshCw className="w-4 h-4" />
            </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
         <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-slate-500 font-medium border-b border-gray-100">
                <tr>
                    <th className="px-6 py-3">Archive Name</th>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Size</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredArchives.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                            <Database className="w-8 h-8 mx-auto mb-3 opacity-50" />
                            <p className="mb-4">{activeRepo ? "No archives found or list is empty." : "Connect to a repository to see archives."}</p>
                            {activeRepo && (
                                <Button variant="secondary" onClick={onRefresh}>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Load Archives for {activeRepo.name}
                                </Button>
                            )}
                        </td>
                    </tr>
                ) : (
                    filteredArchives.map((archive) => (
                        <tr key={archive.id} className="hover:bg-blue-50/50 transition-colors group">
                            <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                    <Database className="w-4 h-4" />
                                </div>
                                {archive.name}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    {archive.time}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 font-mono">
                                {archive.size === 'Unknown' ? (
                                    <button 
                                        onClick={() => handleGetInfo(archive.name)}
                                        className="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-xs bg-blue-50 px-2 py-1 rounded"
                                        title="Click to calculate size"
                                        disabled={loadingInfo === archive.name || isFetchingAll}
                                    >
                                        {loadingInfo === archive.name ? <Loader2 className="w-3 h-3 animate-spin"/> : <DownloadCloud className="w-3 h-3" />}
                                        Calc
                                    </button>
                                ) : (
                                    archive.size
                                )}
                            </td>
                            <td className="px-6 py-4 text-slate-600 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                {archive.duration === 'Unknown' ? '-' : archive.duration}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => activeRepo && onMount(activeRepo, archive.name)}
                                    disabled={isFetchingAll}
                                >
                                    <HardDrive className="w-3 h-3 mr-2" />
                                    Mount
                                </Button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
         </table>
      </div>
    </div>
  );
};

export default ArchivesView;
