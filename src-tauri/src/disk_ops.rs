use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::os::windows::process::CommandExt;
use std::time::SystemTime;
use sysinfo::Disks;

const CREATE_NO_WINDOW: u32 = 0x08000000;

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

// -------------------------------------------------------------
// CORE DISK OPERATIONS
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

            let fs_name = disk.file_system().to_string_lossy().to_string();
            let is_removable = disk.is_removable();
            let bus = if is_removable || (!letter.starts_with("C:") && !letter.starts_with("D:") && fs_name == "exFAT") {
                "External USB"
            } else {
                "Fast Internal SSD"
            };

            let mut msg = "Operating normally.".to_string();
            if pct > 85.0 {
                msg = "Storage Alert: Drive is over 85% full. Use C: Liberator to recover space.".to_string();
            } else if fs_name.to_lowercase() == "exfat" {
                msg = "exFAT format detected. Great for portability, but NTFS offers journaling resilience on Windows.".to_string();
            }

            let label = disk.name().to_string_lossy().to_string();
            let display_label = if label.is_empty() { "Local Disk".to_string() } else { label };

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
                health_status: "Healthy".into(),
                health_message: msg,
                cluster_size: 4096,
            });
        }

        results.sort_by(|a, b| a.letter.cmp(&b.letter));
        results
    })
    .await
    .map_err(|e| format!("Failed to query drives: {}", e))?;

    Ok(drives)
}

fn dir_size(path: &Path) -> (u64, u64) {
    let mut total_size = 0u64;
    let mut total_files = 0u64;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    total_size += meta.len();
                    total_files += 1;
                } else if meta.is_dir() {
                    let (sub_size, sub_files) = dir_size(&entry.path());
                    total_size += sub_size;
                    total_files += sub_files;
                }
            }
        }
    }

    (total_size, total_files)
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
            let d3d_cache = PathBuf::from(&local_app_data).join(r"D3DSCache");
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

        if !user_profile.is_empty() {
            let npm_cache = PathBuf::from(&user_profile).join("AppData").join("Local").join("npm-cache");
            if npm_cache.exists() {
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
            if gradle_cache.exists() {
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
                if let Ok(meta) = entry.metadata() {
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

        if dest.exists() {
            return Err("Destination folder already exists. Please choose a new location.".into());
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
            message: format!("Successfully migrated {} files ({:.2} GB) and created NTFS junction link.", count, size as f64 / 1_073_741_824.0),
            bytes_moved: size,
        })
    })
    .await
    .map_err(|e| format!("Failed to migrate folder: {}", e))?
}

#[tauri::command]
pub async fn open_path_in_explorer(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _ = Command::new("explorer")
            .arg(&path)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
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

#[tauri::command]
pub async fn get_known_folders() -> Result<Vec<KnownFolderInfo>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
        if user_profile.is_empty() {
            return Err("USERPROFILE environment variable not found.".into());
        }

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

            // Query registry for current redirection
            let output = Command::new("reg")
                .args([
                    "query",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
                    "/v",
                    reg_val,
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            let mut current_path = default_str.clone();
            if let Ok(out) = output {
                if out.status.success() {
                    let text = String::from_utf8_lossy(&out.stdout);
                    for line in text.lines() {
                        if line.contains("REG_EXPAND_SZ") || line.contains("REG_SZ") {
                            let parts: Vec<&str> = line.split_whitespace().collect();
                            if parts.len() >= 3 {
                                let val = parts[2..].join(" ");
                                let expanded = val.replace("%USERPROFILE%", &user_profile);
                                current_path = expanded;
                            }
                        }
                    }
                }
            }

            let path_ref = Path::new(&current_path);
            let (sz, count) = if path_ref.exists() {
                dir_size(path_ref)
            } else {
                (0, 0)
            };

            let is_junction_to_d = if default_path.exists() {
                if let Ok(target) = fs::read_link(&default_path) {
                    target.to_string_lossy().to_lowercase().starts_with("d:")
                } else {
                    false
                }
            } else {
                false
            };

            let is_redirected = !current_path.to_lowercase().starts_with("c:") || is_junction_to_d;
            let recommended_path = format!(r"D:\{}", folder_name);

            results.push(KnownFolderInfo {
                id: id.to_string(),
                name: name.to_string(),
                current_path: if is_junction_to_d { recommended_path.clone() } else { current_path },
                default_path: default_str,
                recommended_path,
                is_redirected,
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
            "desktop" => ("Desktop", "Desktop", true), // Protected: prevent blanking the user's live desktop screen
            "pictures" => ("My Pictures", "Pictures", false),
            "videos" => ("My Video", "Videos", false),
            _ => return Err(format!("Unknown folder ID '{}'", folder_id)),
        };

        if is_protected {
            return Err("For system safety and to prevent desktop icons from disappearing, Desktop redirection is locked. Only storage folders like Downloads and Documents can be safely rerouted.".into());
        }

        // Query the actual live path from the Windows registry first (handles OneDrive redirection safely)
        let mut actual_src = PathBuf::from(&user_profile).join(default_name);
        let reg_chk = Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
                "/v",
                reg_val,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if let Ok(out) = reg_chk {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    if line.contains("REG_EXPAND_SZ") || line.contains("REG_SZ") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 3 {
                            let val = parts[2..].join(" ");
                            let expanded = val.replace("%USERPROFILE%", &user_profile);
                            let p = PathBuf::from(&expanded);
                            if p.exists() {
                                actual_src = p;
                            }
                        }
                    }
                }
            }
        }

        // If the folder is inside OneDrive (e.g. OneDrive\Desktop or OneDrive\Documents), prevent breaking cloud sync
        let actual_str = actual_src.to_string_lossy().to_lowercase();
        if actual_str.contains("onedrive") && (folder_id == "desktop" || folder_id == "documents") {
            return Err(format!(
                "Folder '{}' is actively managed by Microsoft OneDrive cloud sync. Rerouting it would cause sync conflicts.",
                default_name
            ));
        }

        let src_path = actual_src;
        let dest_path = PathBuf::from(&target_path);

        if !dest_path.exists() {
            fs::create_dir_all(&dest_path)
                .map_err(|e| format!("Failed to create destination folder: {}", e))?;
        }

        let mut bytes_moved = 0u64;

        if move_files && src_path.exists() && src_path != dest_path {
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
            let mklink_out = Command::new("cmd")
                .args(["/C", &mklink_cmd])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            if let Ok(out) = mklink_out {
                junction_created = out.status.success();
            }
        }

        // Direct reg add without cmd /C quoting issues
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
                "Successfully redirected '{}' to '{}' ({}). All downloads and files will now be saved on your 1 TB D: SSD.",
                default_name, target_path, junction_msg
            ),
            bytes_moved,
        })
    })
    .await
    .map_err(|e| format!("Failed to redirect known folder: {}", e))?
}

