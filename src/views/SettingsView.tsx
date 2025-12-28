
import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { Save, Terminal, Key, Check, Network, Info } from 'lucide-react';
import { borgService } from '../services/borgService';

const SettingsView: React.FC = () => {
  const [useWsl, setUseWsl] = useState(true); // Default True
  const [borgPath, setBorgPath] = useState('borg');
  const [borgPassphrase, setBorgPassphrase] = useState('');
  const [disableHostCheck, setDisableHostCheck] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testOutput, setTestOutput] = useState('');

  useEffect(() => {
    const storedWsl = localStorage.getItem('winborg_use_wsl');
    const storedPath = localStorage.getItem('winborg_executable_path');
    const storedPass = localStorage.getItem('winborg_passphrase');
    const storedHostCheck = localStorage.getItem('winborg_disable_host_check');
    
    // Smart Default: If null, use TRUE. If string present, parse it.
    if (storedWsl === null) {
        setUseWsl(true);
    } else {
        setUseWsl(storedWsl === 'true');
    }

    if (storedPath) setBorgPath(storedPath);
    if (storedPass) setBorgPassphrase(storedPass);
    if (storedHostCheck) setDisableHostCheck(storedHostCheck === 'true');
  }, []);

  const handleSave = () => {
    localStorage.setItem('winborg_use_wsl', String(useWsl));
    localStorage.setItem('winborg_executable_path', borgPath);
    localStorage.setItem('winborg_passphrase', borgPassphrase);
    localStorage.setItem('winborg_disable_host_check', String(disableHostCheck));
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure application preferences and integrations</p>
      </div>
      
       {/* System Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-slate-600" /> System Integration
        </h2>
        
        {/* Toggle WSL */}
        <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">Use Windows Subsystem for Linux (WSL)</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                </div>
                <p className="text-xs text-slate-500 max-w-md mt-1">
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
                <label htmlFor="wsl-toggle" className="block w-12 h-6 bg-gray-200 rounded-full cursor-pointer peer-checked:bg-blue-600 transition-colors"></label>
                <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6"></span>
            </div>
        </div>

        {/* Dynamic Instructions */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 mb-6 text-sm text-slate-700 space-y-4">
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Borg Command / Path</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" 
                        value={borgPath}
                        onChange={(e) => setBorgPath(e.target.value)}
                        placeholder="borg"
                    />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">If 'borg' is in your PATH, leave as is. Otherwise paste full path to borg.exe.</p>
            </div>
            )}

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Passphrase (Fallback)</label>
                <div className="flex gap-2 relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="password" 
                        className="flex-1 pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={borgPassphrase}
                        onChange={(e) => setBorgPassphrase(e.target.value)}
                        placeholder="••••••••••••"
                    />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    Used automatically if a repository does <b>not</b> have a specific passphrase saved.
                </p>
            </div>

            {/* SSH Options */}
             <div className="pt-4 border-t border-gray-100">
                 <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
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
                         <label htmlFor="host-check" className="text-sm font-medium text-slate-800">Disable Strict Host Key Checking</label>
                         <p className="text-xs text-slate-500">
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
                    className={`w-full ${testStatus === 'success' ? 'border-green-500 text-green-600 bg-green-50' : testStatus === 'error' ? 'border-red-500 text-red-600 bg-red-50' : ''}`}
                >
                    {testStatus === 'loading' ? 'Testing Connection...' : testStatus === 'success' ? 'Borg Found & Working!' : testStatus === 'error' ? 'Borg Not Found / Error' : 'Test Borg Installation'}
                </Button>
                {testStatus === 'error' && (
                    <div className="mt-2 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-100 font-mono whitespace-pre-wrap">
                        {testOutput || "Could not execute command. Check if installed."}
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <Button size="lg" onClick={handleSave} className={saved ? "bg-green-600 hover:bg-green-700" : ""}>
            {saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />} 
            {saved ? "Saved" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsView;
