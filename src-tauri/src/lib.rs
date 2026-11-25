mod disk_ops;

use disk_ops::{
    clean_clutter_item, clean_dev_vacuum_items, create_workspace_blueprint, delete_file_item,
    get_downloads_undo_info, get_drives, get_known_folders, get_physical_health,
    get_system_context, migrate_and_link_folder, open_path_in_explorer, organize_downloads,
    redirect_known_folder, restore_known_folder, scan_clutter, scan_dev_vacuum,
    scan_downloads_organizer, scan_giant_files, undo_last_downloads_organize,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_drives,
            get_physical_health,
            get_system_context,
            scan_clutter,
            clean_clutter_item,
            migrate_and_link_folder,
            open_path_in_explorer,
            create_workspace_blueprint,
            get_known_folders,
            redirect_known_folder,
            restore_known_folder,
            scan_dev_vacuum,
            clean_dev_vacuum_items,
            scan_giant_files,
            delete_file_item,
            scan_downloads_organizer,
            organize_downloads,
            get_downloads_undo_info,
            undo_last_downloads_organize
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
