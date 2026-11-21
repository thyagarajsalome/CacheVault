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
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { GiantFileItem } from '../types';
import { formatBytes } from '../utils';

export const GiantFilesHunter: React.FC = () => {
  const [giantFiles, setGiantFiles] = useState<GiantFileItem[]>([]);
  const selectedDrives = ['C:\\', 'D:\\'];
  const [minSizeMb, setMinSizeMb] = useState<number>(1000); // 1 GB
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const scanGiantFiles = async () => {
    setIsScanning(true);
    setStatusMessage(null);
    try {
      const data = await invoke<GiantFileItem[]>('scan_giant_files', {
        drives: selectedDrives,
        minSizeMb,
        limit: 30,
      });
      setGiantFiles(data);
    } catch (e: any) {
      console.error(e);
      setStatusMessage('Scanning error: ' + (e?.message || e));
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    scanGiantFiles();
  }, [minSizeMb]);

  const handleOpenFolder = async (filePath: string) => {
    try {
      await invoke('open_path_in_explorer', { path: filePath });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete:\n${filePath}?`);
    if (!confirmDelete) return;

    setDeletingPath(filePath);
    try {
      await invoke('delete_file_item', { path: filePath });
      setGiantFiles((prev) => prev.filter((f) => f.path !== filePath));
      setStatusMessage(`Deleted file: ${filePath}`);
    } catch (e: any) {
      alert(`Could not delete file: ${e}`);
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
                Multi-threaded disk inspection revealing the largest disk hogs across your drives in seconds.
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
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-900 hover:bg-dark-800 text-gray-300 text-xs rounded-xl border border-gray-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-violet-400' : ''}`} />
              Scan Now
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-dark-800/60 border border-violet-800/40 rounded-xl text-xs text-violet-300">
          {statusMessage}
        </div>
      )}

      {/* Files List */}
      {isScanning ? (
        <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
          <span>Searching file trees for massive files...</span>
        </div>
      ) : giantFiles.length === 0 ? (
        <div className="py-12 bg-dark-800/30 border border-gray-800/60 rounded-2xl text-center text-gray-400 text-xs">
          No files larger than {formatBytes(minSizeMb * 1024 * 1024)} found.
        </div>
      ) : (
        <div className="space-y-2">
          {giantFiles.map((file) => {
            const Icon = getFileIcon(file.extension);
            return (
              <div
                key={file.path}
                className="p-3.5 rounded-xl border bg-dark-800/40 border-gray-800/70 hover:border-violet-900/50 hover:bg-dark-800/70 transition-all flex items-center justify-between"
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
                    onClick={() => handleDeleteFile(file.path)}
                    disabled={deletingPath === file.path}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                    title="Permanently Delete File"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
