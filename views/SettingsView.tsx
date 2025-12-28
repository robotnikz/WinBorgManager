import React from 'react';
import Button from '../components/Button';
import { User, Moon, Sun, Monitor, Save, Terminal, Shield } from 'lucide-react';

const SettingsView: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure application preferences and integrations</p>
      </div>

      {/* Account Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-500" /> Account
        </h2>
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md">
                AB
            </div>
            <div>
                <h3 className="font-medium text-slate-900">Admin User</h3>
                <p className="text-sm text-slate-500">System Administrator • WinBorg Pro License</p>
            </div>
            <div className="ml-auto">
                <Button variant="secondary" size="sm">Manage Subscription</Button>
            </div>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-purple-500" /> Appearance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Light', icon: Sun, active: true },
              { name: 'Dark', icon: Moon, active: false },
              { name: 'System', icon: Monitor, active: false }
            ].map((theme) => (
                <button key={theme.name} className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${theme.active ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                    <theme.icon className={`w-6 h-6 mb-2 ${theme.active ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium ${theme.active ? 'text-blue-700' : 'text-slate-600'}`}>{theme.name}</span>
                </button>
            ))}
        </div>
      </div>
      
       {/* System Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-slate-600" /> System Integration
        </h2>
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Borg Binary Path</label>
                <div className="flex gap-2">
                    <input type="text" className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-slate-600 bg-gray-50 focus:outline-none" value="C:\Program Files\Borg\bin\borg.exe" readOnly />
                    <Button variant="secondary">Browse</Button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Path to the local borg.exe executable.</p>
            </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mount Drive Letter Strategy</label>
                <div className="relative">
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-slate-700 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                      <option>Auto-assign first available (Z:, Y:, ...)</option>
                      <option>Always ask</option>
                      <option>Use fixed drive letter (B:)</option>
                  </select>
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </div>
        </div>
      </div>

       {/* Security Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" /> Security
        </h2>
        <div className="flex items-center justify-between py-2">
            <div>
                <h4 className="text-sm font-medium text-slate-900">Remember Passphrases</h4>
                <p className="text-xs text-slate-500">Store repository keys in Windows Credential Manager</p>
            </div>
            <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle" className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer translate-x-4"/>
                <label htmlFor="toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-blue-500 cursor-pointer"></label>
            </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <Button size="lg">
            <Save className="w-4 h-4 mr-2" /> Save Changes
        </Button>
      </div>
    </div>
  );
};

export default SettingsView;
