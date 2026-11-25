use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::fs::MetadataExt;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Instant, SystemTime};
use sysinfo::Disks;
use tauri::{AppHandle, Emitter};

const CREATE_NO_WINDOW: u32 = 0x08000000;
const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;

#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetDiskFreeSpaceW(
        lp_root_path_name: *const u16,
        lp_sectors_per_cluster: *mut u32,
        lp_bytes_per_sector: *mut u32,
        lp_number_of_free_clusters: *mut u32,
        lp_total_number_of_clusters: *mut u32,
    ) -> i32;
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DriveInfo {
    pub letter: String,
    pub label: String,
    pub filesystem: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
    pub percent_used: f64,
    pub drive_type: String,
    pub bus_type: String,
    pub health_status: String,
    pub health_message: String,
    pub cluster_size: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PhysicalDiskHealth {
    pub device_id: String,
    pub friendly_name: String,
    pub media_type: String,
    pub bus_type: String,
    pub operational_status: String,
    pub health_status: String,
    pub size_bytes: u64,
    pub temperature_c: Option<i64>,
    pub wear_percent: Option<i64>,
    pub read_errors_uncorrected: Option<u64>,
    pub write_errors_uncorrected: Option<u64>,
    pub power_on_hours: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JunctionPreset {
    pub id: String,
    pub title: String,
    pub description: String,
    pub source_path: String,
    pub suggested_dest: String,
    pub exists: bool,
    pub is_junction: bool,
    pub size_bytes: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SystemContext {
    pub user_profile: String,
    pub local_app_data: String,
    pub preferred_secondary_drive: String,
    pub junction_presets: Vec<JunctionPreset>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClutterCategory {
    pub id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub size_bytes: u64,
    pub safety_level: String,
    pub count: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MigrationResult {
    pub success: bool,
    pub message: String,
    pub bytes_moved: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BlueprintResult {
    pub created_folders: Vec<String>,
    pub message: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct KnownFolderInfo {
    pub id: String,
    pub name: String,
    pub current_path: String,
    pub default_path: String,
    pub recommended_path: String,
    pub is_redirected: bool,
    pub is_protected: bool,
    pub protection_reason: Option<String>,
    pub size_bytes: u64,
    pub file_count: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DevFolderItem {
    pub path: String,
    pub project_name: String,
    pub folder_type: String,
    pub size_bytes: u64,
    pub days_inactive: u32,
    pub last_modified: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GiantFileItem {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub extension: String,
    pub last_modified: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OrganizerCategoryItem {
    pub category: String,
    pub destination_folder: String,
    pub file_count: u32,
    pub total_size_bytes: u64,
    pub sample_files: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OrganizeResult {
    pub files_moved: u32,
    pub bytes_moved: u64,
    pub message: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UndoMoveRecord {
    pub from: String,
    pub to: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DownloadsUndoInfo {
    pub available: bool,
    pub file_count: usize,
    pub downloads_path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ScanProgressPayload {
    pub module: String,
    pub current_path: String,
    pub found_count: usize,
}

// -------------------------------------------------------------
// INTERNAL HELPERS
// -------------------------------------------------------------

fn get_cluster_size_win32(root_mount: &str) -> u64 {
    let mut normalized = root_mount.to_string();
    if !normalized.ends_with('\\') {
        normalized.push('\\');
    }
    let wide: Vec<u16> = Path::new(&normalized)
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut sectors_per_cluster: u32 = 0;
    let mut bytes_per_sector: u32 = 0;
    let mut free_clusters: u32 = 0;
    let mut total_clusters: u32 = 0;

    let ok = unsafe {
        GetDiskFreeSpaceW(
            wide.as_ptr(),
            &mut sectors_per_cluster,
            &mut bytes_per_sector,
            &mut free_clusters,
            &mut total_clusters,
        )
    };

    if ok != 0 && sectors_per_cluster > 0 && bytes_per_sector > 0 {
        (sectors_per_cluster as u64) * (bytes_per_sector as u64)
    } else {
        4096
    }
}

fn is_reparse_or_symlink(path: &Path) -> bool {
    match fs::symlink_metadata(path) {
        Ok(meta) => {
            meta.file_type().is_symlink() || (meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0)
        }
        Err(_) => false,
    }
}

/// Computes directory size without crossing NTFS directory junctions or symlinks.
fn dir_size(path: &Path) -> (u64, u64) {
    let mut total_size = 0u64;
    let mut total_files = 0u64;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let item_path = entry.path();
            if let Ok(meta) = fs::symlink_metadata(&item_path) {
                let is_reparse = meta.file_type().is_symlink()
                    || (meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0);
                if is_reparse {
                    continue;
                }
                if meta.is_file() {
                    total_size += meta.len();
                    total_files += 1;
                } else if meta.is_dir() {
                    let (sub_size, sub_files) = dir_size(&item_path);
                    total_size += sub_size;
                    total_files += sub_files;
                }
            }
        }
    }

    (total_size, total_files)
}

fn detect_preferred_secondary_drive() -> String {
    let disks = Disks::new_with_refreshed_list();
    let mut best_drive: Option<(String, u64)> = None;

    for disk in &disks {
        let mount = disk.mount_point().to_string_lossy().to_string();
        let upper = mount.to_uppercase();
        if upper.starts_with("C:") {
            continue;
        }
        if !disk.is_removable() {
            let total = disk.total_space();
            if best_drive.as_ref().map(|(_, s)| total > *s).unwrap_or(true) {
                let formatted = if mount.ends_with('\\') {
                    mount
                } else {
                    format!("{}\\", mount)
                };
                best_drive = Some((formatted, total));
            }
        }
    }

    best_drive
        .map(|(d, _)| d)
        .unwrap_or_else(|| "C:\\".to_string())
}

fn cachevault_data_dir() -> PathBuf {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| r"C:\Temp".to_string());
    let dir = PathBuf::from(local_app_data).join("CacheVault");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// Sends files or directories to the Windows Recycle Bin safely using VB FileIO API.
fn send_paths_to_recycle_bin(paths: &[PathBuf]) -> Result<Vec<PathBuf>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }

    let data_dir = cachevault_data_dir();
    let batch_file = data_dir.join("recycle_batch.txt");
    let done_file = data_dir.join("recycle_done.txt");
    let _ = fs::remove_file(&done_file);

    let content: String = paths
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join("\n");

    fs::write(&batch_file, content.as_bytes())
        .map_err(|e| format!("Failed to prepare Recycle Bin batch: {}", e))?;

    let ps_script = format!(
        r#"Add-Type -AssemblyName Microsoft.VisualBasic
$batch = '{}'
$done = '{}'
$deleted = @()
Get-Content -LiteralPath $batch -Encoding UTF8 | ForEach-Object {{
    $p = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($p)) {{ return }}
    try {{
        if (Test-Path -LiteralPath $p -PathType Container) {{
            [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p, 'OnlyErrorDialogs', 'SendToRecycleBin')
            $deleted += $p
        }} elseif (Test-Path -LiteralPath $p -PathType Leaf) {{
            [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p, 'OnlyErrorDialogs', 'SendToRecycleBin')
            $deleted += $p
        }}
    }} catch {{}}
}}
$deleted | Set-Content -LiteralPath $done -Encoding UTF8"#,
        batch_file.to_string_lossy().replace('\'', "''"),
        done_file.to_string_lossy().replace('\'', "''")
    );

    let out = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to invoke Windows Recycle Bin: {}", e))?;

    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("Recycle Bin operation failed: {}", err));
    }

    let mut recycled = Vec::new();
    if let Ok(text) = fs::read_to_string(&done_file) {
        for line in text.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                recycled.push(PathBuf::from(trimmed));
            }
        }
    }

    let _ = fs::remove_file(&batch_file);
    let _ = fs::remove_file(&done_file);
    Ok(recycled)
}

// -------------------------------------------------------------
// CORE DISK & SYSTEM CONTEXT OPERATIONS
// -------------------------------------------------------------

#[tauri::command]
pub async fn get_drives() -> Result<Vec<DriveInfo>, String> {
    let drives = tauri::async_runtime::spawn_blocking(|| {
        let disks = Disks::new_with_refreshed_list();
        let mut results = Vec::new();

        for disk in &disks {
            let mount = disk.mount_point().to_string_lossy().to_string();
            let letter = mount.trim_end_matches('\\').to_string();
            let total = disk.total_space();
            let free = disk.available_space();
            let used = if total > free { total - free } else { 0 };
            let pct = if total > 0 {
                ((used as f64 / total as f64) * 100.0 * 10.0).round() / 10.0
            } else {
                0.0
            };

            let cluster_size = get_cluster_size_win32(&mount);
            let fs_name = disk.file_system().to_string_lossy().to_string();
            let is_removable = disk.is_removable();
            let bus = if is_removable
                || (!letter.starts_with("C:") && !letter.starts_with("D:") && fs_name.eq_ignore_ascii_case("exfat"))
            {
                "External / Removable"
            } else {
                "Internal Fixed Drive"
            };

            let mut health_status = "Healthy".to_string();
            let mut msg = "Operating normally.".to_string();
            if cluster_size >= 1_048_576 {
                health_status = "Warning".to_string();
                msg = format!(
                    "Large cluster size ({} KB) detected on {}. Thousands of small files will waste slack space.",
                    cluster_size / 1024,
                    fs_name
                );
            } else if pct > 85.0 {
                msg = "Storage Alert: Drive is over 85% full. Use C: Liberator or Folder Mover to recover space.".to_string();
            } else if fs_name.to_lowercase() == "exfat" {
                msg = "exFAT format detected. Great for cross-OS portability, though NTFS offers journaling resilience on Windows.".to_string();
            }

            let label = disk.name().to_string_lossy().to_string();
            let display_label = if label.is_empty() {
                "Local Disk".to_string()
            } else {
                label
            };

            results.push(DriveInfo {
                letter,
                label: display_label,
                filesystem: if fs_name.is_empty() { "NTFS".to_string() } else { fs_name },
                total_bytes: total,
                free_bytes: free,
                used_bytes: used,
                percent_used: pct,
                drive_type: if is_removable { "Removable Storage" } else { "Fixed Disk" }.into(),
                bus_type: bus.into(),
                health_status,
                health_message: msg,
                cluster_size,
            });
        }

        results.sort_by(|a, b| a.letter.cmp(&b.letter));
        results
    })
    .await
    .map_err(|e| format!("Failed to query drives: {}", e))?;

    Ok(drives)
}

#[tauri::command]
pub async fn get_physical_health() -> Result<Vec<PhysicalDiskHealth>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let ps_cmd = r#"Get-PhysicalDisk | ForEach-Object {
            $rel = $_ | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
            [PSCustomObject]@{
                device_id = [string]$_.DeviceId
                friendly_name = [string]$_.FriendlyName
                media_type = [string]$_.MediaType
                bus_type = [string]$_.BusType
                operational_status = [string]$_.OperationalStatus
                health_status = [string]$_.HealthStatus
                size_bytes = [uint64]$_.Size
                temperature_c = if ($rel -and $null -ne $rel.Temperature) { [int64]$rel.Temperature } else { $null }
                wear_percent = if ($rel -and $null -ne $rel.Wear) { [int64]$rel.Wear } else { $null }
                read_errors_uncorrected = if ($rel -and $null -ne $rel.ReadErrorsUncorrected) { [uint64]$rel.ReadErrorsUncorrected } else { $null }
                write_errors_uncorrected = if ($rel -and $null -ne $rel.WriteErrorsUncorrected) { [uint64]$rel.WriteErrorsUncorrected } else { $null }
                power_on_hours = if ($rel -and $null -ne $rel.PowerOnHours) { [uint64]$rel.PowerOnHours } else { $null }
            }
        } | ConvertTo-Json -Compress"#;

        let out = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", ps_cmd])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Failed to query physical drive telemetry: {}", e))?;

        if !out.status.success() {
            return Err("Unable to read Windows Storage Reliability counters.".into());
        }

        let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if raw.is_empty() {
            return Ok(Vec::new());
        }

        if raw.starts_with('[') {
            serde_json::from_str::<Vec<PhysicalDiskHealth>>(&raw)
                .map_err(|e| format!("Failed to parse physical health JSON: {}", e))
        } else {
            let single = serde_json::from_str::<PhysicalDiskHealth>(&raw)
                .map_err(|e| format!("Failed to parse single physical health JSON: {}", e))?;
            Ok(vec![single])
        }
    })
    .await
    .map_err(|e| format!("Physical health query error: {}", e))?
}

