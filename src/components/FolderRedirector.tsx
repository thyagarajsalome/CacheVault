import React, { useState, useEffect } from 'react';
import {
  FolderSync,
  HardDrive,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { KnownFolderInfo, MigrationResult } from '../types';
import { formatBytes } from '../utils';

export const FolderRedirector: React.FC = () => {
  const [folders, setFolders] = useState<KnownFolderInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [moveFiles, setMoveFiles] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFolders = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<KnownFolderInfo[]>('get_known_folders');
      setFolders(data);
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: typeof e === 'string' ? e : e?.message || 'Failed to fetch Windows known folders.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const handleRedirect = async (folder: KnownFolderInfo) => {
    setProcessingId(folder.id);
    setStatusMessage(null);

    try {
      const res = await invoke<MigrationResult>('redirect_known_folder', {
        folderId: folder.id,
        targetPath: folder.recommended_path,
        moveFiles,
      });

      setStatusMessage({
        type: 'success',
        text: res.message,
      });
      await fetchFolders();
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: typeof e === 'string' ? e : e?.message || 'Failed to redirect folder.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRestore = async (folder: KnownFolderInfo) => {
    setProcessingId(folder.id);
    setStatusMessage(null);

    try {
      const res = await invoke<MigrationResult>('restore_known_folder', {
        folderId: folder.id,
      });

      setStatusMessage({
        type: 'success',
        text: res.message,
      });
      await fetchFolders();
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: typeof e === 'string' ? e : e?.message || 'Failed to restore default path.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_path_in_explorer', { path });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-900/30 via-blue-900/20 to-indigo-900/30 border border-cyan-800/40 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <FolderSync className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Windows Known Folder Redirector</h2>
              <p className="text-sm text-gray-400">
                Safely reroute heavy incoming folders (like Downloads) from C: to your secondary high-capacity drive.
              </p>
            </div>
          </div>
          <button
            onClick={fetchFolders}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-900 hover:bg-dark-800 text-gray-300 text-xs rounded-xl border border-gray-700 transition-colors self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Global Setting Toggle */}
      <div className="bg-dark-800/40 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Move existing files during redirection (recommended so no downloads or files are misplaced)</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={moveFiles}
            onChange={(e) => setMoveFiles(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
        </label>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-300'
              : 'bg-red-900/20 border-red-800/50 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Folders List */}
      <div className="space-y-3">
        {folders.map((folder) => {
          const isProcessing = processingId === folder.id;
          return (
            <div
              key={folder.id}
              className={`p-5 rounded-2xl border transition-all ${
                folder.is_protected
                  ? 'bg-dark-800/30 border-gray-800/70'
                  : folder.is_redirected
                  ? 'bg-dark-800/40 border-emerald-900/40 hover:border-emerald-700/50'
                  : 'bg-dark-800/70 border-cyan-900/50 hover:border-cyan-700/60 shadow-lg shadow-cyan-900/10'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-semibold text-white text-base">{folder.name}</span>
                    {folder.is_protected ? (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-700/40 text-slate-300 border border-slate-600/50 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-cyan-400" /> Protected
                      </span>
                    ) : folder.is_redirected ? (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Redirected Off C:
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Stored on C: System SSD
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">
                      {formatBytes(folder.size_bytes)} ({folder.file_count.toLocaleString()} files)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <span className="text-gray-500">Current:</span>
                    <span className={folder.is_redirected ? 'text-emerald-400' : 'text-amber-300'}>
                      {folder.current_path}
                    </span>
                    <button
                      onClick={() => handleOpenFolder(folder.current_path)}
                      className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                      title="Open in Explorer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {folder.is_protected && folder.protection_reason ? (
                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{folder.protection_reason}</span>
                    </div>
                  ) : (
                    !folder.is_redirected && (
                      <div className="flex items-center gap-2 text-xs text-cyan-300 font-mono">
                        <span className="text-gray-500">Target:</span>
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-500" />
                        <span>{folder.recommended_path}</span>
                      </div>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {folder.is_protected ? (
                    <button
                      onClick={() => handleOpenFolder(folder.current_path)}
                      className="px-3.5 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-xl border border-gray-700 transition-colors flex items-center gap-1.5"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                      Open Folder
                    </button>
                  ) : !folder.is_redirected ? (
                    <button
                      onClick={() => handleRedirect(folder)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-cyan-600/20 transition-all disabled:opacity-50"
                    >
                      <HardDrive className="w-4 h-4" />
                      {isProcessing ? 'Redirecting...' : `Redirect to ${folder.recommended_path.slice(0, 2)}`}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleOpenFolder(folder.current_path)}
                        className="px-3.5 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-xl border border-gray-700 transition-colors flex items-center gap-1.5"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                        Explore
                      </button>
                      <button
                        onClick={() => handleRestore(folder)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-dark-900 hover:bg-gray-800 text-gray-400 hover:text-white text-xs font-medium rounded-xl border border-gray-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        title="Restore Windows default folder pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore Default
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
