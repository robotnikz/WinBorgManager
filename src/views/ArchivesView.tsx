
import React, { useState } from 'react';
import { Archive, Repository } from '../types';
import Button from '../components/Button';
import { Database, Clock, HardDrive, Search, Filter, Calendar, RefreshCw, Info, DownloadCloud, Loader2, ListChecks, FolderSearch, GitCompare } from 'lucide-react';
import ArchiveBrowserModal from '../components/ArchiveBrowserModal';
import TerminalModal from '../components/TerminalModal';
import ExtractionSuccessModal from '../components/ExtractionSuccessModal';
import { borgService } from '../services/borgService';

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
  
  // Selection for Diff
  const [selectedArchives, setSelectedArchives] = useState<string[]>([]);
  const [diffLogs, setDiffLogs] = useState<string[]>([]);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);
  
  // Browser Modal State
  const [browserArchive, setBrowserArchive] = useState<Archive | null>(null);
  
  // Log Modal State (for extraction errors)
  const [logData, setLogData] = useState<{title: string, logs: string[]} | null>(null);

  // Success Modal State
  const [successPath, setSuccessPath] = useState<string | null>(null);

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
      const targets = filteredArchives.filter(a => a.size === 'Unknown');
      
      for (const archive of targets) {
          if (!activeRepo) break; 
          setLoadingInfo(archive.name);
          try {
              await onGetInfo(archive.name);
          } catch (e) {
              console.error(`Failed to fetch info for ${archive.name}`, e);
          }
          await new Promise(r => setTimeout(r, 200));
      }
      
      setLoadingInfo(null);
      setIsFetchingAll(false);
  };

  const toggleSelection = (archiveName: string) => {
      if (selectedArchives.includes(archiveName)) {
          setSelectedArchives(prev => prev.filter(n => n !== archiveName));
      } else {
          // Max 2
          if (selectedArchives.length < 2) {
             setSelectedArchives(prev => [...prev, archiveName]);
          } else {
             // Replace last
             setSelectedArchives(prev => [prev[0], archiveName]);
          }
      }
  };

  const handleCompare = async () => {
      if (selectedArchives.length !== 2 || !activeRepo) return;
      setIsDiffing(true);
      setIsDiffOpen(true);
      setDiffLogs([]);

      // Sort chronological roughly? (Assume names contain dates or ID order in list is chrono reversed)
      // Usually borg diff old new
      // We pass them in order of selection, user needs to understand output
      
      try {
          await borgService.diffArchives(
              activeRepo.url,
              selectedArchives[1], // Newer (Usually higher in list if selecting top down)
              selectedArchives[0], // Older
              (log) => setDiffLogs(prev => [...prev, log]),
              { repoId: activeRepo.id, disableHostCheck: activeRepo.trustHost }
          );
      } catch (e) {
          console.error(e);
      } finally {
          setIsDiffing(false);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Archive Browser Modal */}
      {browserArchive && activeRepo && (
          <ArchiveBrowserModal 
             repo={activeRepo}
             archive={browserArchive}
             isOpen={!!browserArchive}
             onClose={() => setBrowserArchive(null)}
             onLog={(title, logs) => setLogData({ title, logs })}
             onExtractSuccess={(path) => setSuccessPath(path)}
          />
      )}

      {/* Extraction Log Modal (Errors) */}
      {logData && (
          <TerminalModal 
              isOpen={!!logData}
              title={logData.title}
              logs={logData.logs}
              isProcessing={false}
              onClose={() => setLogData(null)}
          />
      )}
      
      {/* Diff Output Modal */}
      <TerminalModal 
          isOpen={isDiffOpen}
          title={`Comparing: ${selectedArchives[0]} vs ${selectedArchives[1]}`}
          logs={diffLogs}
          isProcessing={isDiffing}
          onClose={() => setIsDiffOpen(false)}
      />

      {/* Extraction Success Modal */}
      <ExtractionSuccessModal 
          isOpen={!!successPath}
          path={successPath || ''}
          onClose={() => setSuccessPath(null)}
      />

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Archives</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
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
                  className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64 transition-colors"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            
            {/* Diff Button */}
            {selectedArchives.length === 2 && (
                <Button 
                    onClick={handleCompare}
                    className="bg-purple-600 hover:bg-purple-700 text-white animate-in zoom-in"
                >
                    <GitCompare className="w-4 h-4 mr-2" />
                    Diff ({selectedArchives.length})
                </Button>
            )}
            
            <Button 
                variant="secondary" 
                onClick={handleFetchAllStats} 
                title="Fetch size & duration for all archives" 
                disabled={!activeRepo || isFetchingAll || filteredArchives.every(a => a.size !== 'Unknown')}
                className={isFetchingAll ? "bg-blue-50 text-blue-600 border-blue-200" : "dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"}
            >
                {isFetchingAll ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ListChecks className="w-4 h-4 mr-2" />}
                {isFetchingAll ? "Fetching..." : "Get All Stats"}
            </Button>

            <Button variant="secondary" onClick={onRefresh} title="Refresh Archives List" disabled={!activeRepo || isFetchingAll} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                <RefreshCw className="w-4 h-4" />
            </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
         <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium border-b border-gray-100 dark:border-slate-700">
                <tr>
                    <th className="px-3 py-3 w-10"></th>
                    <th className="px-6 py-3">Archive Name</th>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Size</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredArchives.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                            <Database className="w-8 h-8 mx-auto mb-3 opacity-50" />
                            <p className="mb-4">{activeRepo ? "No archives found or list is empty." : "Connect to a repository to see archives."}</p>
                            {activeRepo && (
                                <Button variant="secondary" onClick={onRefresh} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Load Archives for {activeRepo.name}
                                </Button>
                            )}
                        </td>
                    </tr>
                ) : (
                    filteredArchives.map((archive) => {
                        const isSelected = selectedArchives.includes(archive.name);
                        return (
                        <tr key={archive.id} className={`hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors group ${isSelected ? 'bg-purple-50 dark:bg-purple-900/10' : ''}`}>
                            <td className="px-3 py-4 text-center">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                    checked={isSelected}
                                    onChange={() => toggleSelection(archive.name)}
                                />
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <Database className="w-4 h-4" />
                                </div>
                                {archive.name}
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    {archive.time}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono">
                                {archive.size === 'Unknown' ? (
                                    <button 
                                        onClick={() => handleGetInfo(archive.name)}
                                        className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded transition-colors"
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
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                {archive.duration === 'Unknown' ? '-' : archive.duration}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
                                        onClick={() => setBrowserArchive(archive)}
                                        disabled={isFetchingAll}
                                    >
                                        <FolderSearch className="w-3 h-3 mr-2" />
                                        Browse
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
                                        onClick={() => activeRepo && onMount(activeRepo, archive.name)}
                                        disabled={isFetchingAll}
                                    >
                                        <HardDrive className="w-3 h-3 mr-2" />
                                        Mount
                                    </Button>
                                </div>
                            </td>
                        </tr>
                        );
                    })
                )}
            </tbody>
         </table>
      </div>
    </div>
  );
};

export default ArchivesView;
