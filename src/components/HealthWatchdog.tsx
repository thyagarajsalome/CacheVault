import React from 'react';
import type { DriveInfo } from '../types';
import { formatBytes } from '../utils';
import { ShieldAlert, AlertTriangle, CheckCircle2, Usb, HelpCircle } from 'lucide-react';

interface HealthWatchdogProps {
  drives: DriveInfo[];
}

export const HealthWatchdog: React.FC<HealthWatchdogProps> = ({ drives }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/30 via-teal-900/20 to-dark-800 border border-emerald-800/30">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
          <ShieldAlert className="w-3.5 h-3.5" />
          Hardware S.M.A.R.T. Watchdog
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Physical Drive Diagnostics & Early Warning
        </h2>
        <p className="text-sm text-gray-300 mt-2 max-w-2xl leading-relaxed">
          Hard drives and SSDs track physical degradation inside internal microcontroller logs (S.M.A.R.T.). CacheVault decodes these technical telemetry counters into plain-English advice before data loss happens.
        </p>
      </div>

      {/* Drive Health Cards */}
      <div className="space-y-4">
        {drives.map((drive) => {
          const isHealthy = drive.health_status === 'Healthy';
          const isUSB = drive.bus_type.toLowerCase().includes('usb');
          const hasClusterIssue = drive.cluster_size >= 1048576;

          return (
            <div
              key={drive.letter}
              className="p-5 rounded-2xl bg-dark-800 border border-gray-800 space-y-4"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isHealthy
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {isHealthy ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">{drive.letter}</span>
                      <span className="text-xs text-gray-400">({drive.label || 'Volume'})</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isHealthy
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {drive.health_status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                      <span>{drive.drive_type}</span>
                      <span>•</span>
                      <span>{drive.filesystem}</span>
                      <span>•</span>
                      <span>Bus: {drive.bus_type}</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-400 text-left sm:text-right">
                  <div>Cluster Size: <strong className="text-white">{formatBytes(drive.cluster_size, 0)}</strong></div>
                  <div>Capacity: <strong className="text-white">{formatBytes(drive.total_bytes)}</strong></div>
                </div>
              </div>

              {/* Status explanation */}
              <div className="p-4 rounded-xl bg-dark-900 border border-gray-800/80 text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <InfoIcon className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-gray-300">
                    <strong>Diagnostic Summary:</strong> {drive.health_message}
                  </div>
                </div>

                {hasClusterIssue && (
                  <div className="mt-2 pt-2 border-t border-gray-800 flex items-start gap-2 text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Format Overhead Notice:</strong> This drive is formatted with an unusually large <strong>1 MB allocation unit size</strong>. Storing thousands of small files (like source code, web projects, or small photos) will waste large amounts of space ("slack space"). For Windows-only usage, formatting to <strong>NTFS with 4KB or 16KB clusters</strong> is recommended.
                    </div>
                  </div>
                )}

                {isUSB && (
                  <div className="mt-2 pt-2 border-t border-gray-800 flex items-start gap-2 text-gray-400">
                    <Usb className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>USB Performance Mode:</strong> Always use the "Safely Remove Hardware" icon before disconnecting. If this drive experiences 10-15s spin-up freezes, disable USB Selective Suspend in Windows Power Options.
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* S.M.A.R.T. Glossary Reference */}
      <div className="p-6 rounded-2xl bg-dark-800 border border-gray-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-400" />
          Understanding Critical Hard Drive S.M.A.R.T. Indicators
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-dark-900 border border-gray-800">
            <div className="font-semibold text-white">05: Reallocated Sectors Count</div>
            <p className="text-gray-400 mt-1 leading-normal">
              When a sector suffers physical damage, the drive automatically remaps it to an internal spare sector. A rising number indicates surface degradation.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-dark-900 border border-gray-800">
            <div className="font-semibold text-white">C5: Current Pending Sector Count</div>
            <p className="text-gray-400 mt-1 leading-normal">
              Sectors waiting to be remapped due to read errors. When new data is written to them, the drive will test and permanently quarantine them.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-dark-900 border border-gray-800">
            <div className="font-semibold text-amber-400">C6: Uncorrectable Sector Count</div>
            <p className="text-gray-400 mt-1 leading-normal">
              Sectors that suffered unrecoverable read errors. If present, keep only secondary backup copies on this drive and never use it as your sole copy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
