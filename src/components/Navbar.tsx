import React from 'react';
import {
  HardDrive,
  Sparkles,
  FolderSync,
  ShieldAlert,
  RefreshCw,
  FolderPlus,
  FolderInput,
  Flame,
  Search,
  FolderArchive,
  HelpCircle,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onRefresh,
  isRefreshing,
}) => {
  const tabs = [
    { id: 'drives', label: 'Drives', icon: HardDrive },
    { id: 'liberator', label: 'C: Liberator', icon: Sparkles },
    { id: 'redirector', label: 'Folder Redirector', icon: FolderInput },
    { id: 'junctions', label: 'Junction Mover', icon: FolderSync },
    { id: 'blueprints', label: 'Drive Blueprints', icon: FolderPlus },
    { id: 'vacuum', label: 'Dev Vacuum', icon: Flame },
    { id: 'giants', label: 'Giant Files', icon: Search },
    { id: 'organizer', label: 'Downloads Sorter', icon: FolderArchive },
    { id: 'health', label: 'Health S.M.A.R.T.', icon: ShieldAlert },
    { id: 'help', label: 'Help & Guide', icon: HelpCircle },
  ];

  return (
    <header className="bg-dark-800/95 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50 shadow-lg shadow-black/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Logo & Name */}
          <div
            className="flex items-center gap-3 flex-shrink-0 cursor-pointer group"
            onClick={() => setActiveTab('drives')}
            title="Return to Drives Overview"
          >
            {/* Simple, crisp, iconic Vault Shield SVG */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/35 transition-all">
              <div className="w-full h-full bg-[#0B0F19] rounded-[10px] flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 text-cyan-400 group-hover:scale-105 transition-transform"
                >
                  {/* Shield Vault outline */}
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(6, 182, 212, 0.12)" />
                  {/* Vault Lock Center */}
                  <circle cx="12" cy="11" r="3" fill="#38bdf8" stroke="#38bdf8" />
                  <path d="M12 14v3" stroke="#38bdf8" strokeWidth="2.5" />
                </svg>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  CacheVault
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">Windows Storage Suite</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-dark-900/80 p-1 rounded-xl border border-gray-800/90 overflow-x-auto max-w-[62%]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isHelp = tab.id === 'help';
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? isHelp
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30 font-semibold'
                        : 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                      : isHelp
                      ? 'text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/10 font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isHelp && !isActive ? 'text-cyan-400' : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right Action */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-200 text-xs font-medium transition-colors border border-gray-700 disabled:opacity-50"
              title="Refresh all drives"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