#[tauri::command]
pub async fn get_system_context() -> Result<SystemContext, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let preferred_secondary = detect_preferred_secondary_drive();
        let sec_trim = preferred_secondary.trim_end_matches('\\');

        let candidates = vec![
            (
                "android",
                "Android SDK & Emulators",
                "Large Android Studio platform tools, system images, and emulator AVDs.",
                PathBuf::from(&local_app_data).join("Android"),
                format!(r"{}\Migrated-Folders\Android", sec_trim),
            ),
            (
                "gradle",
                "Gradle Build Caches",
                "Downloaded Java/Kotlin build artifacts and wrapper distributions.",
                PathBuf::from(&user_profile).join(".gradle"),
                format!(r"{}\Migrated-Folders\gradle", sec_trim),
            ),
            (
                "npm",
                "Node.js Global Cache",
                "Downloaded npm tarballs and package metadata.",
                PathBuf::from(&local_app_data).join("npm-cache"),
                format!(r"{}\Migrated-Folders\npm-cache", sec_trim),
            ),
            (
                "cargo",
                "Rust Cargo Registry & Git Cache",
                "Downloaded Rust crates and compiled registry cache.",
                PathBuf::from(&user_profile).join(".cargo").join("registry"),
                format!(r"{}\Migrated-Folders\cargo-registry", sec_trim),
            ),
        ];

        let mut presets = Vec::new();
        for (id, title, desc, src, dest) in candidates {
            let exists = src.exists();
            let is_junction = exists && is_reparse_or_symlink(&src);
            let sz = if exists && !is_junction {
                dir_size(&src).0
            } else {
                0
            };

            presets.push(JunctionPreset {
                id: id.into(),
                title: title.into(),
                description: desc.into(),
                source_path: src.to_string_lossy().to_string(),
                suggested_dest: dest,
                exists,
                is_junction,
                size_bytes: sz,
            });
        }

        Ok(SystemContext {
            user_profile,
            local_app_data,
            preferred_secondary_drive: preferred_secondary,
            junction_presets: presets,
        })
    })
    .await
    .map_err(|e| format!("Failed to resolve system context: {}", e))?
}

