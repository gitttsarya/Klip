import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Trash2, DownloadCloud, Clock, Monitor } from 'lucide-react';
import type { DownloadItem } from '../types';

interface HistoryScreenProps {
  history: DownloadItem[];
  onClearHistory: () => void;
  onDownloadAgain: (url: string, quality: string, trimRange?: { start: number, end: number }) => void;
}

export function HistoryScreen({ history, onClearHistory, onDownloadAgain }: HistoryScreenProps) {
  const [search, setSearch] = useState('');

  const filteredHistory = useMemo(() => {
    if (!search.trim()) return history;
    const lower = search.toLowerCase();
    return history.filter(item => 
      (item.title && item.title.toLowerCase().includes(lower)) ||
      (item.platform && item.platform.toLowerCase().includes(lower)) ||
      item.url.toLowerCase().includes(lower)
    );
  }, [history, search]);

  return (
    <div className="screen" style={{ gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Download History</h2>
        
        {history.length > 0 && (
          <button 
            className="btn"
            onClick={onClearHistory}
            style={{ 
              background: 'transparent', border: '1px solid var(--border)', padding: '8px 16px', 
              borderRadius: 12, display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-error)' 
            }}
          >
            <Trash2 size={16} />
            Clear History
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            type="text"
            placeholder="Search history by title, url, or platform..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              paddingLeft: 44,
              height: 48,
              fontSize: 14,
              borderRadius: 12,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          />
        </div>
      )}

      {history.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '64px 0', color: 'var(--text-muted)' }}>
          <Clock size={48} opacity={0.5} />
          <p>Your download history is empty</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          No matches found for "{search}"
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AnimatePresence>
            {filteredHistory.map(item => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card"
                style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}
              >
                {/* Thumbnail */}
                <div style={{ width: 80, height: 60, borderRadius: 8, background: 'var(--bg-base)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Monitor size={24} color="var(--text-muted)" />
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title || item.url}
                  </span>
                  
                  <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                    {item.platform && <span>{item.platform}</span>}
                    {item.platform && <span>•</span>}
                    <span>{item.quality}</span>
                    {item.trimRange && (
                      <>
                        <span>•</span>
                        <span>Clipped</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{new Date(item.addedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onDownloadAgain(item.url, item.quality, item.trimRange)}
                  style={{
                    background: 'var(--bg-hover)', border: 'none', width: 40, height: 40, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)',
                    flexShrink: 0
                  }}
                  title="Download again"
                >
                  <DownloadCloud size={18} />
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