// -------------------------------------------------------------
// MODULE 3: DEVELOPER NODE_MODULES & .VENV VACUUM
// -------------------------------------------------------------

fn scan_dev_folders_recursive(
    dir: &Path,
    current_depth: usize,
    max_depth: usize,
    min_days: u32,
    results: &mut Vec<DevFolderItem>,
) {
    if current_depth > max_depth {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let now = SystemTime::now();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = match path.file_name() {
            Some(n) => n.to_string_lossy().to_string(),
            None => continue,
        };

        // Skip system directories and hidden source repos
        let lower = name.to_lowercase();
        if lower.starts_with('$')
            || lower == "windows"
            || lower == "program files"
            || lower == "program files (x86)"
            || lower == "appdata"
            || lower == ".git"
            || lower == "system volume information"
        {
            continue;
        }

        // Check if this is a developer target
        let is_dev_target = lower == "node_modules"
            || lower == ".venv"
            || lower == "venv"
            || lower == "target"
            || lower == ".next"
            || lower == "build"
            || lower == "dist";

        if is_dev_target {
            let parent_name = path
                .parent()
                .and_then(|p| p.file_name())
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "Unknown".to_string());

            let mut days_inactive = 0u32;
            let mut last_mod_str = "Recent".to_string();

            if let Ok(meta) = entry.metadata() {
                if let Ok(mod_time) = meta.modified() {
                    if let Ok(duration) = now.duration_since(mod_time) {
                        days_inactive = (duration.as_secs() / 86400) as u32;
                        last_mod_str = format!("{} days ago", days_inactive);
                    }
                }
            }

            if days_inactive >= min_days {
                let (sz, _) = dir_size(&path);
                if sz > 1_000_000 { // Only consider > 1 MB
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

            // Do not recurse into node_modules or .venv
            continue;
        }

        scan_dev_folders_recursive(&path, current_depth + 1, max_depth, min_days, results);
    }
}

#[tauri::command]
pub async fn scan_dev_vacuum(search_paths: Vec<String>, min_days_dormant: u32) -> Result<Vec<DevFolderItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::new();
        for sp in search_paths {
            let p = PathBuf::from(&sp);
            if p.exists() {
                scan_dev_folders_recursive(&p, 0, 5, min_days_dormant, &mut results);
            }
        }

        // Sort descending by size
        results.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
        Ok(results)
    })
    .await
    .map_err(|e| format!("Dev scan failed: {}", e))?
}