#[tauri::command]
pub async fn scan_clutter() -> Result<Vec<ClutterCategory>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut categories = Vec::new();
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let user_profile = std::env::var("USERPROFILE").unwrap_or_default();

        if !local_app_data.is_empty() {
            let temp_path = PathBuf::from(&local_app_data).join("Temp");
            if temp_path.exists() {
                let (sz, count) = dir_size(&temp_path);
                categories.push(ClutterCategory {
                    id: "user_temp".into(),
                    name: "User Temporary Files".into(),
                    description: "App cache and temporary session files in %LOCALAPPDATA%\\Temp".into(),
                    path: temp_path.to_string_lossy().to_string(),
                    size_bytes: sz,
                    safety_level: "safe".into(),
                    count,
                });
            }
        }

        let win_temp = PathBuf::from(r"C:\Windows\Temp");
        if win_temp.exists() {
            let (sz, count) = dir_size(&win_temp);
            categories.push(ClutterCategory {
                id: "win_temp".into(),
                name: "Windows System Temp".into(),
                description: "Operating system installer and update temp files".into(),
                path: win_temp.to_string_lossy().to_string(),
                size_bytes: sz,
                safety_level: "safe".into(),
                count,
            });
        }

        if !local_app_data.is_empty() {
            let crash_dumps = PathBuf::from(&local_app_data).join("CrashDumps");
            if crash_dumps.exists() {
                let (sz, count) = dir_size(&crash_dumps);
                categories.push(ClutterCategory {
                    id: "crash_dumps".into(),
                    name: "Crash Dumps & Error Logs".into(),
                    description: "Leftover memory dumps from crashed apps".into(),
                    path: crash_dumps.to_string_lossy().to_string(),
                    size_bytes: sz,
                    safety_level: "safe".into(),
                    count,
                });
            }
        }

        if !local_app_data.is_empty() {
            let d3d_cache = PathBuf::from(&local_app_data).join("D3DSCache");
            if d3d_cache.exists() {
                let (sz, count) = dir_size(&d3d_cache);
                categories.push(ClutterCategory {
                    id: "shader_cache".into(),
                    name: "DirectX Shader Cache".into(),
                    description: "Pre-compiled GPU shaders. Windows regenerates them automatically as needed.".into(),
                    path: d3d_cache.to_string_lossy().to_string(),
                    size_bytes: sz,
                    safety_level: "safe".into(),
                    count,
                });
            }
        }

        if !local_app_data.is_empty() {
            let npm_cache = PathBuf::from(&local_app_data).join("npm-cache");
            if npm_cache.exists() && !is_reparse_or_symlink(&npm_cache) {
                let (sz, count) = dir_size(&npm_cache);
                categories.push(ClutterCategory {
                    id: "npm_cache".into(),
                    name: "NPM Package Cache".into(),
                    description: "Downloaded Node.js tarballs. Can be safely purged without affecting projects.".into(),
                    path: npm_cache.to_string_lossy().to_string(),
                    size_bytes: sz,
                    safety_level: "developer".into(),
                    count,
                });
            }
        }

        if !local_app_data.is_empty() {
            let pip_cache = PathBuf::from(&local_app_data).join("pip").join("cache");
            if pip_cache.exists() {
                let (sz, count) = dir_size(&pip_cache);
                categories.push(ClutterCategory {
                    id: "pip_cache".into(),
                    name: "Python Pip Cache".into(),
                    description: "Wheel files and cached Python packages.".into(),
                    path: pip_cache.to_string_lossy().to_string(),
                    size_bytes: sz,
                    safety_level: "developer".into(),
                    count,
                });
            }
        }

        if !user_profile.is_empty() {
            let gradle_cache = PathBuf::from(&user_profile).join(".gradle").join("caches");
            if gradle_cache.exists() && !is_reparse_or_symlink(&gradle_cache) {
                let (sz, count) = dir_size(&gradle_cache);
                categories.push(ClutterCategory {
                    id: "gradle_cache".into(),
                    name: "Android / Gradle Caches".into(),
                    description: "Gradle build dependency cache. Often tens of gigabytes.".into(),
                    path: gradle_cache.to_string_lossy().to_string(),
                    size_bytes: sz,
                    safety_level: "developer".into(),
                    count,
                });
            }
        }

        Ok(categories)
    })
    .await
    .map_err(|e| format!("Failed to scan clutter: {}", e))?
}

