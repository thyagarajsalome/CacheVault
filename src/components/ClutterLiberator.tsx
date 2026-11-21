import React, { useState, useEffect } from 'react';
import type { ClutterCategory } from '../types';
import { formatBytes } from '../utils';
import { Sparkles, Trash2, Check, ShieldCheck, Code, AlertCircle, RefreshCw, FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const ClutterLiberator: React.FC = () => {
  const [categories, setCategories] = useState<ClutterCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [freedBytes, setFreedBytes] = useState<number | null>(null);

  const fetchClutter = async () => {
    setIsScanning(true);
    setFreedBytes(null);
    try {
      const items = await invoke<ClutterCategory[]>('scan_clutter');
      setCategories(items);
      // Auto-select all "safe" items by default
      const safeIds = new Set(items.filter(i => i.safety_level === 'safe' && i.size_bytes > 0).map(i => i.id));
      setSelectedIds(safeIds);
    } catch (e) {
      console.error('Failed to scan clutter:', e);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    fetchClutter();
  }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAllSafe = () => {
    const safeIds = new Set(categories.filter(i => i.safety_level === 'safe' && i.size_bytes > 0).map(i => i.id));
    setSelectedIds(safeIds);
  };

  const handleClean = async () => {
    if (selectedIds.size === 0) return;
    setIsCleaning(true);
    let totalFreed = 0;

    try {
      for (const cat of categories) {
        if (selectedIds.has(cat.id)) {
          const freed = await invoke<number>('clean_clutter_item', { path: cat.path });
          totalFreed += freed;
        }
      }
      setFreedBytes(totalFreed);
      // Re-scan
      await fetchClutter();
    } catch (e) {
      console.error('Cleaning failed:', e);
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

  const totalSelectedSize = categories
    .filter(c => selectedIds.has(c.id))
    .reduce((acc, c) => acc + c.size_bytes, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-dark-800 border border-blue-800/30 relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Intelligent C: Drive Cleaner
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Liberate Gigabytes of Trapped Disk Space
          </h2>
          <p className="text-sm text-gray-300 mt-2 leading-relaxed">
            Windows and developer tools quietly fill your C: drive with gigabytes of transient cache, crash dumps, and unneeded packages. CacheVault safely purges only non-essential data.
          </p>
        </div>

        {freedBytes !== null && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-900/30 border border-emerald-600/30 flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400" />
            <div className="text-sm text-emerald-200">
              Successfully purged and recovered <strong>{formatBytes(freedBytes)}</strong> of free disk space on your C: drive!
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-dark-800 p-4 rounded-2xl border border-gray-800">
        <div className="flex items-center gap-2">
          <button
            onClick={selectAllSafe}
            className="px-3 py-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-700 text-gray-200 text-xs font-medium transition-colors"
          >
            Select All 100% Safe Items
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-gray-200 text-xs font-medium transition-colors"
          >
            Clear Selection
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="text-right">
            <div className="text-xs text-gray-400">Total Selected:</div>
            <div className="text-sm font-bold text-white">{formatBytes(totalSelectedSize)}</div>
          </div>

          <button
            onClick={handleClean}
            disabled={isCleaning || selectedIds.size === 0 || totalSelectedSize === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            {isCleaning ? 'Purging Selected...' : `Clean ${formatBytes(totalSelectedSize)}`}
          </button>
        </div>
      </div>

      {/* Clutter List */}
      <div className="space-y-3">
        {isScanning ? (
          <div className="p-12 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-3 bg-dark-800/40 rounded-2xl border border-gray-800">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            Scanning C: drive for temporary caches and junk files...
          </div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm bg-dark-800/40 rounded-2xl border border-gray-800">
            No clutter found. Your C: drive is exceptionally clean!
          </div>
        ) : (
          categories.map((cat) => {
            const isSelected = selectedIds.has(cat.id);
            const isSafe = cat.safety_level === 'safe';
            const isDev = cat.safety_level === 'developer';

            return (
              <div
                key={cat.id}
                onClick={() => cat.size_bytes > 0 && toggleSelect(cat.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  isSelected
                    ? 'bg-blue-950/20 border-blue-500/40 shadow-sm shadow-blue-500/10'
                    : 'bg-dark-800/80 border-gray-800 hover:border-gray-700'
                } ${cat.size_bytes === 0 ? 'opacity-60 cursor-default' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'border-gray-600 bg-dark-900'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{cat.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                          isSafe
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isDev
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isSafe ? (
                          <>
                            <ShieldCheck className="w-3 h-3" /> 100% Safe
                          </>
                        ) : isDev ? (
                          <>
                            <Code className="w-3 h-3" /> Dev Cache
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3" /> Review
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>
                    <p className="text-[11px] text-gray-500 font-mono mt-1 break-all">{cat.path}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{formatBytes(cat.size_bytes)}</div>
                    <div className="text-xs text-gray-400">{cat.count.toLocaleString()} files</div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFolder(cat.path);
                    }}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700"
                    title="Open folder in Explorer"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
