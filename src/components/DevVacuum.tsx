import React, { useState, useEffect } from 'react';
import {
  Trash2,
  RefreshCw,
  FolderOpen,
  CheckCircle,
  AlertTriangle,
  Flame,
  CheckSquare,
  Square,
  Recycle,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { DevFolderItem, DriveInfo, ScanProgressPayload, SystemContext } from '../types';
import { formatBytes } from '../utils';

interface DevVacuumProps {
  drives: DriveInfo[];
}

export const DevVacuum: React.FC<DevVacuumProps> = ({ drives }) => {
  const [items, setItems] = useState<DevFolderItem[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [minDays, setMinDays] = useState<number>(30);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [useRecycleBin, setUseRecycleBin] = useState<boolean>(true);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [liveScanPath, setLiveScanPath] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const unlistenPromise = listen<ScanProgressPayload>('scan-progress', (event) => {
      if (event.payload.module === 'vacuum') {
        setLiveScanPath(event.payload.current_path);
      }
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const scanDevFolders = async () => {
    setIsScanning(true);
    setStatusMessage(null);
    setLiveScanPath('');
    try {
      const ctx = await invoke<SystemContext>('get_system_context');
      const searchSet = new Set<string>();
      if (ctx.user_profile) {
        searchSet.add(ctx.user_profile);
      }
      for (const d of drives) {
        if (!d.letter.toUpperCase().startsWith('C')) {
          const mount = d.letter.endsWith('\\') ? d.letter : `${d.letter}\\`;
          searchSet.add(mount);
        }
      }
      const searchPaths = Array.from(searchSet);
      const data = await invoke<DevFolderItem[]>('scan_dev_vacuum', {
        searchPaths,
        minDaysDormant: minDays,
      });
      setItems(data);
      const autoSelected = new Set(data.map((item) => item.path));
      setSelectedPaths(autoSelected);
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: typeof e === 'string' ? e : e?.message || 'Scan failed.',
      });
    } finally {
      setIsScanning(false);
      setLiveScanPath('');
    }
  };

  useEffect(() => {
    if (drives.length > 0) {
      scanDevFolders();
    }
  }, [minDays, drives.length]);

  const toggleSelect = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedPaths(next);
  };

  const selectAll = () => {
    if (selectedPaths.size === items.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(items.map((i) => i.path)));
    }
  };

  const executeClean = async () => {
    if (selectedPaths.size === 0) return;
    setShowConfirmModal(false);
    setIsCleaning(true);
    setStatusMessage(null);

    try {
      const freedBytes = await invoke<number>('clean_dev_vacuum_items', {
        paths: Array.from(selectedPaths),
        useRecycleBin,
      });

      setStatusMessage({
        type: 'success',
        text: `Vacuum complete! ${useRecycleBin ? 'Moved to Recycle Bin' : 'Permanently purged'} ${formatBytes(freedBytes)} of developer dependency space.`,
      });

      await scanDevFolders();
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: typeof e === 'string' ? e : e?.message || 'Cleaning failed.',
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_path_in_explorer', { path });
    } catch (e) {
      console.error(e);
    }
  };

  const totalSelectedBytes = items
    .filter((item) => selectedPaths.has(item.path))
    .reduce((acc, curr) => acc + curr.size_bytes, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900/30 via-teal-900/20 to-cyan-900/30 border border-emerald-800/40 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Developer node_modules & .venv Vacuum</h2>
              <p className="text-sm text-gray-400">
                Manifest-verified scanner for dormant dependency folders across your projects without touching source code.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Filter Inactivity:</span>
            <select
              value={minDays}
              onChange={(e) => setMinDays(Number(e.target.value))}
              className="bg-dark-900 border border-gray-700 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              <option value={0}>All Projects</option>
              <option value={14}>Older than 14 days</option>
              <option value={30}>Older than 30 days (Recommended)</option>
              <option value={60}>Dormant &gt; 60 days</option>
            </select>

            <button
              onClick={scanDevFolders}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-900 hover:bg-dark-800 text-gray-300 text-xs rounded-xl border border-gray-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-emerald-400' : ''}`} />
              Scan
            </button>
          </div>
        </div>
      </div>

      {/* Safe Mode Toggle */}
      <div className="bg-dark-800/40 border border-gray-800 rounded-xl p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <Recycle className="w-4 h-4 text-emerald-400" />
          <span>Move cleaned folders to Windows Recycle Bin first (reversible safety net)</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={useRecycleBin}
            onChange={(e) => setUseRecycleBin(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-300'
              : 'bg-red-900/20 border-red-800/50 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Action / Selection Bar */}
      <div className="bg-dark-800/60 border border-gray-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
          >
            {selectedPaths.size === items.length && items.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-emerald-400" />
            ) : (
              <Square className="w-4 h-4 text-gray-500" />
            )}
            Select All ({items.length})
          </button>
          <span className="text-gray-600">|</span>
          <span className="text-xs text-gray-400">
            Selected: <strong className="text-emerald-400">{formatBytes(totalSelectedBytes)}</strong> across {selectedPaths.size} folders
          </span>
        </div>

        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={isCleaning || selectedPaths.size === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 self-end sm:self-auto"
        >
          <Trash2 className="w-4 h-4" />
          {isCleaning ? 'Vacuuming...' : `Vacuum ${formatBytes(totalSelectedBytes)} Now`}
        </button>
      </div>

      {/* Items list */}
      {isScanning ? (
        <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-3 bg-dark-800/30 border border-gray-800/60 rounded-2xl px-4">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
          <span>Scanning verified project trees for dormant dependency caches...</span>
          {liveScanPath && (
            <span className="text-[11px] font-mono text-gray-500 max-w-xl truncate">{liveScanPath}</span>
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 bg-dark-800/30 border border-gray-800/60 rounded-2xl text-center text-gray-400 text-xs">
          No dormant developer folders detected for the selected threshold. Your system is lean!
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isChecked = selectedPaths.has(item.path);
            const isVeryOld = item.days_inactive >= 60;
            return (
              <div
                key={item.path}
                onClick={() => toggleSelect(item.path)}
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  isChecked
                    ? 'bg-dark-800/80 border-emerald-900/60'
                    : 'bg-dark-800/30 border-gray-800/70 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.path);
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-600" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white truncate">{item.project_name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-dark-900 text-emerald-400 border border-emerald-500/20">
                        {item.folder_type}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          isVeryOld
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {item.last_modified}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-gray-500 truncate">{item.path}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs font-bold text-gray-200 font-mono">
                    {formatBytes(item.size_bytes)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFolder(item.path);
                    }}
                    className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                    title="Open in Explorer"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {useRecycleBin ? (
                  <Recycle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
                Confirm Dev Cache Cleanup
              </h3>
              <button onClick={() => setShowConfirmModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              You are about to {useRecycleBin ? 'move to the Recycle Bin' : 'permanently delete'}{' '}
              <strong className="text-white">{selectedPaths.size}</strong> dependency folders totaling{' '}
              <strong className="text-emerald-400">{formatBytes(totalSelectedBytes)}</strong>. Source code and Git history will not be touched.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={executeClean}
                className={`px-4 py-2 rounded-xl text-xs text-white font-semibold ${
                  useRecycleBin ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {useRecycleBin ? 'Move to Recycle Bin' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