#[tauri::command]
pub async fn clean_clutter_item(path: String) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if !p.exists() {
            return Ok(0);
        }

        let mut bytes_freed = 0u64;

        if let Ok(entries) = fs::read_dir(p) {
            for entry in entries.flatten() {
                let item_path = entry.path();
                if let Ok(meta) = fs::symlink_metadata(&item_path) {
                    if meta.file_type().is_symlink() || (meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0) {
                        continue;
                    }
                    let sz = if meta.is_file() {
                        meta.len()
                    } else {
                        dir_size(&item_path).0
                    };

                    let removed = if meta.is_file() {
                        fs::remove_file(&item_path).is_ok()
                    } else if meta.is_dir() {
                        fs::remove_dir_all(&item_path).is_ok()
                    } else {
                        false
                    };

                    if removed {
                        bytes_freed += sz;
                    }
                }
            }
        }

        Ok(bytes_freed)
    })
    .await
    .map_err(|e| format!("Failed to clean item: {}", e))?
}

#[tauri::command]
pub async fn migrate_and_link_folder(source: String, destination: String) -> Result<MigrationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let src = Path::new(&source);
        let dest = Path::new(&destination);

        if !src.exists() {
            return Err("Source folder does not exist.".into());
        }

        if is_reparse_or_symlink(src) {
            return Err("Source folder is already linked via an NTFS Junction or symlink.".into());
        }

        if dest.exists() {
            return Err("Destination folder already exists. Please choose a new location.".into());
        }

        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to prepare parent directory: {}", e))?;
        }

        let (size, count) = dir_size(src);

        let robocopy_status = Command::new("robocopy")
            .args([&source, &destination, "/E", "/MOVE"])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| format!("Robocopy execution failed: {}", e))?;

        let code = robocopy_status.code().unwrap_or(8);
        if code >= 8 {
            return Err(format!("Failed to move files (Robocopy error code {}).", code));
        }

        if src.exists() {
            let _ = fs::remove_dir_all(src);
        }

        let mklink_cmd = format!("mklink /J \"{}\" \"{}\"", source, destination);
        let mklink_output = Command::new("cmd")
            .args(["/C", &mklink_cmd])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Failed to create junction link: {}", e))?;

        if !mklink_output.status.success() {
            let err = String::from_utf8_lossy(&mklink_output.stderr);
            return Err(format!("Moved files successfully, but junction creation failed: {}", err));
        }

        Ok(MigrationResult {
            success: true,
            message: format!(
                "Successfully migrated {} files ({:.2} GB) and created NTFS junction link.",
                count,
                size as f64 / 1_073_741_824.0
            ),
            bytes_moved: size,
        })
    })
    .await
    .map_err(|e| format!("Failed to migrate folder: {}", e))?
}

#[tauri::command]
pub async fn open_path_in_explorer(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if p.is_file() {
            let select_arg = format!("/select,{}", path);
            let _ = Command::new("explorer")
                .arg(&select_arg)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        } else {
            let _ = Command::new("explorer")
                .arg(&path)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
    })
    .await
    .map_err(|e| format!("Failed to open explorer: {}", e))?;
    Ok(())
}

// -------------------------------------------------------------
// MODULE 1: DRIVE BLUEPRINT GENERATOR
// -------------------------------------------------------------

#[tauri::command]
pub async fn create_workspace_blueprint(base_path: String, folders: Vec<String>) -> Result<BlueprintResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let base = PathBuf::from(&base_path);
        if !base.exists() {
            return Err(format!("Target base path '{}' does not exist.", base_path));
        }

        let mut created = Vec::new();
        for rel in folders {
            let target = base.join(&rel);
            if let Err(e) = fs::create_dir_all(&target) {
                return Err(format!("Failed to create folder '{}': {}", target.display(), e));
            }
            created.push(target.to_string_lossy().to_string());
        }

        Ok(BlueprintResult {
            message: format!("Successfully created {} structured workspace folders in {}", created.len(), base_path),
            created_folders: created,
        })
    })
    .await
    .map_err(|e| format!("Failed to generate blueprint: {}", e))?
}

// -------------------------------------------------------------
// MODULE 2: WINDOWS KNOWN FOLDER REDIRECTOR
// -------------------------------------------------------------

fn query_shell_folder_path(reg_val: &str, default_str: &str, user_profile: &str) -> String {
    let output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
            "/v",
            reg_val,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if line.contains("REG_EXPAND_SZ") || line.contains("REG_SZ") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 3 {
                        let val = parts[2..].join(" ");
                        return val.replace("%USERPROFILE%", user_profile);
                    }
                }
            }
        }
    }
    default_str.to_string()
}

