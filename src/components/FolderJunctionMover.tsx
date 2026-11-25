import React, { useState, useEffect } from 'react';
import {
  FolderSync,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Info,
  FolderInput,
  HardDrive,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { JunctionPreset, MigrationResult, SystemContext } from '../types';
import { formatBytes } from '../utils';

export const FolderJunctionMover: React.FC = () => {
  const [sourcePath, setSourcePath] = useState('');
  const [destPath, setDestPath] = useState('');
  const [presets, setPresets] = useState<JunctionPreset[]>([]);
  const [secondaryDrive, setSecondaryDrive] = useState('D:\\');
  const [isMigrating, setIsMigrating] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadContext = async () => {
    try {
      const ctx = await invoke<SystemContext>('get_system_context');
      setPresets(ctx.junction_presets);
      setSecondaryDrive(ctx.preferred_secondary_drive || 'D:\\');
    } catch (e) {
      console.error('Failed to resolve system presets:', e);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  const handleSelectPreset = (preset: JunctionPreset) => {
    setSourcePath(preset.source_path);
    setDestPath(preset.suggested_dest);
    setResult(null);
    setError(null);
  };

  const handleMigrate = async () => {
    if (!sourcePath || !destPath) return;
    setIsMigrating(true);
    setResult(null);
    setError(null);

    try {
      const res = await invoke<MigrationResult>('migrate_and_link_folder', {
        source: sourcePath,
        destination: destPath,
      });
      setResult(res);
      await loadContext();
    } catch (e: any) {
      setError(e?.toString() || 'Migration failed.');
    } finally {
      setIsMigrating(false);
    }
  };

  const targetTrimmed = secondaryDrive.replace(/\\+$/, '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-dark-800 border border-indigo-800/30">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
          <FolderSync className="w-3.5 h-3.5" />
          NTFS Directory Junction Engine
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Smart Folder Mover (C: → {targetTrimmed} Relocation)
        </h2>
        <p className="text-sm text-gray-300 mt-2 max-w-2xl leading-relaxed">
          Running out of space on your fast C: drive? Safely move heavy folders (developer tools, AppData, games) to your spacious secondary drive. CacheVault leaves an invisible <strong>NTFS Symbolic Junction</strong> so Windows and your apps continue working without ever knowing the files moved!
        </p>

        {/* Visual Diagram */}
        <div className="mt-5 p-4 rounded-2xl bg-dark-900/60 border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 font-bold">
              C:
            </div>
            <div>
              <div className="font-semibold text-white">Source Path</div>
              <div className="text-gray-400">Replaced with transparent Junction link</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-indigo-400">
            <span className="hidden sm:inline font-mono text-[11px]">mklink /J</span>
            <ArrowRight className="w-4 h-4 animate-pulse" />
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              {targetTrimmed}
            </div>
            <div>
              <div className="font-semibold text-white">Physical Storage ({secondaryDrive})</div>
              <div className="text-gray-400">All heavy files safely stored here</div>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Suggestions */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Detected System Presets (Auto-Resolved for Current User):
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {presets.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelectPreset(p)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                p.is_junction
                  ? 'bg-dark-800/40 border-emerald-900/40'
                  : 'bg-dark-800/70 border-gray-800 hover:border-indigo-500/40 hover:bg-dark-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">
                    {p.title}
                  </span>
                  {p.is_junction ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Linked
                    </span>
                  ) : p.exists ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {formatBytes(p.size_bytes)}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
                      Not Present
                    </span>
                  )}
                </div>
                <FolderInput className="w-4 h-4 text-gray-400 group-hover:text-indigo-400 transition-colors shrink-0" />
              </div>
              <p className="text-xs text-gray-400 mt-1 leading-normal">{p.description}</p>
              <div className="mt-3 text-[11px] font-mono text-gray-500 truncate">{p.source_path}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Path Form */}
      <div className="p-6 rounded-2xl bg-dark-800 border border-gray-800 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
            1. Source Folder on C: Drive (To be moved)
          </label>
          <input
            type="text"
            value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
            placeholder="e.g. C:\Users\Username\AppData\Local\HeavyFolder"
            className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
            2. Destination Folder on {targetTrimmed} Drive (Physical Target)
          </label>
          <input
            type="text"
            value={destPath}
            onChange={(e) => setDestPath(e.target.value)}
            placeholder={`e.g. ${targetTrimmed}\\Migrated-Folders\\HeavyFolder`}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
          />
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-900/30 border border-red-500/30 flex items-start gap-3 text-red-200 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {result && (
          <div className="p-4 rounded-xl bg-emerald-900/30 border border-emerald-500/30 flex items-start gap-3 text-emerald-200 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <div className="font-semibold">{result.message}</div>
              <div className="text-emerald-300/80 mt-0.5">
                Your C: drive space has been recovered, and the junction is fully transparent.
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            CacheVault uses multi-threaded Robocopy to ensure safe byte-for-byte transfers.
          </div>

          <button
            onClick={handleMigrate}
            disabled={isMigrating || !sourcePath || !destPath}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed self-end sm:self-auto"
          >
            {isMigrating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Migrating & Linking...
              </>
            ) : (
              <>
                <HardDrive className="w-4 h-4" />
                Move to {targetTrimmed} & Create Junction
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
