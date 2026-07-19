use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::DownloadState;

// ─── Quality format mapping ───────────────────────────────────────────────────

fn quality_to_format(quality: &str) -> &'static str {
    match quality {
        "Best" => "bestvideo+bestaudio/best",
        "4K" => "bestvideo[height<=2160]+bestaudio/best[height<=2160]",
        "1080p" => "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        "720p" => "bestvideo[height<=720]+bestaudio/best[height<=720]",
        "480p" => "bestvideo[height<=480]+bestaudio/best[height<=480]",
        "Audio" => "bestaudio/best",
        _ => "bestvideo+bestaudio/best",
    }
}

fn is_audio_quality(quality: &str) -> bool {
    quality == "Audio"
}

// ─── Event payloads ───────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct ProgressEvent {
    pub id: String,
    pub percent: f64,
    pub speed: String,
    pub eta: String,
    pub phase: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct CompleteEvent {
    pub id: String,
    pub file_path: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct ErrorEvent {
    pub id: String,
    pub message: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct VideoFormat {
    pub id: String,
    pub label: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct MetadataEvent {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub duration: String,
    pub duration_raw: f64,
    pub platform: String,
    pub formats: Vec<VideoFormat>,
}

#[derive(Serialize, Clone, Debug)]
pub struct CancelledEvent {
    pub id: String,
}

// ─── Human-readable error mapping ────────────────────────────────────────────

fn classify_error(stderr: &str) -> String {
    let s = stderr.to_lowercase();
    if s.contains("private video") || s.contains("private") {
        "This video is private.".to_string()
    } else if s.contains("video unavailable") || s.contains("unavailable") {
        "Video is unavailable or has been removed.".to_string()
    } else if s.contains("geo") || s.contains("not available in your country") {
        "Video is not available in your region.".to_string()
    } else if s.contains("no space") || s.contains("disk full") {
        "Not enough disk space.".to_string()
    } else if s.contains("database is locked") || s.contains("could not copy chrome cookie database") || s.contains("permission denied") || s.contains("dpapi") || s.contains("failed to decrypt") {
        "Couldn't access browser cookies (this is a known Chrome/Windows limitation). Try closing Chrome first, switching to Firefox in the dropdown, or turning off cookie extraction — most videos don't need it.".to_string()
    } else if s.contains("network") || s.contains("timeout") || s.contains("connection") {
        "Network error — check your internet connection.".to_string()
    } else if s.contains("unsupported url") || s.contains("no suitable") {
        "This URL is not supported.".to_string()
    } else if s.contains("requested format") || s.contains("format not available") {
        "This quality is not available — try a lower resolution.".to_string()
    } else if s.contains("sign in") || s.contains("login") || s.contains("age") {
        "This video requires sign-in or age verification.".to_string()
    } else if s.contains("copyright") || s.contains("blocked") {
        "Blocked due to copyright restrictions.".to_string()
    } else {
        "Download failed. Check the URL and try again.".to_string()
    }
}

/// Classify why yt-dlp returned empty stdout during a metadata fetch (-j).
/// Called when stdout is zero bytes — the real error lives in stderr.
fn classify_metadata_error(stderr: &str) -> String {
    let s = stderr.to_lowercase();
    if s.contains("sign in") || s.contains("login required") || s.contains("age") {
        "Preview unavailable — this video requires sign-in or age verification. Enable cookies in Settings.".to_string()
    } else if s.contains("private") {
        "Preview unavailable — this video is private.".to_string()
    } else if s.contains("video unavailable") || s.contains("unavailable") {
        "Preview unavailable — video has been removed or is unavailable.".to_string()
    } else if s.contains("geo") || s.contains("not available in your country") {
        "Preview unavailable — video is blocked in your region.".to_string()
    } else if s.contains("bot") || s.contains("rate") || s.contains("429") || s.contains("too many") {
        "Preview unavailable — YouTube rate-limited this request. Try again in a moment.".to_string()
    } else if s.contains("timeout") || s.contains("timed out") {
        "Preview unavailable — request timed out. Check your internet connection.".to_string()
    } else if s.contains("network") || s.contains("connection") {
        "Preview unavailable — network error. Check your internet connection.".to_string()
    } else if s.contains("copyright") || s.contains("blocked") {
        "Preview unavailable — blocked due to copyright restrictions.".to_string()
    } else if s.is_empty() {
        "Preview unavailable — yt-dlp returned no output (process may have been killed or timed out).".to_string()
    } else if s.contains("database is locked") || s.contains("could not copy chrome cookie database") || s.contains("permission denied") || s.contains("dpapi") || s.contains("failed to decrypt") {
        "Couldn't access browser cookies (this is a known Chrome/Windows limitation). Try closing Chrome first, switching to Firefox in the dropdown, or turning off cookie extraction — most videos don't need it.".to_string()
    } else {
        let first_line = stderr.trim().lines().next().unwrap_or("Unknown error");
        format!("Preview unavailable — could not read video info: {}", first_line)
    }
}

// ─── Sidecar path helper ──────────────────────────────────────────────────────

fn sidecar_path(app: &AppHandle, name: &str) -> Result<std::path::PathBuf, String> {
    let target_triple = if cfg!(target_os = "windows") {
        "x86_64-pc-windows-msvc"
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "aarch64-apple-darwin"
        } else {
            "x86_64-apple-darwin"
        }
    } else {
        "x86_64-unknown-linux-gnu"
    };

    let exe_name = if cfg!(windows) {
        format!("{}-{}.exe", name, target_triple)
    } else {
        format!("{}-{}", name, target_triple)
    };

    let bare_name = if cfg!(windows) {
        format!("{}.exe", name)
    } else {
        name.to_string()
    };

    // Try resource dir (production bundle)
    if let Ok(res_dir) = app.path().resource_dir() {
        let p = res_dir.join(&exe_name);
        if p.exists() {
            return Ok(p);
        }
        let p_bare = res_dir.join(&bare_name);
        if p_bare.exists() {
            return Ok(p_bare);
        }
    }

    // Try next to current exe
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p = parent.join(&exe_name);
            if p.exists() {
                return Ok(p);
            }
            let p_bare = parent.join(&bare_name);
            if p_bare.exists() {
                return Ok(p_bare);
            }
            // Try binaries/ subdir (dev convenience)
            let p2 = parent.join("binaries").join(&exe_name);
            if p2.exists() {
                return Ok(p2);
            }
            let p2_bare = parent.join("binaries").join(&bare_name);
            if p2_bare.exists() {
                return Ok(p2_bare);
            }
            // Walk up to find src-tauri/binaries (dev mode)
            let mut cur = parent.to_path_buf();
            for _ in 0..6 {
                let candidate = cur.join("src-tauri").join("binaries").join(&exe_name);
                if candidate.exists() {
                    return Ok(candidate);
                }
                if !cur.pop() {
                    break;
                }
            }
        }
    }

    Err(format!(
        "'{name}' not found. Please place '{exe_name}' in src-tauri/binaries/"
    ))
}