#[tauri::command]
pub async fn get_known_folders() -> Result<Vec<KnownFolderInfo>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
        if user_profile.is_empty() {
            return Err("USERPROFILE environment variable not found.".into());
        }

        let preferred_secondary = detect_preferred_secondary_drive();
        let sec_trim = preferred_secondary.trim_end_matches('\\');

        let folders_def = [
            ("downloads", "Downloads", r"{374DE290-123F-4565-9164-39C4925E467B}", "Downloads"),
            ("documents", "Documents", "Personal", "Documents"),
            ("desktop", "Desktop", "Desktop", "Desktop"),
            ("pictures", "Pictures", "My Pictures", "Pictures"),
            ("videos", "Videos", "My Video", "Videos"),
        ];

        let mut results = Vec::new();

        for (id, name, reg_val, folder_name) in folders_def {
            let default_path = PathBuf::from(&user_profile).join(folder_name);
            let default_str = default_path.to_string_lossy().to_string();
            let current_path = query_shell_folder_path(reg_val, &default_str, &user_profile);

            let junction_target = if default_path.exists() {
                fs::read_link(&default_path)
                    .ok()
                    .map(|p| p.to_string_lossy().to_string())
            } else {
                None
            };

            let is_junction_off_c = junction_target
                .as_ref()
                .map(|t| !t.to_lowercase().starts_with("c:"))
                .unwrap_or(false);

            let effective_path = if is_junction_off_c {
                junction_target.unwrap_or(current_path.clone())
            } else {
                current_path.clone()
            };

            let path_ref = Path::new(&effective_path);
            let (sz, count) = if path_ref.exists() {
                dir_size(path_ref)
            } else {
                (0, 0)
            };

            let is_redirected = !effective_path.to_lowercase().starts_with("c:");
            let recommended_path = if sec_trim.eq_ignore_ascii_case("C:") {
                default_str.clone()
            } else {
                format!(r"{}\{}", sec_trim, folder_name)
            };

            let is_onedrive = effective_path.to_lowercase().contains("onedrive");
            let (is_protected, protection_reason) = if id == "desktop" {
                (
                    true,
                    Some("Locked for system safety so desktop icons and shortcuts never disappear.".into()),
                )
            } else if is_onedrive {
                (
                    true,
                    Some("Actively managed by Microsoft OneDrive cloud sync.".into()),
                )
            } else if sec_trim.eq_ignore_ascii_case("C:") {
                (
                    true,
                    Some("No secondary fixed drive detected to redirect storage onto.".into()),
                )
            } else {
                (false, None)
            };

            results.push(KnownFolderInfo {
                id: id.to_string(),
                name: name.to_string(),
                current_path: effective_path,
                default_path: default_str,
                recommended_path,
                is_redirected,
                is_protected,
                protection_reason,
                size_bytes: sz,
                file_count: count,
            });
        }

        Ok(results)
    })
    .await
    .map_err(|e| format!("Failed to query known folders: {}", e))?
}

#[tauri::command]
pub async fn redirect_known_folder(
    folder_id: String,
    target_path: String,
    move_files: bool,
) -> Result<MigrationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
        let (reg_val, default_name, is_protected) = match folder_id.as_str() {
            "downloads" => ("{374DE290-123F-4565-9164-39C4925E467B}", "Downloads", false),
            "documents" => ("Personal", "Documents", false),
            "desktop" => ("Desktop", "Desktop", true),
            "pictures" => ("My Pictures", "Pictures", false),
            "videos" => ("My Video", "Videos", false),
            _ => return Err(format!("Unknown folder ID '{}'", folder_id)),
        };

        if is_protected {
            return Err("For system safety and to prevent desktop icons from disappearing, Desktop redirection is locked.".into());
        }

        let default_src = PathBuf::from(&user_profile).join(default_name);
        let default_str = default_src.to_string_lossy().to_string();
        let live_path = query_shell_folder_path(reg_val, &default_str, &user_profile);

        if live_path.to_lowercase().contains("onedrive") {
            return Err(format!(
                "Folder '{}' is actively managed by Microsoft OneDrive cloud sync. Rerouting it would cause sync conflicts.",
                default_name
            ));
        }

        let src_path = if Path::new(&live_path).exists() {
            PathBuf::from(&live_path)
        } else {
            default_src
        };
        let dest_path = PathBuf::from(&target_path);

        if !dest_path.exists() {
            fs::create_dir_all(&dest_path)
                .map_err(|e| format!("Failed to create destination folder: {}", e))?;
        }

        let mut bytes_moved = 0u64;

        if move_files && src_path.exists() && src_path != dest_path && !is_reparse_or_symlink(&src_path) {
            let (sz, _) = dir_size(&src_path);
            let _ = Command::new("robocopy")
                .args([
                    src_path.to_str().unwrap(),
                    dest_path.to_str().unwrap(),
                    "/E",
                    "/MOVE",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
            bytes_moved = sz;
        }

        if src_path.exists() && src_path != dest_path {
            let _ = fs::remove_dir_all(&src_path);
        }

        let mut junction_created = false;
        if !src_path.exists() {
            let mklink_cmd = format!("mklink /J \"{}\" \"{}\"", src_path.display(), target_path);
            if let Ok(out) = Command::new("cmd")
                .args(["/C", &mklink_cmd])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
            {
                junction_created = out.status.success();
            }
        }

        let _ = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
                "/v",
                reg_val,
                "/t",
                "REG_EXPAND_SZ",
                "/d",
                &target_path,
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if folder_id == "downloads" {
            let _ = Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
                    "/v",
                    "{7D83EE9B-2244-4E70-B1F5-5393042AF1E4}",
                    "/t",
                    "REG_EXPAND_SZ",
                    "/d",
                    &target_path,
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }

        let _ = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders",
                "/v",
                reg_val,
                "/t",
                "REG_SZ",
                "/d",
                &target_path,
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        let junction_msg = if junction_created {
            "NTFS junction portal established."
        } else {
            "Folder redirection configured."
        };

        Ok(MigrationResult {
            success: true,
            message: format!(
                "Successfully redirected '{}' to '{}' ({}). All incoming files will now be stored safely off C:.",
                default_name, target_path, junction_msg
            ),
            bytes_moved,
        })
    })
    .await
    .map_err(|e| format!("Failed to redirect known folder: {}", e))?
}

