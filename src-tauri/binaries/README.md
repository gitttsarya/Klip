# Klip Sidecar Binaries

This directory must contain yt-dlp and ffmpeg binaries **before** running `tauri dev` or `tauri build`.

## Required files

Tauri requires sidecars to be named with the target triple suffix:

**Windows (x64):**
- `yt-dlp-x86_64-pc-windows-msvc.exe`
- `ffmpeg-x86_64-pc-windows-msvc.exe`

**macOS (Apple Silicon):**
- `yt-dlp-aarch64-apple-darwin`
- `ffmpeg-aarch64-apple-darwin`

**macOS (Intel):**
- `yt-dlp-x86_64-apple-darwin`
- `ffmpeg-x86_64-apple-darwin`

## How to get them

### yt-dlp.exe
Download from: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe  
Rename to: `yt-dlp-x86_64-pc-windows-msvc.exe`

### ffmpeg.exe
Download the static Windows build from: https://github.com/yt-dlp/FFmpeg-Builds/releases/latest  
Extract `ffmpeg.exe` from the zip, rename to: `ffmpeg-x86_64-pc-windows-msvc.exe`

## One-liner (PowerShell)

```powershell
# yt-dlp
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" `
  -OutFile "yt-dlp-x86_64-pc-windows-msvc.exe"

# ffmpeg (extract from zip)
$zip = "ffmpeg.zip"
Invoke-WebRequest -Uri "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" -OutFile $zip
$entry = (Get-Item $zip | Expand-Archive -PassThru -DestinationPath "ffmpeg_tmp" -Force; Get-ChildItem -Recurse ffmpeg_tmp -Filter ffmpeg.exe | Select-Object -First 1)
Copy-Item $entry.FullName "ffmpeg-x86_64-pc-windows-msvc.exe"
Remove-Item $zip, ffmpeg_tmp -Recurse -Force
```
