import React, { useState } from 'react';
import {
  FolderPlus,
  CheckCircle,
  FolderOpen,
  Code,
  Palette,
  Archive,
  Gamepad2,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { BlueprintResult } from '../types';

interface Preset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  folders: string[];
}

const PRESETS: Preset[] = [
  {
    id: 'developer',
    name: 'Full-Stack Developer Workspace',
    description: 'Clean hierarchy for web, backend, mobile, sandboxes & docker data',
    icon: Code,
    folders: [
      'Developer\\Projects',
      'Developer\\Sandboxes',
      'Developer\\Repositories',
      'Developer\\Libraries',
      'Developer\\Tools',
      'Developer\\DockerData',
    ],
  },
  {
    id: 'creative',
    name: 'Creative Studio & Media Production',
    description: 'Designed for video editing, audio samples, footage and graphic design',
    icon: Palette,
    folders: [
      'Creative\\Active_Projects',
      'Creative\\Assets\\Audio_SFX',
      'Creative\\Assets\\Footage',
      'Creative\\Assets\\Fonts',
      'Creative\\Exports_Rendered',
      'Creative\\Thumbnails',
    ],
  },
  {
    id: 'storage',
    name: 'Organized Storage & Vault',
    description: 'Structured folders for documents, installers, archives and backups',
    icon: Archive,
    folders: [
      'Storage\\Documents',
      'Storage\\Software_Installers',
      'Storage\\Archives_Backups',
      'Storage\\VirtualMachines',
      'Storage\\Temporary_Staging',
    ],
  },
  {
    id: 'gaming',
    name: 'Gaming & High-Performance Libraries',
    description: 'Dedicated isolation for games, emulators, mods and recording footage',
    icon: Gamepad2,
    folders: [
      'Games\\SteamLibrary',
      'Games\\EpicGames',
      'Games\\Emulators',
      'Games\\Mods_Addons',
      'Games\\Captures_Clips',
    ],
  },
];

export const BlueprintGenerator: React.FC = () => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('developer');
  const [baseDrive, setBaseDrive] = useState<string>('D:\\');
  const [folders, setFolders] = useState<string[]>(PRESETS[0].folders);
  const [newFolderInput, setNewFolderInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [result, setResult] = useState<BlueprintResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPreset = (preset: Preset) => {
    setSelectedPresetId(preset.id);
    setFolders([...preset.folders]);
    setResult(null);
    setError(null);
  };

  const handleRemoveFolder = (index: number) => {
    setFolders(folders.filter((_, i) => i !== index));
  };

  const handleAddFolder = () => {
    if (newFolderInput.trim()) {
      setFolders([...folders, newFolderInput.trim()]);
      setNewFolderInput('');
    }
  };

  const handleGenerate = async () => {
    if (folders.length === 0) {
      setError('Please specify at least one folder to create.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await invoke<BlueprintResult>('create_workspace_blueprint', {
        basePath: baseDrive,
        folders,
      });
      setResult(res);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e?.message || 'Failed to generate blueprint.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenExplorer = async (path: string) => {
    try {
      await invoke('open_path_in_explorer', { path });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-800/40 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Drive Blueprint Generator</h2>
            <p className="text-sm text-gray-400">
              Instantly scaffold professional, clean folder architectures on your secondary high-capacity drives.
            </p>
          </div>
        </div>
      </div>

      {/* Preset Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isSelected = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className={`text-left p-4 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-blue-600/15 border-blue-500/80 shadow-lg shadow-blue-500/10'
                  : 'bg-dark-800/40 border-gray-800 hover:border-gray-700 hover:bg-dark-800/80'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`p-2 rounded-lg ${
                    isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {isSelected && <CheckCircle className="w-5 h-5 text-blue-400" />}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{preset.name}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{preset.description}</p>
            </button>
          );
        })}
      </div>

      {/* Configuration & Folder List */}
      <div className="bg-dark-800/50 border border-gray-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
          <div>
            <h3 className="text-base font-semibold text-white">Target Base Drive & Folder</h3>
            <p className="text-xs text-gray-400">Choose which drive will host this structured hierarchy</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Target Drive:</span>
            <select
              value={baseDrive}
              onChange={(e) => setBaseDrive(e.target.value)}
              className="bg-dark-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="D:\">D:\ (NVMe High-Speed SSD)</option>
              <option value="E:\">E:\ (Large Volume Storage)</option>
              <option value="C:\">C:\ (System Drive)</option>
            </select>
          </div>
        </div>

        {/* Add Folder Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newFolderInput}
            onChange={(e) => setNewFolderInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
            placeholder="Add custom folder (e.g. Developer\MobileApps)..."
            className="flex-1 bg-dark-900 border border-gray-800 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAddFolder}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {/* Folder items */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Folders to create ({folders.length}):
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {folders.map((folder, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-dark-900/60 border border-gray-800/80 px-3.5 py-2 rounded-xl text-xs"
              >
                <div className="flex items-center gap-2 text-gray-300 font-mono">
                  <span className="text-blue-400 font-bold">{baseDrive}</span>
                  {folder}
                </div>
                <button
                  onClick={() => handleRemoveFolder(idx)}
                  className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                  title="Remove folder"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Success message */}
        {result && (
          <div className="p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <CheckCircle className="w-4 h-4" />
                {result.message}
              </div>
              <button
                onClick={() => handleOpenExplorer(baseDrive)}
                className="flex items-center gap-1 px-3 py-1 bg-emerald-800/40 hover:bg-emerald-800/70 text-emerald-200 text-xs rounded-lg transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Open Drive in Explorer
              </button>
            </div>
            <div className="text-[11px] text-gray-400 max-h-32 overflow-y-auto space-y-1 font-mono">
              {result.created_folders.map((f, i) => (
                <div key={i} className="text-emerald-300/80">✓ {f}</div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || folders.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {isGenerating ? 'Generating Architecture...' : 'Scaffold Workspace Blueprint Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