#[tauri::command]
pub async fn restore_known_folder(folder_id: String) -> Result<MigrationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
        let (reg_val, default_name) = match folder_id.as_str() {
            "downloads" => ("{374DE290-123F-4565-9164-39C4925E467B}", "Downloads"),
            "documents" => ("Personal", "Documents"),
            "pictures" => ("My Pictures", "Pictures"),
            "videos" => ("My Video", "Videos"),
            _ => return Err(format!("Cannot restore folder ID '{}'", folder_id)),
        };

        let default_path = PathBuf::from(&user_profile).join(default_name);
        let expand_default = format!(r"%USERPROFILE%\{}", default_name);
        let default_str = default_path.to_string_lossy().to_string();

        // If default_path is a junction pointing somewhere else, remove the junction link (not target data!)
        if default_path.exists() && is_reparse_or_symlink(&default_path) {
            let rmdir_cmd = format!("rmdir \"{}\"", default_path.display());
            let _ = Command::new("cmd")
                .args(["/C", &rmdir_cmd])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        }

        if !default_path.exists() {
            fs::create_dir_all(&default_path)
                .map_err(|e| format!("Failed to recreate default folder: {}", e))?;
        }

        let _ = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
                "/v",
                reg_val,
                "/t",
                "REG_EXPAND_SZ",
                "/d",
                &expand_default,
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if folder_id == "downloads" {
            let _ = Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
                    "/v",
                    "{7D83EE9B-2244-4E70-B1F5-5393042AF1E4}",
                    "/t",
                    "REG_EXPAND_SZ",
                    "/d",
                    &expand_default,
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }

        let _ = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders",
                "/v",
                reg_val,
                "/t",
                "REG_SZ",
                "/d",
                &default_str,
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        Ok(MigrationResult {
            success: true,
            message: format!(
                "Restored Windows pointer for '{}' back to '{}'. Existing files on D: were preserved untouched.",
                default_name, default_str
            ),
            bytes_moved: 0,
        })
    })
    .await
    .map_err(|e| format!("Failed to restore known folder: {}", e))?
}

// -------------------------------------------------------------
// MODULE 3: DEVELOPER NODE_MODULES & .VENV VACUUM
// -------------------------------------------------------------

fn is_valid_dev_artifact(path: &Path, lower_name: &str) -> bool {
    let parent = match path.parent() {
        Some(p) => p,
        None => return false,
    };

    match lower_name {
        "node_modules" => true,
        ".next" => parent.join("package.json").exists(),
        "dist" => parent.join("package.json").exists() || parent.join("pyproject.toml").exists(),
        "target" => parent.join("Cargo.toml").exists() || parent.join("pom.xml").exists(),
        ".venv" | "venv" => {
            path.join("pyvenv.cfg").exists()
                || parent.join("requirements.txt").exists()
                || parent.join("pyproject.toml").exists()
        }
        "build" => {
            parent.join("build.gradle").exists()
                || parent.join("build.gradle.kts").exists()
                || parent.join("CMakeLists.txt").exists()
                || parent.join("package.json").exists()
                || parent.join("pubspec.yaml").exists()
        }
        _ => false,
    }
}

fn scan_dev_folders_recursive(
    app: &AppHandle,
    dir: &Path,
    current_depth: usize,
    max_depth: usize,
    min_days: u32,
    results: &mut Vec<DevFolderItem>,
    last_emit: &mut Instant,
) {
    if current_depth > max_depth {
        return;
    }

    if last_emit.elapsed().as_millis() > 180 {
        let _ = app.emit(
            "scan-progress",
            ScanProgressPayload {
                module: "vacuum".into(),
                current_path: dir.to_string_lossy().to_string(),
                found_count: results.len(),
            },
        );
        *last_emit = Instant::now();
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let now = SystemTime::now();

    for entry in entries.flatten() {
        let path = entry.path();
        let meta = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let is_reparse = meta.file_type().is_symlink()
            || (meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0);
        if is_reparse || !meta.is_dir() {
            continue;
        }

        let name = match path.file_name() {
            Some(n) => n.to_string_lossy().to_string(),
            None => continue,
        };

        let lower = name.to_lowercase();
        if lower.starts_with('$')
            || lower == "windows"
            || lower == "program files"
            || lower == "program files (x86)"
            || lower == "programdata"
            || lower == "appdata"
            || lower == ".git"
            || lower == "system volume information"
            || lower == "windowsapps"
        {
            continue;
        }

        if is_valid_dev_artifact(&path, &lower) {
            let parent_name = path
                .parent()
                .and_then(|p| p.file_name())
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "Unknown".to_string());

            let mut days_inactive = 0u32;
            let mut last_mod_str = "Recent".to_string();

            if let Ok(mod_time) = meta.modified() {
                if let Ok(duration) = now.duration_since(mod_time) {
                    days_inactive = (duration.as_secs() / 86400) as u32;
                    last_mod_str = if days_inactive == 0 {
                        "Today".to_string()
                    } else {
                        format!("{} days ago", days_inactive)
                    };
                }
            }

            if days_inactive >= min_days {
                let (sz, _) = dir_size(&path);
                if sz > 1_000_000 {
                    results.push(DevFolderItem {
                        path: path.to_string_lossy().to_string(),
                        project_name: parent_name,
                        folder_type: name,
                        size_bytes: sz,
                        days_inactive,
                        last_modified: last_mod_str,
                    });
                }
            }

            continue;
        }

        scan_dev_folders_recursive(app, &path, current_depth + 1, max_depth, min_days, results, last_emit);
    }
}

#[tauri::command]
pub async fn scan_dev_vacuum(
    app: AppHandle,
    search_paths: Vec<String>,
    min_days_dormant: u32,
) -> Result<Vec<DevFolderItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::new();
        let mut last_emit = Instant::now();
        for sp in search_paths {
            let p = PathBuf::from(&sp);
            if p.exists() && !is_reparse_or_symlink(&p) {
                scan_dev_folders_recursive(&app, &p, 0, 5, min_days_dormant, &mut results, &mut last_emit);
            }
        }

        results.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
        Ok(results)
    })
    .await
    .map_err(|e| format!("Dev scan failed: {}", e))?
}

