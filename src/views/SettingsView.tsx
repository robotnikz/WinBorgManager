import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { User, Save, Terminal, Shield, Check, Key, AlertTriangle, ExternalLink, RefreshCw, Network } from 'lucide-react';
import { borgService } from '../services/borgService';

const SettingsView: React.FC = () => {
  const [useWsl, setUseWsl] = useState(false);
  const [borgPath, setBorgPath] = useState('borg');
  const [borgPassphrase, setBorgPassphrase] = useState('');
  const [disableHostCheck, setDisableHostCheck] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    const storedWsl = localStorage.getItem('winborg_use_wsl');
    const storedPath = localStorage.getItem('winborg_executable_path');
    const storedPass = localStorage.getItem('winborg_passphrase');
    const storedHostCheck = localStorage.getItem('winborg_disable_host_check');
    
    if (storedWsl) setUseWsl(storedWsl === 'true');
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
    const success = await borgService.runCommand(['--version'], (log) => console.log(log));
    setTestStatus(success ? 'success' : 'error');
    setTimeout(() => setTestStatus('idle'), 3000);
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
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">RECOMMENDED</span>
                </div>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                    Runs Borg inside your default Linux distribution instead of using Windows binaries. More stable and supports FUSE mounts better.
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
                <AlertTriangle className="w-4 h-4 text-blue-500" /> 
                {useWsl ? 'How to set up WSL (Simple Guide)' : 'Windows Native Setup'}
            </h3>
            
            {useWsl ? (
                <div className="space-y-3">
                    <p className="text-xs">1. Open PowerShell as Admin and run <code>wsl --install</code>, then restart PC.</p>
                    <p className="text-xs">2. Open "Ubuntu" from Start menu, create user/password.</p>
                    <p className="text-xs">3. Run this command inside Ubuntu to get Borg:</p>
                    <div className="bg-slate-900 rounded p-3 font-mono text-xs">
                        <code className="block text-green-400 select-all cursor-pointer" onClick={() => navigator.clipboard.writeText('sudo apt update && sudo apt install borgbackup fuse -y')}>
                            sudo apt update && sudo apt install borgbackup fuse -y
                        </code>
                        <div className="text-slate-500 text-[10px] mt-1 text-right">(Click to copy)</div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                     <p>Use Scoop to install Borg on Windows directly.</p>
                     <code className="block bg-slate-900 text-yellow-400 p-2 rounded text-xs font-mono">
                        scoop bucket add extras && scoop install borgbackup
                    </code>
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
            </div>
            )}

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Global Repository Passphrase</label>
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
                             Automatically accept unknown SSH host keys. Essential for automated connections, but less secure against Man-in-the-Middle attacks.
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
                    {testStatus === 'loading' ? 'Testing Connection...' : testStatus === 'success' ? 'Connection Successful!' : testStatus === 'error' ? 'Test Failed (Is WSL installed?)' : 'Test Borg Connection'}
                </Button>
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