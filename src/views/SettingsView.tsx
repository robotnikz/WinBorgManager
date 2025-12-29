

import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { Save, Terminal, Key, Check, Network, Info, Download, Monitor, XCircle, Layout } from 'lucide-react';
import { borgService } from '../services/borgService';

const SettingsView: React.FC = () => {
  const [useWsl, setUseWsl] = useState(true); // Default True
  const [borgPath, setBorgPath] = useState('borg');
  const [borgPassphrase, setBorgPassphrase] = useState('');
  const [disableHostCheck, setDisableHostCheck] = useState(false);
  const [closeToTray, setCloseToTray] = useState(false);
  
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testOutput, setTestOutput] = useState('');

  // Helper to access Electron
  const getElectron = () => {
      try {
          return (window as any).require('electron');
      } catch (e) { return null; }
  };

  useEffect(() => {
    const storedWsl = localStorage.getItem('winborg_use_wsl');
    const storedPath = localStorage.getItem('winborg_executable_path');
    const storedPass = localStorage.getItem('winborg_passphrase');
    const storedHostCheck = localStorage.getItem('winborg_disable_host_check');
    const storedCloseToTray = localStorage.getItem('winborg_close_to_tray');
    
    // Smart Default: If null, use TRUE. If string present, parse it.
    if (storedWsl === null) {
        setUseWsl(true);
    } else {
        setUseWsl(storedWsl === 'true');
    }

    if (storedPath) setBorgPath(storedPath);
    if (storedPass) setBorgPassphrase(storedPass);
    if (storedHostCheck) setDisableHostCheck(storedHostCheck === 'true');
    if (storedCloseToTray) setCloseToTray(storedCloseToTray === 'true');
  }, []);

  const handleSave = () => {
    localStorage.setItem('winborg_use_wsl', String(useWsl));
    localStorage.setItem('winborg_executable_path', borgPath);
    localStorage.setItem('winborg_passphrase', borgPassphrase);
    localStorage.setItem('winborg_disable_host_check', String(disableHostCheck));
    localStorage.setItem('winborg_close_to_tray', String(closeToTray));
    
    // Send Close to Tray setting to backend immediately
    const ipc = getElectron()?.ipcRenderer;
    if (ipc) ipc.send('set-close-behavior', closeToTray);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTestStatus('loading');
    setTestOutput('');
    
    // We run 'borg --version'. 
    // If WSL is checked, this runs 'wsl --exec borg --version'
    // If Native, runs 'borg --version'
    const success = await borgService.runCommand(['--version'], (log) => {
        console.log(log);
        setTestOutput(prev => prev + log);
    });
    setTestStatus(success ? 'success' : 'error');
  };

  const handleCheckUpdate = async () => {
      const ipc = getElectron()?.ipcRenderer;
      if (ipc) {
          await ipc.invoke('check-for-updates');
      } else {
          alert("Updates are handled by Electron Main Process (not available in browser mode)");
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configure application preferences and integrations</p>
      </div>
      
       {/* App Behavior Section */}
       <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
           <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
               <Layout className="w-5 h-5 text-slate-600 dark:text-slate-400" /> Application Behavior
           </h2>
           
           <div className="space-y-4">
               {/* Close to Tray */}
               <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                   <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-full ${closeToTray ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                          {closeToTray ? <Monitor className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" htmlFor="tray-toggle">Close to Tray</label>
                           <p className="text-xs text-slate-500 dark:text-slate-400">
                               {closeToTray 
                                ? "Window minimizes to tray icon when closed." 
                                : "Window quits application when closed."}
                           </p>
                       </div>
                   </div>
                   <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                        <input 
                            type="checkbox" 
                            id="tray-toggle" 
                            className="peer sr-only"
                            checked={closeToTray}
                            onChange={(e) => setCloseToTray(e.target.checked)}
                        />
                        <label htmlFor="tray-toggle" className="block w-12 h-6 bg-gray-200 dark:bg-slate-600 rounded-full cursor-pointer peer-checked:bg-blue-600 transition-colors"></label>
                        <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6"></span>
                    </div>
               </div>

               {/* Updates */}
               <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg">
                   <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600">
                           <Download className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Updates</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Check GitHub repository for new releases</p>
                        </div>
                   </div>
                   <Button variant="secondary" onClick={handleCheckUpdate} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                       Check Now
                   </Button>
               </div>
           </div>
       </div>

       {/* System Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-slate-600 dark:text-slate-400" /> System Integration
        </h2>
        
        {/* Toggle WSL */}
        <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Use Windows Subsystem for Linux (WSL)</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                    Runs Borg inside your default Linux distribution (e.g. Ubuntu). This is the recommended way to use Borg on Windows.
                </p>
            </div>
            <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                <input 
                    type="checkbox" 
                    id="wsl-toggle" 
                    className="peer sr-only"
                    checked={useWsl}
                    onChange={(e) => setUseWsl(e.target.checked)}
                />
                <label htmlFor="wsl-toggle" className="block w-12 h-6 bg-gray-200 dark:bg-slate-600 rounded-full cursor-pointer peer-checked:bg-blue-600 transition-colors"></label>
                <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6"></span>
            </div>
        </div>

        {/* Dynamic Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-5 mb-6 text-sm text-slate-700 dark:text-slate-300 space-y-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" /> 
                {useWsl ? 'Environment: WSL (Ubuntu/Linux)' : 'Environment: Windows Native (Powershell)'}
            </h3>
            
            {useWsl ? (
                <div className="space-y-3">
                    <p className="text-xs">WinBorg will execute commands via <code>wsl --exec borg ...</code>.</p>
                    <p className="text-xs">Ensure Borg and FUSE bindings are installed in your default distro:</p>
                    <div className="bg-slate-900 rounded p-3 font-mono text-xs">
                        <code className="block text-green-400 select-all cursor-pointer" onClick={() => navigator.clipboard.writeText('sudo apt update && sudo apt install borgbackup fuse3 libfuse2 python3-llfuse python3-pyfuse3 -y && sudo chmod 666 /dev/fuse')}>
                            sudo apt update && sudo apt install borgbackup fuse3 libfuse2 python3-llfuse python3-pyfuse3 -y
                        </code>
                        <div className="text-slate-500 text-[10px] mt-1 text-right">(Click to copy)</div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                     <p className="text-xs font-semibold text-red-500">Warning: Borg binaries for Windows are experimental.</p>
                     <p className="text-xs">The easiest way is using <a href="https://scoop.sh" target="_blank" className="underline text-blue-600">Scoop</a>.</p>
                     <div className="bg-slate-900 rounded p-3 font-mono text-xs text-yellow-400">
                        <code className="block select-all cursor-pointer" onClick={() => navigator.clipboard.writeText('scoop bucket add extras && scoop install borgbackup')}>
                            scoop bucket add extras<br/>scoop install borgbackup
                        </code>
                    </div>
                </div>
            )}
        </div>

        <div className="space-y-6">
            {!useWsl && (
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Borg Command / Path</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" 
                        value={borgPath}
                        onChange={(e) => setBorgPath(e.target.value)}
                        placeholder="borg"
                    />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">If 'borg' is in your PATH, leave as is. Otherwise paste full path to borg.exe.</p>
            </div>
            )}

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default Passphrase (Fallback)</label>
                <div className="flex gap-2 relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="password" 
                        className="flex-1 pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={borgPassphrase}
                        onChange={(e) => setBorgPassphrase(e.target.value)}
                        placeholder="••••••••••••"
                    />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    Used automatically if a repository does <b>not</b> have a specific passphrase saved.
                </p>
            </div>

            {/* SSH Options */}
             <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                 <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                     <Network className="w-4 h-4" /> SSH & Connection
                 </h3>
                 <div className="flex items-center gap-3">
                     <input 
                        type="checkbox" 
                        id="host-check" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={disableHostCheck}
                        onChange={(e) => setDisableHostCheck(e.target.checked)}
                     />
                     <div>
                         <label htmlFor="host-check" className="text-sm font-medium text-slate-800 dark:text-slate-200">Disable Strict Host Key Checking</label>
                         <p className="text-xs text-slate-500 dark:text-slate-400">
                             Essential for automation. Automatically accepts new SSH host keys.
                         </p>
                     </div>
                 </div>
             </div>
            
            <div className="pt-4">
                 <Button 
                    variant="secondary" 
                    onClick={handleTest}
                    disabled={testStatus === 'loading'}
                    className={`w-full ${testStatus === 'success' ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20' : testStatus === 'error' ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-900/20' : 'dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'}`}
                >
                    {testStatus === 'loading' ? 'Testing Connection...' : testStatus === 'success' ? 'Borg Found & Working!' : testStatus === 'error' ? 'Borg Not Found / Error' : 'Test Borg Installation'}
                </Button>
                {testStatus === 'error' && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded border border-red-100 dark:border-red-900 font-mono whitespace-pre-wrap">
                        {testOutput || "Could not execute command. Check if installed."}
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-slate-700">
        <Button size="lg" onClick={handleSave} className={saved ? "bg-green-600 hover:bg-green-700" : ""}>
            {saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />} 
            {saved ? "Saved" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsView;