#[tauri::command]
pub async fn clean_dev_vacuum_items(paths: Vec<String>, use_recycle_bin: bool) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut verified_targets: Vec<(PathBuf, u64)> = Vec::new();

        for path_str in paths {
            let p = PathBuf::from(&path_str);
            if !p.exists() || is_reparse_or_symlink(&p) {
                continue;
            }

            let fname = p
                .file_name()
                .map(|n| n.to_string_lossy().to_lowercase())
                .unwrap_or_default();

            if is_valid_dev_artifact(&p, &fname) {
                let (sz, _) = dir_size(&p);
                verified_targets.push((p, sz));
            }
        }

        let mut freed = 0u64;
        if use_recycle_bin {
            let batch: Vec<PathBuf> = verified_targets.iter().map(|(p, _)| p.clone()).collect();
            let recycled = send_paths_to_recycle_bin(&batch)?;
            for (p, sz) in verified_targets {
                if recycled.iter().any(|r| r == &p) || !p.exists() {
                    freed += sz;
                }
            }
        } else {
            for (p, sz) in verified_targets {
                if fs::remove_dir_all(&p).is_ok() {
                    freed += sz;
                }
            }
        }

        Ok(freed)
    })
    .await
    .map_err(|e| format!("Dev vacuum cleaning failed: {}", e))?
}

// -------------------------------------------------------------
// MODULE 4: GIANT FILE HUNTER
// -------------------------------------------------------------

fn scan_giant_files_recursive(
    app: &AppHandle,
    dir: &Path,
    current_depth: usize,
    max_depth: usize,
    min_bytes: u64,
    results: &mut Vec<GiantFileItem>,
    last_emit: &mut Instant,
) {
    if current_depth > max_depth {
        return;
    }

    if last_emit.elapsed().as_millis() > 180 {
        let _ = app.emit(
            "scan-progress",
            ScanProgressPayload {
                module: "giants".into(),
                current_path: dir.to_string_lossy().to_string(),
                found_count: results.len(),
            },
        );
        *last_emit = Instant::now();
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let now = SystemTime::now();

    for entry in entries.flatten() {
        let path = entry.path();
        let meta = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let is_reparse = meta.file_type().is_symlink()
            || (meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0);
        if is_reparse {
            continue;
        }

        if meta.is_file() {
            let sz = meta.len();
            if sz >= min_bytes {
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                let ext = path
                    .extension()
                    .map(|e| e.to_string_lossy().to_uppercase())
                    .unwrap_or_else(|| "FILE".into());

                let mut last_mod_str = "Unknown".to_string();
                if let Ok(mod_time) = meta.modified() {
                    if let Ok(duration) = now.duration_since(mod_time) {
                        let days = duration.as_secs() / 86400;
                        last_mod_str = if days == 0 {
                            "Today".to_string()
                        } else {
                            format!("{} days ago", days)
                        };
                    }
                }

                results.push(GiantFileItem {
                    path: path.to_string_lossy().to_string(),
                    file_name: name,
                    size_bytes: sz,
                    extension: ext,
                    last_modified: last_mod_str,
                });
            }
        } else if meta.is_dir() {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if name.starts_with('$')
                || name == "windows"
                || name == "system volume information"
                || name == "appdata"
                || name == "windowsapps"
            {
                continue;
            }
            scan_giant_files_recursive(app, &path, current_depth + 1, max_depth, min_bytes, results, last_emit);
        }
    }
}

#[tauri::command]
pub async fn scan_giant_files(
    app: AppHandle,
    drives: Vec<String>,
    min_size_mb: u64,
    limit: usize,
) -> Result<Vec<GiantFileItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::new();
        let mut last_emit = Instant::now();
        let min_bytes = min_size_mb * 1024 * 1024;

        for drive in drives {
            let root = PathBuf::from(&drive);
            if root.exists() {
                scan_giant_files_recursive(&app, &root, 0, 7, min_bytes, &mut results, &mut last_emit);
            }
        }

        results.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
        if results.len() > limit {
            results.truncate(limit);
        }

        Ok(results)
    })
    .await
    .map_err(|e| format!("Giant file scan failed: {}", e))?
}

#[tauri::command]
pub async fn delete_file_item(path: String, use_recycle_bin: bool) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(&path);
        if !p.is_file() {
            return Err("Target path is not a file.".into());
        }

        if use_recycle_bin {
            let recycled = send_paths_to_recycle_bin(&[p.clone()])?;
            if recycled.is_empty() && p.exists() {
                return Err("Windows Recycle Bin could not remove this file.".into());
            }
            Ok(true)
        } else {
            fs::remove_file(&p).map_err(|e| format!("Failed to delete file: {}", e))?;
            Ok(true)
        }
    })
    .await
    .map_err(|e| format!("File deletion error: {}", e))?
}

// -------------------------------------------------------------
// MODULE 5: SMART DOWNLOADS AUTO-ORGANIZER
// -------------------------------------------------------------

fn get_category_for_ext(ext: &str) -> (&'static str, &'static str) {
    match ext {
        "exe" | "msi" | "iso" | "dmg" | "apk" | "bin" => ("Installers", "Installers & Setup"),
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" => ("Archives", "Compressed Archives"),
        "pdf" | "docx" | "doc" | "xlsx" | "xls" | "pptx" | "ppt" | "txt" | "csv" | "epub" => {
            ("Documents", "Office & Documents")
        }
        "mp4" | "mkv" | "avi" | "mov" | "mp3" | "wav" | "flac" | "m4a" => ("Media", "Audio & Video"),
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "svg" | "psd" | "ai" => ("Pictures", "Images & Photos"),
        "py" | "js" | "ts" | "json" | "html" | "css" | "sql" | "sh" | "bat" | "rs" | "cpp" | "java" => {
            ("Code", "Source Code & Scripts")
        }
        _ => ("Miscellaneous", "Other Files"),
    }
}

