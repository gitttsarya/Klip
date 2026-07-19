use std::collections::HashMap;
use std::process::Child;
use std::sync::{Arc, Mutex};

use tauri::Manager;

mod downloader;
pub use downloader::*;

pub struct DownloadState {
    pub processes: Arc<Mutex<HashMap<String, Child>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(DownloadState {
            processes: Arc::new(Mutex::new(HashMap::new())),
        })
        .invoke_handler(tauri::generate_handler![
            downloader::start_download,
            downloader::cancel_download,
            downloader::fetch_metadata,
            downloader::fetch_stream_url,
            downloader::open_folder,
            downloader::get_default_download_dir,
            downloader::fetch_playlist_metadata,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
