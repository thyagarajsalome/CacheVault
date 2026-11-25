import React, { useState, useEffect } from 'react';
import {
  FileText,
  RefreshCw,
  FolderOpen,
  Trash2,
  HardDrive,
  FileArchive,
  Film,
  Disc,
  FileCode,
  Binary,
  Recycle,
  AlertTriangle,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { DriveInfo, GiantFileItem, ScanProgressPayload } from '../types';
import { formatBytes } from '../utils';

interface GiantFilesHunterProps {
  drives: DriveInfo[];
}

export const GiantFilesHunter: React.FC<GiantFilesHunterProps> = ({ drives }) => {
  const [giantFiles, setGiantFiles] = useState<GiantFileItem[]>([]);
  const [selectedDrives, setSelectedDrives] = useState<string[]>([]);
  const [minSizeMb, setMinSizeMb] = useState<number>(1000);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [confirmFile, setConfirmFile] = useState<GiantFileItem | null>(null);
  const [useRecycleBin, setUseRecycleBin] = useState<boolean>(true);
  const [liveScanPath, setLiveScanPath] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const unlistenPromise = listen<ScanProgressPayload>('scan-progress', (event) => {
      if (event.payload.module === 'giants') {
        setLiveScanPath(event.payload.current_path);
      }
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (drives.length > 0 && selectedDrives.length === 0) {
      const defaults = drives
        .filter((d) => d.drive_type === 'Fixed Disk')
        .map((d) => (d.letter.endsWith('\\') ? d.letter : `${d.letter}\\`));
      setSelectedDrives(defaults.length > 0 ? defaults : ['C:\\']);
    }
  }, [drives]);

  const toggleDrive = (mount: string) => {
    setSelectedDrives((prev) =>
      prev.includes(mount) ? prev.filter((m) => m !== mount) : [...prev, mount]
    );
  };

  const scanGiantFiles = async () => {
    if (selectedDrives.length === 0) return;
    setIsScanning(true);
    setStatusMessage(null);
    setLiveScanPath('');
    try {
      const data = await invoke<GiantFileItem[]>('scan_giant_files', {
        drives: selectedDrives,
        minSizeMb,
        limit: 40,
      });
      setGiantFiles(data);
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: 'Scanning error: ' + (e?.message || e),
      });
    } finally {
      setIsScanning(false);
      setLiveScanPath('');
    }
  };

  useEffect(() => {
    if (selectedDrives.length > 0) {
      scanGiantFiles();
    }
  }, [minSizeMb, selectedDrives.join(',')]);

  const handleOpenFolder = async (filePath: string) => {
    try {
      await invoke('open_path_in_explorer', { path: filePath });
    } catch (e) {
      console.error(e);
    }
  };

  const executeDeleteFile = async () => {
    if (!confirmFile) return;
    const target = confirmFile;
    setConfirmFile(null);
    setDeletingPath(target.path);
    try {
      await invoke('delete_file_item', {
        path: target.path,
        useRecycleBin,
      });
      setGiantFiles((prev) => prev.filter((f) => f.path !== target.path));
      setStatusMessage({
        type: 'success',
        text: `${useRecycleBin ? 'Moved to Recycle Bin' : 'Permanently deleted'}: ${target.file_name} (${formatBytes(target.size_bytes)})`,
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: `Could not remove file: ${typeof e === 'string' ? e : e?.message}`,
      });
    } finally {
      setDeletingPath(null);
    }
  };

  const getFileIcon = (ext: string) => {
    const upper = ext.toUpperCase();
    if (['MP4', 'MKV', 'AVI', 'MOV'].includes(upper)) return Film;
    if (['ISO', 'IMG', 'VHD', 'VMDK'].includes(upper)) return Disc;
    if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(upper)) return FileArchive;
    if (['EXE', 'MSI', 'DLL', 'SYS'].includes(upper)) return Binary;
    if (['SQL', 'JSON', 'CSV'].includes(upper)) return FileCode;
    return FileText;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-900/30 via-purple-900/20 to-fuchsia-900/30 border border-violet-800/40 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl text-violet-400">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Giant File Hunter</h2>
              <p className="text-sm text-gray-400">
                Junction-safe disk inspection revealing the largest files consuming your mounted drives.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Min Size:</span>
            <select
              value={minSizeMb}
              onChange={(e) => setMinSizeMb(Number(e.target.value))}
              className="bg-dark-900 border border-gray-700 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-violet-500"
            >
              <option value={500}>&gt; 500 MB</option>
              <option value={1000}>&gt; 1 GB (Recommended)</option>
              <option value={2000}>&gt; 2 GB</option>
              <option value={5000}>&gt; 5 GB (Colossal)</option>
            </select>

            <button
              onClick={scanGiantFiles}
              disabled={isScanning || selectedDrives.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-900 hover:bg-dark-800 text-gray-300 text-xs rounded-xl border border-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-violet-400' : ''}`} />
              Scan Now
            </button>
          </div>
        </div>
      </div>

      {/* Drive Filter Pills + Recycle Toggle */}
      <div className="bg-dark-800/40 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 mr-1">Drives to Scan:</span>
          {drives.map((d) => {
            const mount = d.letter.endsWith('\\') ? d.letter : `${d.letter}\\`;
            const active = selectedDrives.includes(mount);
            return (
              <button
                key={d.letter}
                onClick={() => toggleDrive(mount)}
                className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                  active
                    ? 'bg-violet-600/20 border-violet-500/60 text-violet-300 font-semibold'
                    : 'bg-dark-900 border-gray-700 text-gray-400 hover:text-gray-200'
                }`}
              >
                {d.letter} ({d.label})
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={useRecycleBin}
            onChange={(e) => setUseRecycleBin(e.target.checked)}
            className="rounded border-gray-600 bg-dark-900 text-violet-600"
          />
          <Recycle className="w-3.5 h-3.5 text-emerald-400" />
          <span>Safe Recycle Bin</span>
        </label>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-300'
              : 'bg-red-900/20 border-red-800/50 text-red-300'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Files List */}
      {isScanning ? (
        <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-3 bg-dark-800/30 border border-gray-800/60 rounded-2xl px-4">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
          <span>Searching file trees for massive files...</span>
          {liveScanPath && (
            <span className="text-[11px] font-mono text-gray-500 max-w-xl truncate">{liveScanPath}</span>
          )}
        </div>
      ) : giantFiles.length === 0 ? (
        <div className="py-12 bg-dark-800/30 border border-gray-800/60 rounded-2xl text-center text-gray-400 text-xs">
          No files larger than {formatBytes(minSizeMb * 1024 * 1024)} found on the selected drives.
        </div>
      ) : (
        <div className="space-y-2">
          {giantFiles.map((file) => {
            const Icon = getFileIcon(file.extension);
            return (
              <div
                key={file.path}
                className="p-3.5 rounded-xl border bg-dark-800/40 border-gray-800/70 hover:border-violet-900/50 hover:bg-dark-800/70 transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-dark-900 border border-gray-800 flex items-center justify-center text-violet-400 flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white truncate">{file.file_name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-dark-900 text-violet-400 border border-violet-500/20">
                        {file.extension}
                      </span>
                      <span className="text-[10px] text-gray-500">{file.last_modified}</span>
                    </div>
                    <div className="text-[11px] font-mono text-gray-500 truncate">{file.path}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-bold text-violet-300 font-mono">
                    {formatBytes(file.size_bytes)}
                  </span>
                  <button
                    onClick={() => handleOpenFolder(file.path)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Locate in File Explorer"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmFile(file)}
                    disabled={deletingPath === file.path}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                    title={useRecycleBin ? 'Move to Recycle Bin' : 'Delete Permanently'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {useRecycleBin ? (
                  <Recycle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
                {useRecycleBin ? 'Move Giant File to Recycle Bin?' : 'Permanently Delete File?'}
              </h3>
              <button onClick={() => setConfirmFile(null)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white">{confirmFile.file_name}</div>
              <div className="text-[11px] font-mono text-gray-400 bg-dark-900 p-2.5 rounded-xl border border-gray-800 break-all">
                {confirmFile.path}
              </div>
              <div className="text-xs text-violet-300 font-mono">
                Size: {formatBytes(confirmFile.size_bytes)}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmFile(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteFile}
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