#[tauri::command]
pub async fn clean_dev_vacuum_items(paths: Vec<String>) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut freed = 0u64;
        for path_str in paths {
            let p = PathBuf::from(&path_str);
            if !p.exists() {
                continue;
            }

            // Safety check: ensure the folder is indeed an expendable dev folder
            let fname = p.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
            let safe_to_delete = fname == "node_modules"
                || fname == ".venv"
                || fname == "venv"
                || fname == "target"
                || fname == ".next"
                || fname == "dist"
                || fname == "build";

            if safe_to_delete {
                let (sz, _) = dir_size(&p);
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
    dir: &Path,
    current_depth: usize,
    max_depth: usize,
    min_bytes: u64,
    results: &mut Vec<GiantFileItem>,
) {
    if current_depth > max_depth {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let now = SystemTime::now();

    for entry in entries.flatten() {
        let path = entry.path();
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if meta.is_file() {
            let sz = meta.len();
            if sz >= min_bytes {
                let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                let ext = path.extension().map(|e| e.to_string_lossy().to_uppercase()).unwrap_or_else(|| "FILE".into());
                
                let mut last_mod_str = "Unknown".to_string();
                if let Ok(mod_time) = meta.modified() {
                    if let Ok(duration) = now.duration_since(mod_time) {
                        let days = duration.as_secs() / 86400;
                        last_mod_str = format!("{} days ago", days);
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
            let name = path.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
            // Skip Windows OS system folders and recycle bin to avoid listing pagefile.sys or internal OS blobs
            if name.starts_with('$')
                || name == "windows"
                || name == "system volume information"
                || name == "appdata"
            {
                continue;
            }
            scan_giant_files_recursive(&path, current_depth + 1, max_depth, min_bytes, results);
        }
    }
}

#[tauri::command]
pub async fn scan_giant_files(drives: Vec<String>, min_size_mb: u64, limit: usize) -> Result<Vec<GiantFileItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::new();
        let min_bytes = min_size_mb * 1024 * 1024;

        for drive in drives {
            let root = PathBuf::from(&drive);
            if root.exists() {
                scan_giant_files_recursive(&root, 0, 7, min_bytes, &mut results);
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
pub async fn delete_file_item(path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if p.is_file() {
            fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))?;
            Ok(true)
        } else {
            Err("Target path is not a file.".into())
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
        "pdf" | "docx" | "doc" | "xlsx" | "xls" | "pptx" | "ppt" | "txt" | "csv" | "epub" => ("Documents", "Office & Documents"),
        "mp4" | "mkv" | "avi" | "mov" | "mp3" | "wav" | "flac" | "m4a" => ("Media", "Audio & Video"),
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "svg" | "psd" | "ai" => ("Pictures", "Images & Photos"),
        "py" | "js" | "ts" | "json" | "html" | "css" | "sql" | "sh" | "bat" | "rs" | "cpp" | "java" => ("Code", "Source Code & Scripts"),
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
        let mut map: std::collections::HashMap<String, (String, u32, u64, Vec<String>)> = std::collections::HashMap::new();

        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
                let fname = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                let sz = entry.metadata().map(|m| m.len()).unwrap_or(0);

                let (dest_folder, cat_name) = get_category_for_ext(&ext);
                let entry = map.entry(cat_name.to_string()).or_insert_with(|| {
                    (dest_folder.to_string(), 0, 0, Vec::new())
                });

                entry.1 += 1;
                entry.2 += sz;
                if entry.3.len() < 3 {
                    entry.3.push(fname);
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

#[tauri::command]
pub async fn organize_downloads(downloads_path: String, selected_folders: Vec<String>) -> Result<OrganizeResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(&downloads_path);
        if !root.exists() {
            return Err("Downloads path does not exist.".into());
        }

        let entries = fs::read_dir(&root).map_err(|e| format!("Failed to read directory: {}", e))?;
        let mut moved_count = 0u32;
        let mut moved_bytes = 0u64;

        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
                let (dest_subfolder, _) = get_category_for_ext(&ext);

                if selected_folders.iter().any(|f| f.eq_ignore_ascii_case(dest_subfolder)) {
                    let target_dir = root.join(dest_subfolder);
                    if !target_dir.exists() {
                        let _ = fs::create_dir_all(&target_dir);
                    }

                    let file_name = p.file_name().unwrap();
                    let mut dest_file = target_dir.join(file_name);

                    // If file already exists in subfolder, rename with counter
                    if dest_file.exists() {
                        let stem = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "file".into());
                        dest_file = target_dir.join(format!("{}_{}.{}", stem, SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(), ext));
                    }

                    let sz = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    if fs::rename(&p, &dest_file).is_ok() {
                        moved_count += 1;
                        moved_bytes += sz;
                    }
                }
            }
        }

        Ok(OrganizeResult {
            files_moved: moved_count,
            bytes_moved: moved_bytes,
            message: format!("Successfully sorted {} files ({:.2} MB) into categorized subfolders.", moved_count, moved_bytes as f64 / 1_048_576.0),
        })
    })
    .await
    .map_err(|e| format!("Organizing downloads failed: {}", e))?
}
