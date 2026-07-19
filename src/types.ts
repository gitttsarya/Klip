// ─── Download item types ──────────────────────────────────────────────────────

export type DownloadPhase =
  | 'queued'
  | 'starting'
  | 'fetching-meta'
  | 'downloading'
  | 'merging'
  | 'extracting'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface DownloadItem {
  id: string;
  url: string;
  quality: string;
  phase: DownloadPhase;
  percent: number;
  speed: string;
  eta: string;
  title: string;
  thumbnail: string;
  duration: string;
  platform: string;
  filePath: string;
  errorMessage?: string;
  addedAt: number;
  trimRange?: { start: number; end: number };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  outputDir: string;
  quality: string;
  theme: 'dark' | 'light';
  concurrentLimit: number;
  windowWidth?: number;
  windowHeight?: number;
  autoDetectClipboard?: boolean;
  fetchRealQualities: boolean;
  trimBeforeDownload: boolean;
  downloadHistory: boolean;
  accentColor: string;
}

// ─── Tauri event payloads ─────────────────────────────────────────────────────

export interface ProgressPayload {
  id: string;
  percent: number;
  speed: string;
  eta: string;
  phase: string;
}

export interface CompletePayload {
  id: string;
  file_path: string;
}

export interface ErrorPayload {
  id: string;
  message: string;
}

export interface VideoFormat {
  id: string;
  label: string;
}

export interface MetadataPayload {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  duration_raw: number;
  platform: string;
  formats: VideoFormat[];
}

export interface CancelledPayload {
  id: string;
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
