import React from 'react';
import { Activity, Clock, Terminal } from 'lucide-react';

const ActivityView: React.FC = () => {
    // Mock data since we don't have a persistent DB for logs yet
    const logs = [
        { id: 1, title: 'Backup Successful', detail: 'Hetzner StorageBox: Added 1.2GB', time: '2 hours ago', status: 'success', cmd: 'borg create ...' },
        { id: 2, title: 'Archive Pruned', detail: 'Removed 3 old archives (policy: 7d, 4w)', time: '5 hours ago', status: 'success', cmd: 'borg prune ...' },
        { id: 3, title: 'Connection Retry', detail: 'Local NAS (Timeout) - Retrying in 30s', time: '1 day ago', status: 'warning', cmd: 'borg list ...' },
        { id: 4, title: 'Integrity Check Passed', detail: 'No corruption found in 45,000 chunks', time: '2 days ago', status: 'success', cmd: 'borg check ...' },
        { id: 5, title: 'Mount Started', detail: 'Mounted files-2023-10-27 to Z:', time: '3 days ago', status: 'info', cmd: 'borg mount ...' },
        { id: 6, title: 'Mount Stopped', detail: 'Unmounted Z:', time: '3 days ago', status: 'info', cmd: 'borg umount ...' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Activity Log</h1>
                <p className="text-slate-500 text-sm mt-1">History of operations and background tasks</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-100">
                    {logs.map((log) => (
                        <div key={log.id} className="p-6 hover:bg-slate-50 transition-colors flex gap-4 items-start group">
                            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                                log.status === 'success' ? 'bg-green-500' : 
                                log.status === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}></div>
                            
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-semibold text-slate-800 text-sm">{log.title}</h3>
                                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {log.time}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 mt-1">{log.detail}</p>
                                
                                <div className="mt-3 bg-slate-900 rounded p-2 hidden group-hover:block animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 border-b border-slate-700 pb-1">
                                        <Terminal className="w-3 h-3" />
                                        <span>Command Executed</span>
                                    </div>
                                    <code className="text-xs font-mono text-green-400">{log.cmd}</code>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ActivityView;