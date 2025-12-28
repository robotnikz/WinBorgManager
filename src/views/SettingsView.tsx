import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { User, Save, Terminal, Shield, Check, Key, AlertTriangle, ExternalLink, Copy } from 'lucide-react';
import { borgService } from '../services/borgService';

const SettingsView: React.FC = () => {
  const [borgPath, setBorgPath] = useState('borg');
  const [borgPassphrase, setBorgPassphrase] = useState('');
  const [disableHostKeyCheck, setDisableHostKeyCheck] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    const storedPath = localStorage.getItem('winborg_executable_path');
    const storedPass = localStorage.getItem('winborg_passphrase');
    const storedHostCheck = localStorage.getItem('winborg_disable_host_check');
    
    // Default to 'borg' if nothing is stored, as that's standard for Scoop/Choco
    if (storedPath) setBorgPath(storedPath);
    if (storedPass) setBorgPassphrase(storedPass);
    if (storedHostCheck) setDisableHostKeyCheck(storedHostCheck === 'true');
  }, []);

  const handleSave = () => {
    localStorage.setItem('winborg_executable_path', borgPath);
    localStorage.setItem('winborg_passphrase', borgPassphrase);
    localStorage.setItem('winborg_disable_host_check', String(disableHostKeyCheck));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTestStatus('loading');
    const success = await borgService.runCommand(['--version'], (log) => console.log(log));
    setTestStatus(success ? 'success' : 'error');
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
        
        {/* Helper Box for Installation */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-6 text-sm text-slate-700 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> 
                How to get Borg on Windows 11
            </h3>
            <p className="text-slate-600">
                Official standalone binaries are scarce for recent versions. We recommend using a package manager.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded border border-gray-200 shadow-sm">
                    <div className="font-semibold text-slate-800 mb-2 flex items-center justify-between">
                        Option A: Scoop (Recommended)
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Best</span>
                    </div>
                    <code className="block bg-slate-900 text-green-400 p-2 rounded text-xs font-mono mb-2">
                        scoop install borgbackup
                    </code>
                    <p className="text-xs text-slate-500">Installs a shim automatically added to your PATH.</p>
                </div>

                <div className="bg-white p-3 rounded border border-gray-200 shadow-sm">
                    <div className="font-semibold text-slate-800 mb-2">Option B: Chocolatey</div>
                    <code className="block bg-slate-900 text-yellow-400 p-2 rounded text-xs font-mono mb-2">
                        choco install borgbackup
                    </code>
                    <p className="text-xs text-slate-500">Run PowerShell as Administrator.</p>
                </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
                <p className="flex items-center gap-2 font-medium">
                    <ExternalLink className="w-3 h-3" />
                    Don't forget <a href="https://winfsp.dev/rel/" target="_blank" className="text-blue-600 underline hover:text-blue-800">WinFSP</a> for mounting support!
                </p>
            </div>
        </div>

        <div className="space-y-6">
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
                    <Button 
                        variant="secondary" 
                        onClick={handleTest}
                        disabled={testStatus === 'loading'}
                        className={testStatus === 'success' ? 'border-green-500 text-green-600 bg-green-50' : testStatus === 'error' ? 'border-red-500 text-red-600 bg-red-50' : ''}
                    >
                        {testStatus === 'loading' ? 'Testing...' : testStatus === 'success' ? 'Working!' : testStatus === 'error' ? 'Failed' : 'Test Command'}
                    </Button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                    If installed via Scoop/Choco, just type <code>borg</code>. Otherwise, provide the full path to <code>borg.exe</code>.
                </p>
            </div>

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
        </div>
      </div>
      
      {/* Connection Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-600" /> SSH Connection
        </h2>
        
        <div className="flex items-center justify-between">
            <div>
                <label className="text-sm font-medium text-slate-900">Disable Strict Host Key Checking</label>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                    Prevents connection hangs by automatically accepting new SSH keys. 
                    <span className="text-amber-600 ml-1">Warning: Less secure, but recommended for first-time connections in this app.</span>
                </p>
            </div>
            <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                <input 
                    type="checkbox" 
                    id="host-check" 
                    className="peer sr-only"
                    checked={disableHostKeyCheck}
                    onChange={(e) => setDisableHostKeyCheck(e.target.checked)}
                />
                <label htmlFor="host-check" className="block w-12 h-6 bg-gray-200 rounded-full cursor-pointer peer-checked:bg-blue-600 transition-colors"></label>
                <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6"></span>
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