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