fn spawn_cmd(cmd: &mut Command) -> std::io::Result<Child> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.spawn()
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fetch_metadata(app: AppHandle, id: String, url: String) -> Result<(), String> {
    let ytdlp = sidecar_path(&app, "yt-dlp")?;
    let app_clone = app.clone();
    let id_clone = id.clone();
    let url_clone = url.clone();

    tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&ytdlp);
        let mut args = vec![
            "-j".to_string(),
            "--no-playlist".to_string(),
            "--socket-timeout".to_string(),
            "15".to_string(),
        ];
        
        args.push(url_clone);
        
        // Capture stderr so we can log the real reason yt-dlp failed
        // (bot-checks, rate-limits, auth errors all go to stderr, not stdout)
        cmd.args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        match spawn_cmd(&mut cmd).and_then(|c| c.wait_with_output()) {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let stdout_trimmed = stdout.trim();

                // Always log stderr when non-empty — this is the real failure reason
                if !stderr.trim().is_empty() {
                    eprintln!("[Klip] yt-dlp metadata stderr for {}:\n{}", id_clone, stderr.trim());
                }

                if stdout_trimmed.is_empty() {
                    // yt-dlp returned nothing on stdout — classify via stderr
                    let reason = classify_metadata_error(&stderr);
                    eprintln!(
                        "[Klip] yt-dlp returned empty stdout for metadata fetch. \
                         Exit code: {:?}. stderr snippet: {}",
                        out.status.code(),
                        stderr.trim().lines().next().unwrap_or("(no stderr)")
                    );
                    let _ = app_clone.emit(
                        "download-error",
                        ErrorEvent { id: id_clone, message: reason },
                    );
                    return;
                }

                match serde_json::from_str::<serde_json::Value>(stdout_trimmed) {
                    Ok(json) => {
                        let title = json["title"].as_str().unwrap_or("Unknown Title").to_string();
                        let thumbnail = json["thumbnail"].as_str().unwrap_or("").to_string();
                        let duration_raw = json["duration"].as_f64().unwrap_or(0.0);
                        let duration_string = json["duration_string"].as_str().unwrap_or("").to_string();
                        let duration = if duration_string.is_empty() && duration_raw > 0.0 {
                            let m = (duration_raw / 60.0).floor() as i64;
                            let s = (duration_raw % 60.0).floor() as i64;
                            format!("{:02}:{:02}", m, s)
                        } else {
                            duration_string
                        };
                        let platform = json["webpage_url_domain"].as_str().unwrap_or("").to_string();
                        
                        let mut formats_list = Vec::new();
                        
                        if let Some(formats) = json["formats"].as_array() {
                            let mut has_audio = false;
                            
                            // We will collect available heights for video
                            let mut heights = std::collections::HashSet::new();
                            
                            for fmt in formats {
                                let vcodec = fmt["vcodec"].as_str().unwrap_or("none");
                                let acodec = fmt["acodec"].as_str().unwrap_or("none");
                                
                                if vcodec != "none" {
                                    if let Some(h) = fmt["height"].as_i64() {
                                        heights.insert(h);
                                    }
                                } else if acodec != "none" {
                                    has_audio = true;
                                }
                            }
                            
                            // Add Best by default
                            formats_list.push(VideoFormat { id: "Best".to_string(), label: "Best".to_string() });
                            
                            let mut sorted_heights: Vec<i64> = heights.into_iter().collect();
                            sorted_heights.sort_by(|a, b| b.cmp(a));
                            
                            for h in sorted_heights {
                                if h >= 2160 {
                                    if !formats_list.iter().any(|f| f.id == "4K") {
                                        formats_list.push(VideoFormat { id: "4K".to_string(), label: "4K".to_string() });
                                    }
                                } else if h >= 1080 {
                                    if !formats_list.iter().any(|f| f.id == "1080p") {
                                        formats_list.push(VideoFormat { id: "1080p".to_string(), label: "1080p".to_string() });
                                    }
                                } else if h >= 720 {
                                    if !formats_list.iter().any(|f| f.id == "720p") {
                                        formats_list.push(VideoFormat { id: "720p".to_string(), label: "720p".to_string() });
                                    }
                                } else if h >= 480 {
                                    if !formats_list.iter().any(|f| f.id == "480p") {
                                        formats_list.push(VideoFormat { id: "480p".to_string(), label: "480p".to_string() });
                                    }
                                }
                            }
                            
                            if has_audio {
                                formats_list.push(VideoFormat { id: "Audio".to_string(), label: "Audio".to_string() });
                            }
                        }
                        
                        if formats_list.is_empty() {
                            // Fallback
                            for q in ["Best", "4K", "1080p", "720p", "480p", "Audio"] {
                                formats_list.push(VideoFormat { id: q.to_string(), label: q.to_string() });
                            }
                        }
                        
                        let _ = app_clone.emit(
                            "download-metadata",
                            MetadataEvent { id: id_clone, title, thumbnail, duration, duration_raw, platform, formats: formats_list },
                        );
                    }
                    Err(e) => {
                        // JSON parse failed — log raw output for debugging
                        eprintln!(
                            "[Klip] yt-dlp metadata JSON parse failed: {}\n\
                             stdout ({} bytes): {}\n\
                             stderr: {}",
                            e,
                            stdout_trimmed.len(),
                            &stdout_trimmed[..stdout_trimmed.len().min(200)],
                            stderr.trim().lines().next().unwrap_or("(no stderr)")
                        );
                        let _ = app_clone.emit(
                            "download-error",
                            ErrorEvent {
                                id: id_clone,
                                message: "Preview unavailable — could not read video info.".to_string(),
                            },
                        );
                    }
                }
            }
            Err(e) => {
                eprintln!("[Klip] Failed to spawn yt-dlp for metadata: {}", e);
                let _ = app_clone.emit(
                    "download-error",
                    ErrorEvent {
                        id: id_clone,
                        message: format!("Could not fetch metadata: {}", e),
                    },
                );
            }
        }

    });

    Ok(())
}

