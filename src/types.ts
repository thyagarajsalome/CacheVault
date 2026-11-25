export interface DriveInfo {
  letter: string;
  label: string;
  filesystem: string;
  total_bytes: number;
  free_bytes: number;
  used_bytes: number;
  percent_used: number;
  drive_type: string;
  bus_type: string;
  health_status: string;
  health_message: string;
  cluster_size: number;
}

export interface PhysicalDiskHealth {
  device_id: string;
  friendly_name: string;
  media_type: string;
  bus_type: string;
  operational_status: string;
  health_status: string;
  size_bytes: number;
  temperature_c: number | null;
  wear_percent: number | null;
  read_errors_uncorrected: number | null;
  write_errors_uncorrected: number | null;
  power_on_hours: number | null;
}

export interface JunctionPreset {
  id: string;
  title: string;
  description: string;
  source_path: string;
  suggested_dest: string;
  exists: boolean;
  is_junction: boolean;
  size_bytes: number;
}

export interface SystemContext {
  user_profile: string;
  local_app_data: string;
  preferred_secondary_drive: string;
  junction_presets: JunctionPreset[];
}

export interface ClutterCategory {
  id: string;
  name: string;
  description: string;
  path: string;
  size_bytes: number;
  safety_level: 'safe' | 'developer' | 'caution';
  count: number;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  bytes_moved: number;
}

export interface BlueprintResult {
  created_folders: string[];
  message: string;
}

export interface KnownFolderInfo {
  id: string;
  name: string;
  current_path: string;
  default_path: string;
  recommended_path: string;
  is_redirected: boolean;
  is_protected: boolean;
  protection_reason: string | null;
  size_bytes: number;
  file_count: number;
}

export interface DevFolderItem {
  path: string;
  project_name: string;
  folder_type: string;
  size_bytes: number;
  days_inactive: number;
  last_modified: string;
}

export interface GiantFileItem {
  path: string;
  file_name: string;
  size_bytes: number;
  extension: string;
  last_modified: string;
}

export interface OrganizerCategoryItem {
  category: string;
  destination_folder: string;
  file_count: number;
  total_size_bytes: number;
  sample_files: string[];
}

export interface OrganizeResult {
  files_moved: number;
  bytes_moved: number;
  message: string;
}

export interface DownloadsUndoInfo {
  available: boolean;
  file_count: number;
  downloads_path: string;
}

export interface ScanProgressPayload {
  module: string;
  current_path: string;
  found_count: number;
}
