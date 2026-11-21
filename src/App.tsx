import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
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

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans selection:bg-cyan-600 selection:text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={fetchDrives}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7">
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

        {activeTab === 'blueprints' && <BlueprintGenerator />}

        {activeTab === 'vacuum' && <DevVacuum />}

        {activeTab === 'giants' && <GiantFilesHunter />}

        {activeTab === 'organizer' && <DownloadsSorter />}

        {activeTab === 'health' && <HealthWatchdog drives={drives} />}

        {activeTab === 'help' && <HelpGuide onNavigateTab={(tab) => setActiveTab(tab)} />}
      </main>

      <footer className="border-t border-gray-800/80 py-3.5 text-center text-xs text-gray-500 bg-dark-900/60 backdrop-blur-sm flex items-center justify-center gap-4">
        <span>
          CacheVault Pro • Windows Storage Suite • Active Module:{' '}
          <span className="text-cyan-400 font-semibold">{activeTab.toUpperCase()}</span>
        </span>
        <button
          onClick={() => setActiveTab('help')}
          className="text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
        >
          Need Help? Open Guide
        </button>
      </footer>
    </div>
  );
};

export default App;
