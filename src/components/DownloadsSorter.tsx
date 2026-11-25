import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  RefreshCw,
  FolderOpen,
  CheckCircle,
  FileStack,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { OrganizerCategoryItem, OrganizeResult, KnownFolderInfo, DownloadsUndoInfo } from '../types';
import { formatBytes } from '../utils';

export const DownloadsSorter: React.FC = () => {
  const [categories, setCategories] = useState<OrganizerCategoryItem[]>([]);
  const [selectedSubfolders, setSelectedSubfolders] = useState<Set<string>>(new Set());
  const [downloadsPath, setDownloadsPath] = useState<string>('');
  const [undoInfo, setUndoInfo] = useState<DownloadsUndoInfo | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isOrganizing, setIsOrganizing] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const checkUndoState = async () => {
    try {
      const info = await invoke<DownloadsUndoInfo>('get_downloads_undo_info');
      setUndoInfo(info);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const initPath = async () => {
      try {
        const known = await invoke<KnownFolderInfo[]>('get_known_folders');
        const dl = known.find((k) => k.id === 'downloads');
        if (dl) {
          setDownloadsPath(dl.current_path);
        }
      } catch (e) {
        console.error(e);
      }
      await checkUndoState();
    };
    initPath();
  }, []);

  const scanDownloads = async () => {
    if (!downloadsPath) return;
    setIsScanning(true);

    try {
      const data = await invoke<OrganizerCategoryItem[]>('scan_downloads_organizer', {
        downloadsPath,
      });
      setCategories(data);
      setSelectedSubfolders(new Set(data.map((c) => c.destination_folder)));
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (downloadsPath) {
      scanDownloads();
    }
  }, [downloadsPath]);

  const toggleCategory = (destFolder: string) => {
    const next = new Set(selectedSubfolders);
    if (next.has(destFolder)) {
      next.delete(destFolder);
    } else {
      next.add(destFolder);
    }
    setSelectedSubfolders(next);
  };

  const handleOrganize = async () => {
    if (selectedSubfolders.size === 0 || !downloadsPath) return;
    setIsOrganizing(true);
    setResultMessage(null);

    try {
      const res = await invoke<OrganizeResult>('organize_downloads', {
        downloadsPath,
        selectedFolders: Array.from(selectedSubfolders),
      });

      setResultMessage(res.message);
      await scanDownloads();
      await checkUndoState();
    } catch (e: any) {
      setResultMessage('Error: ' + (e?.message || e));
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleUndo = async () => {
    setIsOrganizing(true);
    setResultMessage(null);
    try {
      const res = await invoke<OrganizeResult>('undo_last_downloads_organize');
      setResultMessage(res.message);
      await scanDownloads();
      await checkUndoState();
    } catch (e: any) {
      setResultMessage('Error: ' + (e?.message || e));
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_path_in_explorer', { path });
    } catch (e) {
      console.error(e);
    }
  };

  const totalFiles = categories
    .filter((c) => selectedSubfolders.has(c.destination_folder))
    .reduce((acc, curr) => acc + curr.file_count, 0);

  const totalSize = categories
    .filter((c) => selectedSubfolders.has(c.destination_folder))
    .reduce((acc, curr) => acc + curr.total_size_bytes, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-900/30 via-orange-900/20 to-yellow-900/30 border border-amber-800/40 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Smart Downloads Auto-Organizer</h2>
              <p className="text-sm text-gray-400">
                Turn your cluttered Downloads folder into a structured library by automatically sorting files into dedicated categories.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {undoInfo?.available && (
              <button
                onClick={handleUndo}
                disabled={isOrganizing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-amber-300 text-xs rounded-xl border border-amber-500/30 transition-colors"
                title={`Revert last sort of ${undoInfo.file_count} files`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo Last Sort ({undoInfo.file_count})
              </button>
            )}
            <button
              onClick={scanDownloads}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-900 hover:bg-dark-800 text-gray-300 text-xs rounded-xl border border-gray-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-400' : ''}`} />
              Scan Downloads
            </button>
          </div>
        </div>
      </div>

      {/* Path bar */}
      <div className="bg-dark-800/50 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">Target Folder:</span>
          <span className="font-mono text-amber-400">{downloadsPath || 'Detecting...'}</span>
        </div>
        {downloadsPath && (
          <button
            onClick={() => handleOpenFolder(downloadsPath)}
            className="flex items-center gap-1.5 px-3 py-1 bg-dark-900 hover:bg-dark-800 text-gray-300 text-xs rounded-lg border border-gray-700 transition-colors self-start sm:self-auto"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            Open Downloads Folder
          </button>
        )}
      </div>

      {resultMessage && (
        <div className="p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{resultMessage}</span>
        </div>
      )}

      {/* Action bar */}
      <div className="bg-dark-800/60 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>
            Ready to sort: <strong className="text-amber-400">{totalFiles} files</strong> ({formatBytes(totalSize)})
          </span>
        </div>

        <button
          onClick={handleOrganize}
          disabled={isOrganizing || totalFiles === 0}
          className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {isOrganizing ? 'Sorting Files...' : 'Sort & Organize Downloads Now'}
        </button>
      </div>

      {/* Categories Grid */}
      {isScanning ? (
        <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
          <span>Analyzing Downloads items...</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="py-12 bg-dark-800/30 border border-gray-800/60 rounded-2xl text-center text-gray-400 text-xs">
          Your Downloads folder has no unorganized files in the root! Everything is tidy.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const isSelected = selectedSubfolders.has(cat.destination_folder);
            return (
              <div
                key={cat.destination_folder}
                onClick={() => toggleCategory(cat.destination_folder)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-dark-800/80 border-amber-800/60 shadow-lg shadow-amber-900/10'
                    : 'bg-dark-800/30 border-gray-800/60 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileStack className="w-4 h-4 text-amber-400" />
                    {cat.category}
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {formatBytes(cat.total_size_bytes)}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono mb-3">
                  <span>Destination:</span>
                  <ArrowRight className="w-3 h-3 text-gray-600" />
                  <span className="text-amber-400/90 font-semibold">{cat.destination_folder}\</span>
                </div>

                <div className="text-[10px] text-gray-500 space-y-0.5 truncate">
                  {cat.sample_files.map((s, idx) => (
                    <div key={idx} className="truncate">
                      • {s}
                    </div>
                  ))}
                  {cat.file_count > cat.sample_files.length && (
                    <div className="text-gray-600">
                      + {cat.file_count - cat.sample_files.length} more files...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