#[tauri::command]
pub async fn scan_downloads_organizer(downloads_path: String) -> Result<Vec<OrganizerCategoryItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(&downloads_path);
        if !path.exists() {
            return Err(format!("Path '{}' does not exist.", downloads_path));
        }

        let entries = fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))?;
        let mut map: HashMap<String, (String, u32, u64, Vec<String>)> = HashMap::new();

        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let fname = p
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                if fname.eq_ignore_ascii_case("desktop.ini") || fname.eq_ignore_ascii_case("thumbs.db") {
                    continue;
                }
                let ext = p
                    .extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                let sz = entry.metadata().map(|m| m.len()).unwrap_or(0);

                let (dest_folder, cat_name) = get_category_for_ext(&ext);
                let entry_val = map
                    .entry(cat_name.to_string())
                    .or_insert_with(|| (dest_folder.to_string(), 0, 0, Vec::new()));

                entry_val.1 += 1;
                entry_val.2 += sz;
                if entry_val.3.len() < 3 {
                    entry_val.3.push(fname);
                }
            }
        }

        let mut results = Vec::new();
        for (cat_name, (dest_folder, count, size, samples)) in map {
            if count > 0 {
                results.push(OrganizerCategoryItem {
                    category: cat_name,
                    destination_folder: dest_folder,
                    file_count: count,
                    total_size_bytes: size,
                    sample_files: samples,
                });
            }
        }

        results.sort_by(|a, b| b.total_size_bytes.cmp(&a.total_size_bytes));
        Ok(results)
    })
    .await
    .map_err(|e| format!("Scan downloads failed: {}", e))?
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct UndoLogFile {
    downloads_path: String,
    moves: Vec<UndoMoveRecord>,
}

#[tauri::command]
pub async fn organize_downloads(
    downloads_path: String,
    selected_folders: Vec<String>,
) -> Result<OrganizeResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(&downloads_path);
        if !root.exists() {
            return Err("Downloads path does not exist.".into());
        }

        let entries = fs::read_dir(&root).map_err(|e| format!("Failed to read directory: {}", e))?;
        let mut moved_count = 0u32;
        let mut moved_bytes = 0u64;
        let mut undo_moves = Vec::new();

        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let file_name = match p.file_name() {
                    Some(n) => n,
                    None => continue,
                };
                let fname_str = file_name.to_string_lossy();
                if fname_str.eq_ignore_ascii_case("desktop.ini") || fname_str.eq_ignore_ascii_case("thumbs.db") {
                    continue;
                }

                let ext = p
                    .extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                let (dest_subfolder, _) = get_category_for_ext(&ext);

                if selected_folders.iter().any(|f| f.eq_ignore_ascii_case(dest_subfolder)) {
                    let target_dir = root.join(dest_subfolder);
                    if !target_dir.exists() {
                        let _ = fs::create_dir_all(&target_dir);
                    }

                    let mut dest_file = target_dir.join(file_name);

                    if dest_file.exists() {
                        let stem = p
                            .file_stem()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_else(|| "file".into());
                        let ts = SystemTime::now()
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .map(|d| d.as_secs())
                            .unwrap_or(0);
                        let new_name = if ext.is_empty() {
                            format!("{}_{}", stem, ts)
                        } else {
                            format!("{}_{}.{}", stem, ts, ext)
                        };
                        dest_file = target_dir.join(new_name);
                    }

                    let sz = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    if fs::rename(&p, &dest_file).is_ok() {
                        moved_count += 1;
                        moved_bytes += sz;
                        undo_moves.push(UndoMoveRecord {
                            from: p.to_string_lossy().to_string(),
                            to: dest_file.to_string_lossy().to_string(),
                        });
                    }
                }
            }
        }

        if !undo_moves.is_empty() {
            let undo_file = cachevault_data_dir().join("downloads_undo.json");
            let log = UndoLogFile {
                downloads_path,
                moves: undo_moves,
            };
            if let Ok(json) = serde_json::to_string_pretty(&log) {
                let _ = fs::write(undo_file, json);
            }
        }

        Ok(OrganizeResult {
            files_moved: moved_count,
            bytes_moved: moved_bytes,
            message: format!(
                "Successfully sorted {} files ({:.2} MB) into categorized subfolders.",
                moved_count,
                moved_bytes as f64 / 1_048_576.0
            ),
        })
    })
    .await
    .map_err(|e| format!("Organizing downloads failed: {}", e))?
}

#[tauri::command]
pub async fn get_downloads_undo_info() -> Result<DownloadsUndoInfo, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let undo_file = cachevault_data_dir().join("downloads_undo.json");
        if !undo_file.exists() {
            return Ok(DownloadsUndoInfo {
                available: false,
                file_count: 0,
                downloads_path: String::new(),
            });
        }

        if let Ok(raw) = fs::read_to_string(&undo_file) {
            if let Ok(log) = serde_json::from_str::<UndoLogFile>(&raw) {
                return Ok(DownloadsUndoInfo {
                    available: !log.moves.is_empty(),
                    file_count: log.moves.len(),
                    downloads_path: log.downloads_path,
                });
            }
        }

        Ok(DownloadsUndoInfo {
            available: false,
            file_count: 0,
            downloads_path: String::new(),
        })
    })
    .await
    .map_err(|e| format!("Failed to read undo info: {}", e))?
}

#[tauri::command]
pub async fn undo_last_downloads_organize() -> Result<OrganizeResult, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let undo_file = cachevault_data_dir().join("downloads_undo.json");
        if !undo_file.exists() {
            return Err("No recent sort history found to undo.".into());
        }

        let raw = fs::read_to_string(&undo_file)
            .map_err(|e| format!("Failed to read undo history: {}", e))?;
        let log: UndoLogFile = serde_json::from_str(&raw)
            .map_err(|e| format!("Corrupted undo history: {}", e))?;

        let mut restored_count = 0u32;
        let mut restored_bytes = 0u64;

        for rec in &log.moves {
            let current = Path::new(&rec.to);
            let original = Path::new(&rec.from);
            if current.exists() && !original.exists() {
                let sz = current.metadata().map(|m| m.len()).unwrap_or(0);
                if fs::rename(current, original).is_ok() {
                    restored_count += 1;
                    restored_bytes += sz;
                }
            }
        }

        let _ = fs::remove_file(&undo_file);

        Ok(OrganizeResult {
            files_moved: restored_count,
            bytes_moved: restored_bytes,
            message: format!("Reverted last sort and moved {} files back to their original folder.", restored_count),
        })
    })
    .await
    .map_err(|e| format!("Undo failed: {}", e))?
}
