import React from 'react';
import type { DriveInfo } from '../types';
import { formatBytes } from '../utils';
import { HardDrive, AlertTriangle, CheckCircle2, Usb, ExternalLink, Zap, RefreshCw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface DriveOverviewProps {
  drives: DriveInfo[];
  isLoading: boolean;
  onOpenLiberator: () => void;
  onOpenJunctions: () => void;
}

export const DriveOverview: React.FC<DriveOverviewProps> = ({
  drives,
  isLoading,
  onOpenLiberator,
  onOpenJunctions,
}) => {
  const handleOpenExplorer = async (letter: string) => {
    try {
      await invoke('open_path_in_explorer', { path: letter });
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading && drives.length === 0) {
    return (
      <div className="space-y-6">
        <div className="p-12 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-3 bg-dark-800/80 rounded-2xl border border-gray-800">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
          <div className="text-base font-semibold text-white">Scanning Mounted Storage Volumes...</div>
          <p className="text-xs text-gray-400">Querying Windows disk status and storage telemetry.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Status Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-900/20 to-dark-800 border border-blue-800/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Storage Health</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {drives.filter(d => d.health_status === 'Healthy').length} / {drives.length}
          </div>
          <p className="text-xs text-gray-400 mt-1">Drives reporting optimal hardware condition.</p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/20 to-dark-800 border border-indigo-800/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Total Capacity</span>
            <HardDrive className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {formatBytes(drives.reduce((acc, d) => acc + d.total_bytes, 0))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Combined storage across all mounted volumes.</p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900/20 to-dark-800 border border-emerald-800/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Free Space Available</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white text-emerald-400">
            {formatBytes(drives.reduce((acc, d) => acc + d.free_bytes, 0))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Available room for new games, backups & projects.</p>
        </div>
      </div>

      {/* Drives Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-400" />
          Mounted Storage Volumes
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {drives.map((drive) => {
            const isHighUsage = drive.percent_used > 85;
            const isWarning = drive.health_status !== 'Healthy' || drive.cluster_size >= 1048576;
            const isUSB = drive.bus_type.toLowerCase().includes('usb') || drive.drive_type.toLowerCase().includes('removable');

            return (
              <div
                key={drive.letter}
                className="p-5 rounded-2xl bg-dark-800/90 border border-gray-800 hover:border-gray-700 transition-all shadow-xl relative overflow-hidden group"
              >
                {/* Accent glow line */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isHighUsage
                      ? 'bg-red-500'
                      : isWarning
                      ? 'bg-amber-500'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  }`}
                />

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-dark-700/80 border border-gray-700 flex items-center justify-center text-gray-300 group-hover:text-blue-400 transition-colors">
                      {isUSB ? <Usb className="w-6 h-6" /> : <HardDrive className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white tracking-tight">{drive.letter}</span>
                        <span className="text-sm font-medium text-gray-400">({drive.label || 'Volume'})</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-700 text-gray-300 border border-gray-600">
                          {drive.filesystem}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>{drive.drive_type}</span>
                        <span>•</span>
                        <span>{drive.bus_type}</span>
                        <span>•</span>
                        <span>Cluster: {formatBytes(drive.cluster_size, 0)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenExplorer(drive.letter)}
                    className="p-2 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700 text-xs flex items-center gap-1"
                    title="Open in Windows File Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mt-5 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">
                      Used: <strong className="text-white">{formatBytes(drive.used_bytes)}</strong> ({drive.percent_used}%)
                    </span>
                    <span className="text-gray-400">
                      Free: <strong className="text-emerald-400">{formatBytes(drive.free_bytes)}</strong>
                    </span>
                  </div>

                  <div className="w-full h-3 rounded-full bg-dark-900 border border-gray-700/60 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHighUsage
                          ? 'bg-gradient-to-r from-red-600 to-rose-500'
                          : drive.percent_used > 70
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                          : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400'
                      }`}
                      style={{ width: `${Math.min(drive.percent_used, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Intelligent Insights / Alerts */}
                {drive.health_message && (
                  <div className="mt-4 p-2.5 rounded-xl bg-dark-900/70 border border-gray-800 text-xs flex items-start gap-2 text-gray-300">
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isWarning ? 'text-amber-400' : 'text-blue-400'}`} />
                    <div className="flex-1">
                      <span>{drive.health_message}</span>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-end gap-2">
                  {drive.letter.toUpperCase().startsWith('C') ? (
                    <button
                      onClick={onOpenLiberator}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-medium transition-colors"
                    >
                      Clean Junk with Liberator →
                    </button>
                  ) : (
                    <button
                      onClick={onOpenJunctions}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 text-xs font-medium transition-colors"
                    >
                      Target for C: Relocation
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
