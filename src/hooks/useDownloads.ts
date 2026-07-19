import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  DownloadItem,
  DownloadPhase,
  ProgressPayload,
  CompletePayload,
  ErrorPayload,
  MetadataPayload,
  CancelledPayload,
} from '../types';

let idCounter = 0;
function genId() { return `dl-${Date.now()}-${idCounter++}`; }

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function useDownloads(concurrentLimit: number = 3, onComplete?: (item: DownloadItem) => void) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [items, setItems] = useState<DownloadItem[]>([]);
  const activeCount = useRef(0);
  const queue = useRef<DownloadItem[]>([]);

  // Listen to Tauri events
  useEffect(() => {
    const unlisten: Array<() => void> = [];

    listen<ProgressPayload>('download-progress', ({ payload }) => {
      setItems(prev => prev.map(item =>
        item.id === payload.id
          ? {
              ...item,
              percent: payload.percent,
              speed: payload.speed,
              eta: payload.eta,
              phase: payload.phase as DownloadPhase,
            }
          : item
      ));
    }).then(fn => unlisten.push(fn));

    listen<CompletePayload>('download-complete', ({ payload }) => {
      activeCount.current = Math.max(0, activeCount.current - 1);
      
      let finishedItem: DownloadItem | undefined;
      
      setItems(prev => {
        const next = prev.map(item =>
          item.id === payload.id
            ? { ...item, phase: 'done' as DownloadPhase, percent: 100, filePath: payload.file_path }
            : item
        );
        finishedItem = next.find(i => i.id === payload.id);
        return next;
      });

      if (finishedItem && onCompleteRef.current) {
        try {
          onCompleteRef.current(finishedItem);
        } catch (e) {
          console.error('[Klip] addToHistory failed:', e);
        }
      }
      
      drainQueue();
    }).then(fn => unlisten.push(fn));

    listen<ErrorPayload>('download-error', ({ payload }) => {
      activeCount.current = Math.max(0, activeCount.current - 1);
      setItems(prev => prev.map(item =>
        item.id === payload.id
          ? { ...item, phase: 'failed', errorMessage: payload.message }
          : item
      ));
      drainQueue();
    }).then(fn => unlisten.push(fn));

    listen<MetadataPayload>('download-metadata', ({ payload }) => {
      setItems(prev => prev.map(item =>
        item.id === payload.id
          ? {
              ...item,
              title: payload.title || item.title,
              thumbnail: payload.thumbnail || item.thumbnail,
              duration: item.trimRange ? formatDuration(item.trimRange.end - item.trimRange.start) : payload.duration,
              platform: payload.platform || item.platform,
            }
          : item
      ));
    }).then(fn => unlisten.push(fn));

    listen<CancelledPayload>('download-cancelled', ({ payload }) => {
      activeCount.current = Math.max(0, activeCount.current - 1);
      setItems(prev => prev.map(item =>
        item.id === payload.id
          ? { ...item, phase: 'cancelled' }
          : item
      ));
      drainQueue();
    }).then(fn => unlisten.push(fn));

    return () => { unlisten.forEach(fn => fn()); };
  }, []);

  function drainQueue() {
    while (activeCount.current < concurrentLimit && queue.current.length > 0) {
      const next = queue.current.shift()!;
      activeCount.current++;
      executeDownload(next);
    }
  }

  function executeDownload(item: DownloadItem) {
    // Fetch metadata first (non-blocking)
    invoke('fetch_metadata', { id: item.id, url: item.url }).catch(() => {});

    // Start download (show starting phase before yt-dlp emits progress)
    setItems(prev => prev.map(d =>
      d.id === item.id ? { ...d, phase: 'starting' } : d
    ));

    invoke('start_download', {
      id: item.id,
      url: item.url,
      quality: item.quality,
      outputDir: item.filePath || '',
      trimStart: item.trimRange?.start,
      trimEnd: item.trimRange?.end,
    }).catch((err: string) => {
      activeCount.current = Math.max(0, activeCount.current - 1);
      setItems(prev => prev.map(d =>
        d.id === item.id
          ? { ...d, phase: 'failed', errorMessage: err || 'Download failed' }
          : d
      ));
      drainQueue();
    });
  }

  const addDownload = useCallback((url: string, quality: string, outputDir: string, trimRange?: { start: number, end: number }) => {
    const id = genId();
    const platformHint = url.toLowerCase().includes('youtu') ? 'YouTube'
      : url.toLowerCase().includes('tiktok') ? 'TikTok'
      : url.toLowerCase().includes('instagram') ? 'Instagram'
      : url.toLowerCase().includes('twitter') || url.toLowerCase().includes('x.com') ? 'Twitter/X'
      : url.toLowerCase().includes('facebook') || url.toLowerCase().includes('fb.watch') ? 'Facebook'
      : url.toLowerCase().includes('reddit') ? 'Reddit'
      : url.toLowerCase().includes('twitch') ? 'Twitch'
      : url.toLowerCase().includes('vimeo') ? 'Vimeo'
      : '';

    const newItem: DownloadItem = {
      id,
      url,
      quality,
      phase: 'queued',
      percent: 0,
      speed: '',
      eta: '',
      title: (() => { try { return new URL(url).hostname; } catch { return url; } })(),
      thumbnail: '',
      duration: '',
      platform: platformHint,
      filePath: outputDir,
      errorMessage: '',
      addedAt: Date.now(),
      trimRange,
    };

    setItems(prev => [newItem, ...prev]);

    if (activeCount.current < concurrentLimit) {
      activeCount.current++;
      executeDownload(newItem);
    } else {
      queue.current.push(newItem);
    }

    return id;
  }, [concurrentLimit]);



  const cancelDownload = useCallback((id: string) => {
    invoke('cancel_download', { id }).catch(() => {});
    // Decrement activeCount so queued items can proceed
    activeCount.current = Math.max(0, activeCount.current - 1);
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, phase: 'cancelled' } : item
    ));
    drainQueue();
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setItems(prev => prev.filter(item =>
      item.phase !== 'done' && item.phase !== 'failed' && item.phase !== 'cancelled'
    ));
  }, []);

  return { items, addDownload, cancelDownload, removeItem, clearCompleted };
}
