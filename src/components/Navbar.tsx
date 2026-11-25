import React, { useState } from 'react';
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
  Menu,
  X,
} from 'lucide-react';
import type { DriveInfo } from '../types';
import { formatBytes } from '../utils';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  drives: DriveInfo[];
}

interface NavGroup {
  title: string;
  items: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accent?: boolean;
  }[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview & Health',
    items: [
      { id: 'drives', label: 'Drives Overview', icon: HardDrive },
      { id: 'health', label: 'Health & S.M.A.R.T.', icon: ShieldAlert },
    ],
  },
  {
    title: 'Clean & Reclaim',
    items: [
      { id: 'liberator', label: 'C: Drive Liberator', icon: Sparkles },
      { id: 'vacuum', label: 'Dev Vacuum', icon: Flame },
      { id: 'giants', label: 'Giant File Hunter', icon: Search },
    ],
  },
  {
    title: 'Move & Organize',
    items: [
      { id: 'redirector', label: 'Folder Redirector', icon: FolderInput },
      { id: 'junctions', label: 'Junction Mover', icon: FolderSync },
      { id: 'blueprints', label: 'Drive Blueprints', icon: FolderPlus },
      { id: 'organizer', label: 'Downloads Sorter', icon: FolderArchive },
    ],
  },
  {
    title: 'Support',
    items: [{ id: 'help', label: 'Help & User Guide', icon: HelpCircle, accent: true }],
  },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onRefresh,
  isRefreshing,
  drives,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const cDrive = drives.find((d) => d.letter.toUpperCase().startsWith('C'));

  const handleSelect = (id: string) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Logo & Name */}
      <div
        className="flex items-center gap-3 px-4 h-16 border-b border-gray-800/80 cursor-pointer group shrink-0"
        onClick={() => handleSelect('drives')}
        title="Return to Drives Overview"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/35 transition-all">
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(6, 182, 212, 0.12)" />
              <circle cx="12" cy="11" r="3" fill="#38bdf8" stroke="#38bdf8" />
              <path d="M12 14v3" stroke="#38bdf8" strokeWidth="2.5" />
            </svg>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold text-white tracking-tight">CacheVault</h1>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
              PRO
            </span>
          </div>
          <p className="text-[11px] text-gray-400 font-medium">Windows Storage Suite</p>
        </div>
      </div>

      {/* Categorized Navigation Links (All visible, zero horizontal scroll) */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                      isActive
                        ? item.accent
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/25 font-semibold'
                          : 'bg-blue-600 text-white shadow-md shadow-blue-600/25 font-semibold'
                        : item.accent
                        ? 'text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/10'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800/70'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : item.accent ? 'text-cyan-400' : 'text-gray-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Drive Status + Refresh */}
      <div className="p-3 border-t border-gray-800/80 space-y-2.5 shrink-0 bg-[#090D16]">
        {cDrive && (
          <div className="px-3 py-2 rounded-xl bg-dark-800/80 border border-gray-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-medium">System C: Free</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatBytes(cDrive.free_bytes)}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  cDrive.percent_used > 85 ? 'bg-red-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(cDrive.percent_used, 100)}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-200 text-xs font-medium transition-colors border border-gray-700 disabled:opacity-50"
          title="Refresh all mounted drives"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Drives'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Persistent Desktop Left Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-[#0E1422] border-r border-gray-800/90 shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Compact Top Bar for narrow windows (< md) */}
      <header className="md:hidden bg-[#0E1422] border-b border-gray-800 sticky top-0 z-50 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => handleSelect('drives')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5 flex items-center justify-center">
            <div className="w-full h-full bg-[#0B0F19] rounded-[6px] flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <span className="text-sm font-bold text-white">CacheVault Pro</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700"
            title="Refresh drives"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg bg-gray-800 text-gray-200 border border-gray-700"
            title="Open navigation menu"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 max-w-[80vw] bg-[#0E1422] border-r border-gray-800 h-full z-10">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
};
