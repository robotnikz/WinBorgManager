import React from 'react';
import { HardDrive, Server, Settings, Save, LayoutDashboard, Database, Activity } from 'lucide-react';
import { View } from '../types';

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
    <div className="w-64 flex flex-col h-full bg-gray-50/50 border-r border-gray-200/50 backdrop-blur-xl pt-6 px-3 select-none">
      <div className="flex items-center gap-3 px-4 mb-8">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
          <Save className="text-white w-5 h-5" />
        </div>
        <span className="font-bold text-lg text-slate-800 tracking-tight">WinBorg</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onChangeView(item.view)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              currentView === item.view
                ? 'bg-white shadow-sm text-blue-600 ring-1 ring-black/5'
                : 'text-slate-600 hover:bg-gray-200/50'
            }`}
          >
            <item.icon className={`w-4 h-4 ${currentView === item.view ? 'text-blue-600' : 'text-slate-500'}`} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="pb-4">
        <button
          onClick={() => onChangeView(View.SETTINGS)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
            currentView === View.SETTINGS
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-slate-600 hover:bg-gray-200/50'
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