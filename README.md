# Klip v2

A fast, beautiful desktop video downloader for Windows. Download from YouTube, TikTok, Instagram, Twitter/X, Facebook, Reddit, Twitch, Vimeo, and thousands more sites.

Built with **Tauri** (Rust) + **React** + **Framer Motion**.

---

## Features

- 🎬 Download from YouTube, TikTok, Instagram, Twitter/X, Facebook, Reddit, Twitch, Vimeo + thousands more
- 🎵 Quality options: Best, 4K, 1080p, 720p, 480p, Audio MP3
- 📦 Batch downloads — paste multiple URLs at once
- 📊 Live progress per item with speed and ETA
- ❌ Cancel any download instantly (clean process kill)
- 🎨 Premium UI with fluid Framer Motion animations
- 🌙 Dark and Light theme
- ⚡ Concurrent downloads (configurable, default 3)
- 🖥 Native Windows installer (.msi + .exe)

---

## Architecture

```
src/                   React + TypeScript + Framer Motion frontend
src-tauri/             Tauri (Rust) backend
  src/
    lib.rs             App setup + plugin registration
    downloader.rs      yt-dlp sidecar spawn, progress streaming, cancellation
  binaries/            yt-dlp.exe + ffmpeg.exe (bundled sidecars — see below)
  tauri.conf.json      App config + MSI/NSIS bundle targets
```

**Why Tauri?**
- Rust backend runs downloads off the UI thread — no UI freezing
- Cancel = kill the sidecar process handle Rust holds — clean, not a hack
- Progress parsed once in Rust, pushed as typed events to React
- Sidecar binaries bundled in the installer — no runtime dependency downloads

---

## Dev Setup

### Prerequisites

1. **Node.js 18+** — [nodejs.org](https://nodejs.org)
2. **Rust** — [rustup.rs](https://rustup.rs) (MSVC toolchain for Windows)
3. **Visual Studio Build Tools** with the **C++ workload** — [download](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
4. **yt-dlp + ffmpeg sidecars** — see below

### Sidecar Binaries

Klip uses yt-dlp and ffmpeg as bundled sidecar executables. Before running `tauri dev`:

1. Download **yt-dlp.exe** from [github.com/yt-dlp/yt-dlp/releases/latest](https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe)
2. Rename to `yt-dlp-x86_64-pc-windows-msvc.exe`
3. Download **ffmpeg** from [github.com/yt-dlp/FFmpeg-Builds/releases/latest](https://github.com/yt-dlp/FFmpeg-Builds/releases/latest)
4. Extract `ffmpeg.exe`, rename to `ffmpeg-x86_64-pc-windows-msvc.exe`
5. Place both in `src-tauri/binaries/`

**Quick PowerShell one-liner:**
```powershell
cd src-tauri/binaries

# yt-dlp
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" `
  -OutFile "yt-dlp-x86_64-pc-windows-msvc.exe"

# ffmpeg
$zip = "ffmpeg_temp.zip"
Invoke-WebRequest -Uri "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" -OutFile $zip
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip_file = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $zip))
$ffmpeg_entry = $zip_file.Entries | Where-Object { $_.Name -eq "ffmpeg.exe" } | Select-Object -First 1
[System.IO.Compression.ZipFileExtensions]::ExtractToFile($ffmpeg_entry, "ffmpeg-x86_64-pc-windows-msvc.exe", $true)
$zip_file.Dispose()
Remove-Item $zip -Force
```

### Run in Dev Mode

```bash
npm install
npm run tauri dev
```

### Build Installer

```bash
npm run build:installer
# Outputs: src-tauri/target/release/bundle/msi/Klip_2.0.0_x64_en-US.msi
#          src-tauri/target/release/bundle/nsis/Klip_2.0.0_x64-setup.exe
```

---

## What Changed vs v1 (VideoVault)

| Area | Old (VideoVault) | New (Klip v2) |
|---|---|---|
| Shell | Python + CustomTkinter | Tauri (Rust) + React |
| UI | CustomTkinter widgets | Framer Motion animations |
| Animation | None | Full spring physics everywhere |
| Downloads | Python subprocess | Rust sidecar (no UI freeze) |
| Cancellation | process.terminate() | Rust process handle kill |
| First launch | Download yt-dlp at runtime | Sidecars bundled in installer |
| Installer | PyInstaller .exe | WiX .msi + NSIS .exe |
| Progress | Regex on Python thread | Typed Tauri events from Rust |
| Thumbnails | None | Fetched via yt-dlp --print |
| Errors | Raw stack traces | Human-readable classification |
| Light mode | Stubbed | Fully implemented |
| Concurrent limit | Fixed (all at once) | Configurable (default 3) |

### Features ported from v1
- Single URL + batch URL download
- Quality options: Best / 4K / 1080p / 720p / 480p / Audio MP3
- YouTube, TikTok, Instagram, Twitter/X, Facebook, Reddit, Twitch, Vimeo
- Live progress per item
- Cancel per item
- Settings: output folder, default quality, theme
- About screen

### New in v2
- Framer Motion animations throughout (spec-defined — this is the product)
- Thumbnail preview per download item
- Human-readable error messages (not raw yt-dlp errors)
- Concurrent download limit with queue
- Window size/position persistence
- Light mode fully built
- Spring-animated sidebar nav pill
- Download button morphs to progress fill
- Animated download list (enter/exit/success pulse)