#[tauri::command]
pub async fn fetch_stream_url(app: AppHandle, id: String, url: String) -> Result<(), String> {
    let ytdlp = sidecar_path(&app, "yt-dlp")?;
    let app_clone = app.clone();
    let id_clone = id.clone();
    let url_clone = url.clone();

    tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&ytdlp);
        let mut args = vec![
            "--ignore-config".to_string(),
            "-g".to_string(),
            "-f".to_string(),
            "best[ext=mp4]/best".to_string(),
            "--no-playlist".to_string(),
            "--socket-timeout".to_string(),
            "15".to_string(),
        ];
        
        args.push(url_clone);
        
        // Capture stderr to diagnose stream URL failures
        cmd.args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        match spawn_cmd(&mut cmd).and_then(|c| c.wait_with_output()) {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let stream_url = stdout.lines().next().unwrap_or("").trim().to_string();
                if !stderr.trim().is_empty() {
                    eprintln!("[Klip] yt-dlp stream stderr: {}", stderr.trim());
                }
                if !stream_url.is_empty() {
                    #[derive(Serialize, Clone)]
                    struct StreamEvent { id: String, url: String }
                    let _ = app_clone.emit("stream-url", StreamEvent { id: id_clone, url: stream_url });
                } else {
                    eprintln!("[Klip] yt-dlp -g returned empty stdout (exit {:?})", out.status.code());
                    #[derive(Serialize, Clone)]
                    struct StreamErrEvent { id: String, message: String }
                    let _ = app_clone.emit("stream-error", StreamErrEvent { id: id_clone, message: "No stream URL found".into() });
                }
            }
            Err(e) => {
                eprintln!("[Klip] Failed to spawn yt-dlp for stream URL: {}", e);
                #[derive(Serialize, Clone)]
                struct StreamErrEvent { id: String, message: String }
                let _ = app_clone.emit("stream-error", StreamErrEvent { id: id_clone, message: e.to_string() });
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    state: State<'_, DownloadState>,
    id: String,
    url: String,
    quality: String,
    output_dir: String,
    trim_start: Option<f64>,
    trim_end: Option<f64>,
) -> Result<(), String> {
    let ytdlp = sidecar_path(&app, "yt-dlp")?;
    let ffmpeg = sidecar_path(&app, "ffmpeg")?;
    let ffmpeg_dir = ffmpeg
        .parent()
        .ok_or("ffmpeg has no parent dir")?
        .to_path_buf();

    let is_audio = is_audio_quality(&quality);
    let format = quality_to_format(&quality);

    let mut args: Vec<String> = vec![
        "--ignore-config".into(),
        "--newline".into(),
        "--no-warnings".into(),
        "--no-playlist".into(),
        "--ffmpeg-location".into(),
        ffmpeg_dir.to_string_lossy().to_string(),
        "-N".into(),
        "4".into(),
        "-f".into(),
        format.to_string(),
    ];

    if is_audio {
        args.extend(["--extract-audio".into(), "--audio-format".into(), "mp3".into()]);
    } else {
        args.extend(["--merge-output-format".into(), "mp4".into()]);
    }

    if let (Some(start), Some(end)) = (trim_start, trim_end) {
        // e.g. --download-sections *00:32-02:15
        let start_h = (start / 3600.0).floor() as u64;
        let start_m = ((start % 3600.0) / 60.0).floor() as u64;
        let start_s = (start % 60.0) as u64;
        
        let end_h = (end / 3600.0).floor() as u64;
        let end_m = ((end % 3600.0) / 60.0).floor() as u64;
        let end_s = (end % 60.0) as u64;
        
        let start_str = format!("{:02}:{:02}:{:02}", start_h, start_m, start_s);
        let end_str = format!("{:02}:{:02}:{:02}", end_h, end_m, end_s);
        args.extend(["--force-keyframes-at-cuts".into(), "--download-sections".into(), format!("*{}-{}", start_str, end_str)]);
    }

    let safe_dir = output_dir.trim_end_matches(['/', '\\']).to_string();
    args.extend(["-o".into(), format!("{}/%(title)s.%(ext)s", safe_dir), url.clone()]);

    eprintln!("[Klip Debug] Executing yt-dlp with args: {:?}", args);

    // Create std::fs::create_dir_all in blocking context
    let _ = std::fs::create_dir_all(&safe_dir);

    let mut cmd = Command::new(&ytdlp);
    cmd.args(&args).stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = spawn_cmd(&mut cmd).map_err(|e| format!("Failed to spawn yt-dlp: {e}"))?;

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;

    // Store child for cancellation
    let processes = state.processes.clone();
    {
        let mut map = processes.lock().unwrap();
        map.insert(id.clone(), child);
    }

    let app_clone = app.clone();
    let id_clone = id.clone();
    let processes_clone = processes.clone();

    tokio::task::spawn_blocking(move || {
        let progress_re = Regex::new(r"\[download\]\s+([\d.]+)%").unwrap();
        let speed_re = Regex::new(r"at\s+([\d.]+\s*\S+)").unwrap();
        let eta_re = Regex::new(r"ETA\s+(\S+)").unwrap();
        let dest_re = Regex::new(r"\[(?:download|Merger|ExtractAudio|ffmpeg)\]\s+(?:Destination:\s*|Merging formats into\s*)\x22?([^\x22\r\n]+)\x22?").unwrap();
        let already_downloaded_re = Regex::new(r"\[download\]\s+(.+?)\s+has already been downloaded").unwrap();

        let mut file_path = String::new();
        let mut error_buf = String::new();

        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            if let Some(cap) = dest_re.captures(&line) {
                file_path = cap[1].trim().to_string();
            } else if let Some(cap) = already_downloaded_re.captures(&line) {
                file_path = cap[1].trim().to_string();
            }

            if let Some(cap) = progress_re.captures(&line) {
                let percent: f64 = cap[1].parse().unwrap_or(0.0);
                let speed = speed_re.captures(&line)
                    .map(|c| c[1].trim().to_string())
                    .unwrap_or_default();
                let eta = eta_re.captures(&line)
                    .map(|c| c[1].to_string())
                    .unwrap_or_default();
                let _ = app_clone.emit("download-progress", ProgressEvent {
                    id: id_clone.clone(), percent, speed, eta,
                    phase: "downloading".into(),
                });
            } else if line.contains("[Merger]") || (line.contains("[ffmpeg]") && !line.contains("[download]")) {
                let _ = app_clone.emit("download-progress", ProgressEvent {
                    id: id_clone.clone(), percent: 99.0,
                    speed: String::new(), eta: String::new(),
                    phase: "merging".into(),
                });
            } else if line.contains("[ExtractAudio]") {
                let _ = app_clone.emit("download-progress", ProgressEvent {
                    id: id_clone.clone(), percent: 99.0,
                    speed: String::new(), eta: String::new(),
                    phase: "extracting".into(),
                });
            } else if line.starts_with("ERROR") {
                error_buf.push_str(&line);
                error_buf.push('\n');
            }
        }

        // Read stderr
        let stderr_reader = BufReader::new(stderr);
        for line in stderr_reader.lines().flatten() {
            if line.to_lowercase().contains("error") {
                error_buf.push_str(&line);
                error_buf.push('\n');
            }
        }

        // Check cancellation: if process is gone from map, it was cancelled
        let was_cancelled = {
            let mut map = processes_clone.lock().unwrap();
            // Try to wait on the child to get exit code
            if let Some(mut child) = map.remove(&id_clone) {
                let status = child.wait().ok();
                let success = status.map(|s| s.success()).unwrap_or(false);
                if success || !file_path.is_empty() {
                    let _ = app_clone.emit("download-complete", CompleteEvent {
                        id: id_clone.clone(),
                        file_path: file_path.clone(),
                    });
                } else if !error_buf.is_empty() {
                    let _ = app_clone.emit("download-error", ErrorEvent {
                        id: id_clone.clone(),
                        message: classify_error(&error_buf),
                    });
                } else {
                    // Likely cancelled after stdout closed
                    let _ = app_clone.emit("download-cancelled", CancelledEvent {
                        id: id_clone.clone(),
                    });
                }
                false
            } else {
                true // already removed = cancelled
            }
        };

        if was_cancelled {
            let _ = app_clone.emit("download-cancelled", CancelledEvent { id: id_clone });
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(state: State<'_, DownloadState>, id: String) -> Result<(), String> {
    let mut map = state.processes.lock().unwrap();
    if let Some(mut child) = map.remove(&id) {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &child.id().to_string()])
                .creation_flags(0x08000000)
                .spawn();
        }
        #[cfg(not(windows))]
        {
            let _ = child.kill();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    use std::path::Path;

    let path_obj = Path::new(&path);
    
    #[cfg(windows)]
    {
        // Use /select, "path" to open folder and highlight the file
        if path_obj.is_file() {
            Command::new("explorer").args(["/select,", &path]).spawn().map_err(|e| e.to_string())?;
        } else {
            // If it's a directory or doesn't exist, try to open the parent or just the path
            let dir_to_open = if path_obj.is_dir() {
                path_obj
            } else {
                path_obj.parent().unwrap_or(path_obj)
            };
            Command::new("explorer").arg(dir_to_open.as_os_str()).spawn().map_err(|e| e.to_string())?;
        }
    }
    #[cfg(target_os = "macos")]
    {
        if path_obj.is_file() {
            Command::new("open").args(["-R", &path]).spawn().map_err(|e| e.to_string())?;
        } else {
            let dir_to_open = if path_obj.is_dir() { path_obj } else { path_obj.parent().unwrap_or(path_obj) };
            Command::new("open").arg(dir_to_open.as_os_str()).spawn().map_err(|e| e.to_string())?;
        }
    }
    #[cfg(target_os = "linux")]
    {
        let dir_to_open = if path_obj.is_dir() {
            path_obj
        } else {
            path_obj.parent().unwrap_or(path_obj)
        };
        Command::new("xdg-open").arg(dir_to_open.as_os_str()).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_default_download_dir() -> Result<String, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let path = std::path::Path::new(&home).join("Downloads").join("Klip");
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn detect_browsers() -> Result<Vec<String>, String> {
    let mut installed = Vec::new();
    let candidates = [
        ("chrome", "Google\\Chrome\\Application\\chrome.exe"),
        ("edge", "Microsoft\\Edge\\Application\\msedge.exe"),
        ("firefox", "Mozilla Firefox\\firefox.exe"),
        ("brave", "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
        ("opera", "Opera\\launcher.exe"),
        ("vivaldi", "Vivaldi\\Application\\vivaldi.exe"),
    ];

    for (name, path) in candidates.iter() {
        // Check standard install paths
        let path1 = std::path::PathBuf::from(std::env::var("ProgramFiles").unwrap_or_default()).join(path);
        let path2 = std::path::PathBuf::from(std::env::var("ProgramFiles(x86)").unwrap_or_default()).join(path);
        let path3 = std::path::PathBuf::from(std::env::var("LOCALAPPDATA").unwrap_or_default()).join(path);

        if path1.exists() || path2.exists() || path3.exists() {
            installed.push(name.to_string());
        }
    }
    
    Ok(installed)
}



#[tauri::command]
pub async fn fetch_playlist_metadata(app: AppHandle, id: String, url: String) -> Result<(), String> {
    let ytdlp = sidecar_path(&app, "yt-dlp")?;
    let app_clone = app.clone();
    let id_clone = id.clone();
    let url_clone = url.clone();

    tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&ytdlp);
        let mut args = vec![
            "--ignore-config".to_string(),
            "-J".to_string(),
            "--flat-playlist".to_string(),
        ];
        
        args.push(url_clone);
        
        cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());

        match spawn_cmd(&mut cmd).and_then(|c| c.wait_with_output()) {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let stdout_trimmed = stdout.trim();
                let stderr_trimmed = stderr.trim();

                if stdout_trimmed.is_empty() {
                    let s = stderr_trimmed.to_lowercase();
                    let msg = if s.is_empty() {
                        "Unknown error (yt-dlp returned no output)".to_string()
                    } else if s.contains("database is locked") || s.contains("could not copy chrome cookie database") || s.contains("permission denied") || s.contains("dpapi") || s.contains("failed to decrypt") {
                        "Couldn't access browser cookies (this is a known Chrome/Windows limitation). Try closing Chrome first, switching to Firefox in the dropdown, or turning off cookie extraction — most videos don't need it.".to_string()
                    } else {
                        let first_line = stderr_trimmed.lines().next().unwrap_or("Unknown error");
                        format!("Could not load playlist: {}", first_line)
                    };
                    let _ = app_clone.emit(
                        "playlist-error",
                        ErrorEvent { id: id_clone, message: msg },
                    );
                    return;
                }

                match serde_json::from_str::<serde_json::Value>(stdout_trimmed) {
                    Ok(json) => {
                        #[derive(Serialize, Clone)]
                        struct PlaylistEvent { id: String, data: serde_json::Value }
                        let _ = app_clone.emit("playlist-metadata", PlaylistEvent { id: id_clone, data: json });
                    }
                    Err(e) => {
                        let _ = app_clone.emit("playlist-error", ErrorEvent { id: id_clone, message: format!("Parse error: {}", e) });
                    }
                }
            }
            Err(e) => {
                let _ = app_clone.emit("playlist-error", ErrorEvent { id: id_clone, message: format!("Failed to spawn yt-dlp: {}", e) });
            }
        }
    });

    Ok(())
}
