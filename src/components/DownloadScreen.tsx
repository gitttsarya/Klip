import { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { Clipboard } from 'lucide-react';
import { QualitySelector } from './QualitySelector';
import { DownloadButton } from './DownloadButton';
import { DownloadItemCard } from './DownloadItemCard';
import { EmptyState } from './EmptyState';
import { TrimSlider } from './TrimSlider';
import { isSupportedUrl } from '../lib/platforms';
import type { DownloadItem } from '../types';

interface DownloadScreenProps {
  items: DownloadItem[];
  url: string;
  onUrlChange: (u: string) => void;
  quality: string;
  outputDir: string;
  fetchRealQualities: boolean;
  trimBeforeDownload: boolean;
  onQualityChange: (q: string) => void;
  onAddDownload: (url: string, quality: string, trimRange?: { start: number, end: number }) => void;

  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}




const metadataCache: Record<string, import('../types').MetadataPayload> = {};

export function DownloadScreen({
  items,
  url,
  onUrlChange,
  quality,
  outputDir: _outputDir,
  fetchRealQualities,
  trimBeforeDownload,
  onQualityChange,
  onAddDownload,

  onCancel,
  onRemove,
  onClearCompleted,
  onToast,
}: DownloadScreenProps) {
  const [urlError, setUrlError] = useState('');
  const [metaFetching, setMetaFetching] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<import('../types').MetadataPayload | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimRange, setTrimRange] = useState<{ start: number, end: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamLoading, setStreamLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const urlRef = useRef(url);
  // Increment each time a URL is processed — forces stream re-fetch even on same URL
  const streamFetchKey = useRef(0);
  const [streamKey, setStreamKey] = useState(0);
  
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  // For the Download button: show progress of the "most recent active" item
  const activeItem = items.find(it =>
    it.phase === 'downloading' || it.phase === 'merging' || it.phase === 'extracting'
  );

  useEffect(() => {
    let unlisten: () => void;
    let unlistenError: () => void;
    let unlistenStream: () => void;
    let unlistenStreamError: () => void;
    
    async function setup() {
      unlisten = await listen<import('../types').MetadataPayload>('download-metadata', (event) => {
        try {
          const payload = event.payload;
          // Defensive: validate payload has the fields we need before touching state
          if (!payload || typeof payload !== 'object' || !payload.id) {
            console.error('[Klip] Received malformed download-metadata payload:', payload);
            return;
          }
          // Cache it
          metadataCache[payload.id] = payload;
          // Only apply if it matches current URL
          if (payload.id === urlRef.current.trim()) {
            setMetadata(payload);
            setMetaError(null);
            setMetaFetching(false);
            // Auto-select Best or the highest available if the current quality is missing
            if (!payload.formats?.find((f: { id: string }) => f.id === quality)) {
              onQualityChange(payload.formats?.[0]?.id || 'Best');
            }
          }
        } catch (err) {
          console.error('[Klip] Error processing download-metadata event:', err);
          setMetaFetching(false);
        }
      });
      
      unlistenError = await listen<import('../types').ErrorPayload>('download-error', (event) => {
        try {
          if (event.payload.id === urlRef.current.trim()) {
            setMetaFetching(false);
            setMetadata(null);
            // Show inline preview-unavailable state AND a toast
            setMetaError(event.payload.message);
            onToast(`Preview failed: ${event.payload.message}`, 'error');
          }
        } catch (err) {
          console.error('[Klip] Error processing download-error event:', err);
          setMetaFetching(false);
        }
      });

      unlistenStream = await listen<{id: string, url: string}>('stream-url', (event) => {
        if (event.payload.id === urlRef.current.trim()) {
          setStreamUrl(event.payload.url);
          setStreamLoading(false);
        }
      });

      unlistenStreamError = await listen<{id: string, message: string}>('stream-error', (event) => {
        if (event.payload.id === urlRef.current.trim()) {
          setStreamLoading(false);
          setStreamUrl('');
          onToast(`Preview unavailable: ${event.payload.message}`, 'warning');
        }
      });
    }
    const cleanupPromise = setup();

    return () => {
      cleanupPromise.then(() => {
        if (unlisten) unlisten();
        if (unlistenError) unlistenError();
        if (unlistenStream) unlistenStream();
        if (unlistenStreamError) unlistenStreamError();
      });
    };
  }, [quality, onQualityChange, onToast]);

  useEffect(() => {
    if (metadata && metadata.id === url.trim()) {
      // Bump the key each time metadata arrives for the current URL so the stream
      // fetch always fires — even if it's the same URL loaded from cache a second time.
      streamFetchKey.current += 1;
      setStreamKey(streamFetchKey.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata?.id, url]);

  useEffect(() => {
    if (!metadata || metadata.id !== url.trim() || streamKey === 0) return;

    setStreamLoading(true);
    setStreamUrl('');

    invoke('fetch_stream_url', {
      id: url.trim(),
      url: url.trim()
    }).catch(() => {
      setStreamLoading(false);
      setStreamUrl('');
    });

    // 15-second hard timeout — if yt-dlp -g hasn't responded, fall back to thumbnail
    const streamTimeout = setTimeout(() => {
      setStreamLoading(false);
      // Only clear streamUrl if it hasn't been set yet by the event
      setStreamUrl(prev => prev || '');
    }, 15000);

    return () => {
      clearTimeout(streamTimeout);
    };
  }, [streamKey]);

  useEffect(() => {
    const trimmed = url.trim();
    if (fetchRealQualities && trimmed && isSupportedUrl(trimmed)) {
      if (metadataCache[trimmed]) {
        setMetadata(metadataCache[trimmed]);
        setMetaError(null);
        setMetaFetching(false);
        return;
      }
      
      setMetaFetching(true);
      setMetadata(null);
      setMetaError(null);
      setStreamUrl('');
      setStreamLoading(false);

      const timer = setTimeout(() => {
        invoke('fetch_metadata', {
          id: trimmed,
          url: trimmed
        }).catch(() => {
          setMetaFetching(false);
        });
        
        // Hard timeout — if no metadata event fires in 15s, un-stuck the shimmer
        const timeoutTimer = setTimeout(() => {
          setMetaFetching(false);
        }, 15000);

        return () => clearTimeout(timeoutTimer);
      }, 300);
      
      return () => {
        clearTimeout(timer);
      };
    } else {
      setMetaFetching(false);
      setMetadata(null);
      setMetaError(null);
      setIsTrimming(false);
      setTrimRange(null);
    }
  }, [url, fetchRealQualities]);

  const validateAndAdd = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) { setUrlError('Paste a URL first'); return; }
    if (!isSupportedUrl(trimmed)) {
      setUrlError('Unsupported or invalid URL');
      onToast('This URL is not supported. Check the list of supported platforms.', 'warning');
      return;
    }
    if (trimmed.includes('list=')) {
      setUrlError('This is a playlist URL. Please use the Playlist tab.');
      onToast('Please use the Playlist tab to download playlists.', 'warning');
      return;
    }
    setUrlError('');
    onAddDownload(trimmed, quality, isTrimming && trimRange ? trimRange : undefined);
    onUrlChange('');
    onToast('Added to queue', 'success');
  }, [url, quality, onAddDownload, onToast, isTrimming, trimRange]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      onUrlChange(text.trim());
      setUrlError('');
    } catch {
      onToast('Could not read clipboard', 'error');
    }
  }, [onToast]);



  const completedCount = items.filter(it => it.phase === 'done' || it.phase === 'failed' || it.phase === 'cancelled').length;

  return (
    <div className="screen" style={{ gap: 16 }}>
      {/* Input card with Premium Styling */}
      <div className="card" style={{ padding: '48px 40px', position: 'relative', marginBottom: 24 }}>
        <div className="noise-overlay" />
          
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
            
            {/* URL input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="text-xs font-bold text-muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Video URL
              </p>
              <div className="url-input-row" style={{ display: 'flex', gap: 12, position: 'relative' }}>
                <input
                  id="url-input"
                  ref={inputRef}
                  className={`input ${urlError ? 'error' : ''}`}
                  type="url"
                  placeholder="Paste video URL"
                  value={url}
                  onChange={e => { onUrlChange(e.target.value); setUrlError(''); }}
                  onKeyDown={e => e.key === 'Enter' && validateAndAdd()}
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    height: 60,
                    fontSize: 16,
                    padding: '0 20px',
                    background: 'var(--bg-base)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
                    borderRadius: 16,
                    border: '1px solid var(--border)'
                  }}
                />
                <motion.button
                  className="btn btn-primary"
                  onClick={handlePaste}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ flexShrink: 0, gap: 6, padding: '0 24px', height: 60, borderRadius: 16 }}
                  title="Paste from clipboard"
                >
                  <Clipboard size={18} />
                  Paste
                </motion.button>
              </div>
              <AnimatePresence>
                {urlError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-xs text-error"
                  >
                    {urlError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Preview & Info */}
            <AnimatePresence>
              {metaError && !metadata && (
                <motion.div
                  key="meta-error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden', marginTop: 16 }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px', borderRadius: 12,
                    background: 'rgba(255, 92, 122, 0.08)',
                    border: '1px solid rgba(255, 92, 122, 0.25)',
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#FF5C7A', margin: 0, marginBottom: 2 }}>
                        Preview unavailable
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 }}>
                        {metaError}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {metadata && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, overflow: 'hidden' }}
                >
                  {streamUrl ? (
                    <video
                      ref={videoRef}
                      src={streamUrl}
                      controls
                      playsInline
                      style={{ width: '100%', maxHeight: 240, aspectRatio: '16/9', borderRadius: 12, objectFit: 'contain', background: '#000' }}
                    />
                  ) : (
                    <div style={{ width: '100%', maxHeight: 240, aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', position: 'relative', background: '#000' }}>
                      <img src={metadata.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: streamLoading ? 0.5 : 1 }} />
                      {streamLoading && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>Loading preview...</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {metadata.title}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                      {metadata.duration} • {metadata.platform}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Trim Section */}
            <AnimatePresence>
              {metadata && trimBeforeDownload && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-base)', padding: 4, borderRadius: 10 }}>
                      <button
                        onClick={() => {
                          setIsTrimming(false);
                          setTrimRange(null);
                        }}
                        style={{
                          flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                          background: !isTrimming ? 'var(--bg-surface)' : 'transparent',
                          color: !isTrimming ? 'var(--text-primary)' : 'var(--text-dim)',
                          boxShadow: !isTrimming ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        Download full video
                      </button>
                      <button
                        onClick={() => {
                          setIsTrimming(true);
                          const dur = metadata.duration_raw || 60;
                          setTrimRange({ start: 0, end: dur });
                        }}
                        style={{
                          flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                          background: isTrimming ? 'var(--bg-surface)' : 'transparent',
                          color: isTrimming ? 'var(--text-primary)' : 'var(--text-dim)',
                          boxShadow: isTrimming ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        Download a clip
                      </button>
                    </div>

                    <AnimatePresence>
                      {isTrimming && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <TrimSlider 
                            duration={metadata.duration_raw}
                            onChange={(start, end) => setTrimRange({ start, end })}
                            videoRef={videoRef}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <QualitySelector 
                  value={quality} 
                  onChange={onQualityChange} 
                  options={metadata?.formats}
                  isLoading={metaFetching}
                />
              </div>
              <DownloadButton
                onClick={validateAndAdd}
                disabled={false}
                progress={activeItem ? activeItem.percent : null}
                phase={activeItem?.phase}
              />
            </div>

          </div>
      </div>

      {/* Downloads list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
        <div className="section-header">
          <span className="section-title">Downloads</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {items.length > 0 && (
              <span className="section-count counter">
                {items.filter(it => it.phase === 'done').length}/{items.length} done
              </span>
            )}
            {completedCount > 0 && (
              <motion.button
                className="btn btn-ghost"
                onClick={onClearCompleted}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                style={{ fontSize: 11, padding: '5px 10px' }}
              >
                Clear done
              </motion.button>
            )}
          </div>
        </div>

        <div className="download-list">
          <AnimatePresence mode="popLayout">
            {items.length === 0 ? (
              <EmptyState key="empty" />
            ) : (
              items.map(item => (
                <DownloadItemCard
                  key={item.id}
                  item={item}
                  onCancel={onCancel}
                  onRemove={onRemove}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
