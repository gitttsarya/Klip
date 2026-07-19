import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion } from 'framer-motion';
import { Download, Loader2, ListVideo, AlertCircle, Search } from 'lucide-react';
import { QualitySelector } from './QualitySelector';
import { isSupportedUrl } from '../lib/platforms';

interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
}

interface PlaylistScreenProps {
  quality: string;
  onQualityChange: (q: string) => void;
  onAddDownload: (url: string, quality: string) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export function PlaylistScreen({
  quality,
  onQualityChange,
  onAddDownload,
  onToast,
}: PlaylistScreenProps) {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [loading, setLoading] = useState(false);
  const [playlistId, setPlaylistId] = useState('');
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rangeInput, setRangeInput] = useState('');

  useEffect(() => {
    let unlistenMeta: () => void;
    let unlistenError: () => void;

    async function setup() {
      unlistenMeta = await listen<{ id: string, data: any }>('playlist-metadata', (event) => {
        if (event.payload.id !== playlistId) return;
        setLoading(false);
        const data = event.payload.data;
        if (data.entries && Array.isArray(data.entries)) {
          const loadedEntries = data.entries.map((e: any) => ({
            id: e.id,
            title: e.title || 'Unknown Video',
            url: e.url,
            duration: e.duration || 0,
            thumbnail: (e.thumbnails && e.thumbnails.length > 0) ? e.thumbnails[0].url : e.thumbnail,
          }));
          setEntries(loadedEntries);
          setSelectedIds(new Set(loadedEntries.map((e: PlaylistEntry) => e.id))); // select all by default
        } else {
          onToast('No videos found in this playlist', 'error');
        }
      });

      unlistenError = await listen<{ id: string, message: string }>('playlist-error', (event) => {
        if (event.payload.id !== playlistId) return;
        setLoading(false);
        setUrlError(event.payload.message);
        onToast('Failed to load playlist', 'error');
      });
    }
    setup();

    return () => {
      if (unlistenMeta) unlistenMeta();
      if (unlistenError) unlistenError();
    };
  }, [playlistId, onToast]);

  const handleLoad = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) { setUrlError('Paste a playlist URL first'); return; }
    if (!isSupportedUrl(trimmed)) {
      setUrlError('Unsupported or invalid URL');
      return;
    }
    if (!trimmed.includes('list=')) {
      setUrlError("This doesn't look like a playlist URL (missing list=).");
      return;
    }
    
    setUrlError('');
    setLoading(true);
    setEntries([]);
    setSelectedIds(new Set());
    const id = Date.now().toString();
    setPlaylistId(id);

    invoke('fetch_playlist_metadata', {
      id,
      url: trimmed
    }).catch(err => {
      setLoading(false);
      setUrlError(String(err));
    });
  }, [url]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => setSelectedIds(new Set(entries.map(e => e.id)));
  const handleClearAll = () => setSelectedIds(new Set());

  const applyRange = () => {
    if (!rangeInput.trim()) return;
    const parts = rangeInput.split('-');
    if (parts.length === 2) {
      const start = parseInt(parts[0].trim());
      const end = parseInt(parts[1].trim());
      if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
        const next = new Set<string>();
        for (let i = start - 1; i < end && i < entries.length; i++) {
          next.add(entries[i].id);
        }
        setSelectedIds(next);
        return;
      }
    }
    onToast('Invalid range format. Use e.g. "1-10"', 'warning');
  };

  const handleDownloadSelected = () => {
    if (selectedIds.size === 0) {
      onToast('No videos selected', 'warning');
      return;
    }
    const selectedEntries = entries.filter(e => selectedIds.has(e.id));
    selectedEntries.forEach(e => {
      onAddDownload(e.url, quality);
    });
    onToast(`Added ${selectedEntries.length} videos to queue!`, 'success');
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="layout-content">
      <div className="layout-header">
        <h1 className="layout-title">Playlist Downloader</h1>
        <p className="layout-subtitle">Download multiple videos from a YouTube playlist</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
          <div className={`input-group ${urlError ? 'error' : ''}`} style={{ flex: 1, display: 'flex', position: 'relative', alignItems: 'center' }}>
            <ListVideo size={20} style={{ position: 'absolute', left: 20, color: 'var(--text-dim)' }} />
            <input
              type="text"
              className="input"
              placeholder="Paste playlist URL here..."
              value={url}
              onChange={e => { setUrl(e.target.value); setUrlError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLoad()}
              style={{ flex: 1, height: 60, paddingLeft: 52, background: 'var(--bg-base)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 16 }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleLoad} disabled={loading} style={{ height: 60, minWidth: 140, flexShrink: 0 }}>
            {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={18} />}
            {loading ? 'Fetching...' : 'Load Playlist'}
          </button>
        </div>
        {urlError && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{ color: 'var(--error)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
            <AlertCircle size={14} />
            {urlError}
          </motion.div>
        )}
      </div>

      {entries.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflow: 'hidden' }}>
          
          {/* Controls Bar (Redesigned) */}
          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', padding: '20px', borderRadius: 16, border: '1px solid var(--border)', gap: 16 }}>
            
            {/* ROW 1: Selection Info & Bulk Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 600 }}>
                {selectedIds.size} / {entries.length} selected
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="btn-secondary" 
                  onClick={handleSelectAll} 
                  style={{ fontSize: 13, fontWeight: 500, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                  Select All
                </button>
                <button 
                  className="btn-secondary" 
                  onClick={handleClearAll} 
                  style={{ fontSize: 13, fontWeight: 500, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                  Clear
                </button>
              </div>
            </div>

            <div style={{ width: '100%', height: 1, background: 'var(--border)', opacity: 0.5 }} />

            {/* ROW 2: Range Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>Select range:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 1-5"
                  value={rangeInput}
                  onChange={e => setRangeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyRange()}
                  style={{ width: 140, height: 40, fontSize: 14, background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={applyRange} 
                  style={{ fontSize: 14, fontWeight: 600, padding: '0 16px', height: 40 }}>
                  Apply
                </button>
              </div>
            </div>

            <div style={{ width: '100%', height: 1, background: 'var(--border)', opacity: 0.5 }} />

            {/* ROW 3: Download Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <QualitySelector
                value={quality}
                onChange={onQualityChange}
                options={[{id: 'Best', label: 'Best Video'}, {id: 'Audio', label: 'Audio Only'}]}
              />
              <button 
                className="btn btn-primary" 
                onClick={handleDownloadSelected} 
                disabled={selectedIds.size === 0} 
                style={{ height: 44, padding: '0 24px', fontSize: 14, fontWeight: 600 }}>
                <Download size={18} style={{ marginRight: 8 }} />
                Download Selected
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
            {entries.map((entry, i) => {
              const isSelected = selectedIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  onClick={() => toggleSelection(entry.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                    borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--bg-active)' : 'transparent',
                    transition: 'background 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} 
                    style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }}
                  />
                  <span style={{ color: 'var(--text-dim)', fontSize: 13, width: 24, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                  {entry.thumbnail && (
                    <img 
                      src={entry.thumbnail} 
                      alt="" 
                      style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0, backgroundColor: 'var(--bg-base)' }}
                    />
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {entry.title}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                    {formatDuration(entry.duration)}
                  </span>
                </div>
              );
            })}
          </div>

        </motion.div>
      )}

      {!loading && entries.length === 0 && !urlError && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, opacity: 0.5 }}>
          <ListVideo size={48} />
          <p>Paste a playlist URL to see its videos</p>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
