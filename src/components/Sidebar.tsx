import React from 'react';
import { HardDrive, Server, Settings, LayoutDashboard, Database, Activity, Github, User, ExternalLink } from 'lucide-react';
import { View } from '../types';
import AppLogo from './AppLogo';

interface SidebarProps {
  currentView: View;
  onChangeView: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { view: View.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { view: View.REPOSITORIES, label: 'Repositories', icon: Server },
    { view: View.ARCHIVES, label: 'Archives', icon: Database },
    { view: View.MOUNTS, label: 'Mounts', icon: HardDrive },
    { view: View.ACTIVITY, label: 'Activity', icon: Activity },
  ];

  // User Config (Hardcoded for now as requested, could be dynamic later)
  const userProfile = {
      name: "Tobia",
      email: "tobia@example.com",
      license: "Pro License",
      repo: "robotnikz/WinBorg"
  };

  const handleOpenRepo = (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
          const { shell } = (window as any).require('electron');
          shell.openExternal(`https://github.com/${userProfile.repo}`);
      } catch(err) {
          window.open(`https://github.com/${userProfile.repo}`, '_blank');
      }
  };

  return (
    <div className="w-64 flex flex-col h-full bg-gray-50/50 dark:bg-slate-900/50 border-r border-gray-200/50 dark:border-slate-800 backdrop-blur-xl pt-6 select-none transition-colors duration-300">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 px-6 mb-8">
        <div className="shadow-lg shadow-blue-500/20 rounded-xl overflow-hidden shrink-0">
            <AppLogo className="w-10 h-10" />
        </div>
        <div className="min-w-0">
            <span className="font-bold text-lg text-slate-800 dark:text-slate-100 tracking-tight block leading-none">WinBorg</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Manager</span>
        </div>
      </div>

      {/* NAV ITEMS */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onChangeView(item.view)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              currentView === item.view
                ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400 ring-1 ring-black/5 dark:ring-white/5'
                : 'text-slate-600 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <item.icon className={`w-4 h-4 ${currentView === item.view ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-500'}`} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* BOTTOM SECTION */}
      <div className="p-3">
        {/* Settings Button */}
        <button
          onClick={() => onChangeView(View.SETTINGS)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 mb-3 ${
            currentView === View.SETTINGS
              ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>

        {/* User Profile Footer */}
        <div className="border-t border-gray-200 dark:border-slate-800 pt-4 mt-2 px-2 pb-4">
            <div className="flex items-center gap-3 group p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all cursor-default">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    {userProfile.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{userProfile.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={userProfile.email}>{userProfile.email}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">
                            {userProfile.license}
                        </span>
                        <button 
                            onClick={handleOpenRepo}
                            className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-blue-500 transition-colors" 
                            title="Open GitHub Repo"
                        >
                            <Github className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
