import React from 'react';
import { HardDrive, Server, Settings, LayoutDashboard, Database, Activity } from 'lucide-react';
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

  return (
    <div className="w-64 flex flex-col h-full bg-gray-50/50 dark:bg-slate-900/50 border-r border-gray-200/50 dark:border-slate-800 backdrop-blur-xl pt-6 px-3 select-none transition-colors duration-300">
      <div className="flex items-center gap-3 px-4 mb-8">
        <div className="shadow-lg shadow-blue-500/20 rounded-xl overflow-hidden shrink-0">
            <AppLogo className="w-10 h-10" />
        </div>
        <div className="min-w-0">
            <span className="font-bold text-lg text-slate-800 dark:text-slate-100 tracking-tight block leading-none">WinBorg</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Manager</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
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

      <div className="pb-4">
        <button
          onClick={() => onChangeView(View.SETTINGS)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
            currentView === View.SETTINGS
              ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </div>
  );
};

export default Sidebar;