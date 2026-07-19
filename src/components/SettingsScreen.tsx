import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Layers, Gauge, CheckCircle2, Sliders, Palette, Terminal } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { ACCENT_PRESETS } from '../hooks/useSettings';
import type { AppSettings } from '../types';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.055 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } },
};

export function SettingsScreen({ settings, onUpdate, onToast }: SettingsScreenProps) {
  const [folderEdit, setFolderEdit] = useState(settings.outputDir);
  const [_detectedBrowsers, setDetectedBrowsers] = useState<string[]>([]);
  const [_loadingBrowsers, setLoadingBrowsers] = useState(false);


  useEffect(() => {
    setLoadingBrowsers(true);
    invoke<string[]>('detect_browsers')
      .then(browsers => {
        setDetectedBrowsers(browsers);
      })
      .catch(() => setDetectedBrowsers([]))
      .finally(() => setLoadingBrowsers(false));
  }, []); // Run once on mount only — adding onUpdate here causes an infinite re-render loop

  async function browseFolder() {
    try {
      const selected = await openDialog({ directory: true, defaultPath: settings.outputDir });
      if (selected && typeof selected === 'string') {
        setFolderEdit(selected);
        onUpdate({ outputDir: selected });
        onToast('Download folder updated', 'success');
      }
    } catch {
      onToast('Could not open folder picker', 'error');
    }
  }

  return (
    <div className="screen" style={{ padding: 0 }}>
      <motion.div
        className="settings-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}
      >
        {/* Output folder */}
        <motion.div className="card" variants={cardVariants} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderOpen size={18} className="text-accent" />
            <div>
              <p className="settings-label">Download Folder</p>
              <p className="settings-description">Where Klip saves your downloads</p>
            </div>
          </div>
          <div className="folder-input-row" style={{ display: 'flex', gap: 8 }}>
            <input
              id="output-dir-input"
              className="input"
              value={folderEdit}
              onChange={e => setFolderEdit(e.target.value)}
              onBlur={() => {
                if (folderEdit !== settings.outputDir) {
                  onUpdate({ outputDir: folderEdit });
                  onToast('Download folder updated', 'success');
                }
              }}
              spellCheck={false}
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
            <motion.button
              className="btn btn-primary"
              onClick={browseFolder}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Browse
            </motion.button>
          </div>
        </motion.div>



        {/* Accent Color */}
        <motion.div className="card" variants={cardVariants} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Palette size={18} className="text-accent" />
            <div>
              <p className="settings-label">Accent Color</p>
              <p className="settings-description">Choose your preferred app color</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            {ACCENT_PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => onUpdate({ accentColor: preset.hex })}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: preset.hex,
                  border: 'none', cursor: 'pointer',
                  position: 'relative',
                }}
                aria-label={`Select ${preset.name} accent`}
              >
                {settings.accentColor === preset.hex && (
                  <motion.div
                    layoutId="accent-glow-ring"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    style={{
                      position: 'absolute', inset: -6, borderRadius: '50%',
                      border: `2px solid ${preset.hex}`,
                      opacity: 0.5,
                      boxShadow: `0 0 12px ${preset.hex}40`
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Default Quality */}
        <motion.div className="card" variants={cardVariants} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Gauge size={18} className="text-accent" />
            <div>
              <p className="settings-label">Default Quality</p>
              <p className="settings-description">Starting quality when you open Klip</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Best', '4K', '1080p', '720p', '480p', 'Audio'].map(q => (
              <button
                key={q}
                onClick={() => onUpdate({ quality: q })}
                className={`settings-pill ${settings.quality === q ? 'active' : ''}`}
                style={{ padding: '6px 12px', borderRadius: 8 }}
              >
                {settings.quality === q && (
                  <motion.div
                    className="settings-pill-bg"
                    layoutId="quality-pill-bg"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>{q}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Concurrent Downloads */}
        <motion.div className="card" variants={cardVariants} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={18} className="text-accent" />
            <div>
              <p className="settings-label">Concurrent Downloads</p>
              <p className="settings-description">How many files download at once</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => onUpdate({ concurrentLimit: n })}
                className={`settings-pill ${settings.concurrentLimit === n ? 'active' : ''}`}
                style={{ width: 36, height: 36, fontSize: 13, borderRadius: 8 }}
              >
                {settings.concurrentLimit === n && (
                  <motion.div
                    className="settings-pill-bg"
                    layoutId="limit-pill-bg"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>{n}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Features */}
        <motion.div className="card" variants={cardVariants} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sliders size={18} className="text-accent" />
            <div>
              <p className="settings-label">Features</p>
              <p className="settings-description">Toggle advanced functionality</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            {/* Clipboard Auto-detect */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#C4C8D4' }}>Clipboard auto-detect</span>
              <button
                onClick={() => onUpdate({ autoDetectClipboard: !settings.autoDetectClipboard })}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: settings.autoDetectClipboard ? 'var(--accent)' : '#3A3F4C',
                  display: 'flex', alignItems: 'center', padding: 2, cursor: 'pointer', border: 'none',
                }}
                aria-label="Toggle clipboard auto-detect"
              >
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{
                    width: 20, height: 20, borderRadius: 10,
                    background: settings.autoDetectClipboard ? 'var(--bg-base)' : '#F2F3F5',
                    marginLeft: settings.autoDetectClipboard ? 'auto' : 0,
                  }}
                />
              </button>
            </div>

            {/* Fetch Real Qualities */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#C4C8D4' }}>Fetch real quality options</span>
              <button
                onClick={() => onUpdate({ fetchRealQualities: !settings.fetchRealQualities })}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: settings.fetchRealQualities ? 'var(--accent)' : '#3A3F4C',
                  display: 'flex', alignItems: 'center', padding: 2, cursor: 'pointer', border: 'none',
                }}
                aria-label="Toggle fetch real qualities"
              >
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{
                    width: 20, height: 20, borderRadius: 10,
                    background: settings.fetchRealQualities ? 'var(--bg-base)' : '#F2F3F5',
                    marginLeft: settings.fetchRealQualities ? 'auto' : 0,
                  }}
                />
              </button>
            </div>

            {/* Trim Before Download */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: settings.fetchRealQualities ? 1 : 0.5 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#C4C8D4' }}>Trim before download</span>
                {!settings.fetchRealQualities && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Requires quality preview</span>}
              </div>
              <button
                onClick={() => settings.fetchRealQualities && onUpdate({ trimBeforeDownload: !settings.trimBeforeDownload })}
                disabled={!settings.fetchRealQualities}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: settings.trimBeforeDownload && settings.fetchRealQualities ? 'var(--accent)' : '#3A3F4C',
                  display: 'flex', alignItems: 'center', padding: 2,
                  cursor: settings.fetchRealQualities ? 'pointer' : 'not-allowed', border: 'none',
                }}
                aria-label="Toggle trim before download"
              >
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{
                    width: 20, height: 20, borderRadius: 10,
                    background: settings.trimBeforeDownload && settings.fetchRealQualities ? 'var(--bg-base)' : '#F2F3F5',
                    marginLeft: settings.trimBeforeDownload && settings.fetchRealQualities ? 'auto' : 0,
                  }}
                />
              </button>
            </div>

            {/* Download History */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#C4C8D4' }}>Download history</span>
              <button
                onClick={() => onUpdate({ downloadHistory: !settings.downloadHistory })}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: settings.downloadHistory ? 'var(--accent)' : '#3A3F4C',
                  display: 'flex', alignItems: 'center', padding: 2, cursor: 'pointer', border: 'none',
                }}
                aria-label="Toggle download history"
              >
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{
                    width: 20, height: 20, borderRadius: 10,
                    background: settings.downloadHistory ? 'var(--bg-base)' : '#F2F3F5',
                    marginLeft: settings.downloadHistory ? 'auto' : 0,
                  }}
                />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Sidecars */}
        <motion.div className="card" variants={cardVariants} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Terminal size={18} className="text-accent" />
            <div>
              <p className="settings-label">Sidecars</p>
              <p className="settings-description">Engine binaries powering Klip</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={14} color="var(--success)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#C4C8D4' }}>yt-dlp detected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={14} color="var(--success)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#C4C8D4' }}>ffmpeg detected</span>
            </div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
