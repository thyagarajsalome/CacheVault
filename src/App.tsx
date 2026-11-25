import React, { useState, useEffect } from 'react';
import { Navbar, NAV_GROUPS } from './components/Navbar';
import { DriveOverview } from './components/DriveOverview';
import { ClutterLiberator } from './components/ClutterLiberator';
import { FolderJunctionMover } from './components/FolderJunctionMover';
import { FolderRedirector } from './components/FolderRedirector';
import { BlueprintGenerator } from './components/BlueprintGenerator';
import { DevVacuum } from './components/DevVacuum';
import { GiantFilesHunter } from './components/GiantFilesHunter';
import { DownloadsSorter } from './components/DownloadsSorter';
import { HealthWatchdog } from './components/HealthWatchdog';
import { HelpGuide } from './components/HelpGuide';
import type { DriveInfo } from './types';
import { invoke } from '@tauri-apps/api/core';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('drives');
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(true);

  const fetchDrives = async () => {
    setIsRefreshing(true);
    try {
      const result = await invoke<DriveInfo[]>('get_drives');
      setDrives(result);
    } catch (e) {
      console.error('Failed to query drives:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDrives();
  }, []);

  const currentNavItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeTab);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col md:flex-row font-sans selection:bg-cyan-600 selection:text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={fetchDrives}
        isRefreshing={isRefreshing}
        drives={drives}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Contextual Top Bar */}
        <div className="hidden md:flex items-center justify-between px-8 h-14 border-b border-gray-800/70 bg-[#0B0F19]/90 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>CacheVault Pro</span>
            <span className="text-gray-600">/</span>
            <span className="text-white font-semibold">{currentNavItem?.label || 'Workspace'}</span>
          </div>
          <button
            onClick={() => setActiveTab('help')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            How to use this feature?
          </button>
        </div>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7">
          {activeTab === 'drives' && (
            <DriveOverview
              drives={drives}
              isLoading={isRefreshing}
              onOpenLiberator={() => setActiveTab('liberator')}
              onOpenJunctions={() => setActiveTab('junctions')}
            />
          )}

          {activeTab === 'liberator' && <ClutterLiberator />}

          {activeTab === 'redirector' && <FolderRedirector />}

          {activeTab === 'junctions' && <FolderJunctionMover />}

          {activeTab === 'blueprints' && <BlueprintGenerator drives={drives} />}

          {activeTab === 'vacuum' && <DevVacuum drives={drives} />}

          {activeTab === 'giants' && <GiantFilesHunter drives={drives} />}

          {activeTab === 'organizer' && <DownloadsSorter />}

          {activeTab === 'health' && <HealthWatchdog drives={drives} />}

          {activeTab === 'help' && <HelpGuide onNavigateTab={(tab) => setActiveTab(tab)} />}
        </main>
      </div>
    </div>
  );
};

export default App;
