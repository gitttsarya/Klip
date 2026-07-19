import { motion } from 'framer-motion';
import { Github, Sparkles } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } },
};

export function AboutScreen() {
  return (
    <div className="screen" style={{ padding: 0 }}>
      <div className="card" style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <div className="about-card" style={{ padding: '48px 32px' }}>
          {/* Animated logo (No Glow) */}
          <motion.div
            className="about-logo"
            animate={{
              y: [0, -6, 0],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ overflow: 'hidden', borderRadius: 20 }}
          >
            <img
              src="/klip-logo.png"
              alt="Klip"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', marginBottom: 32 }}>
            <p className="text-3xl font-extrabold text-primary" style={{ letterSpacing: '-1px' }}>Klip</p>
            <p className="text-sm text-muted">Version 2.0.0</p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, 
              background: 'rgba(186,254,0,0.1)', color: 'var(--accent)', 
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              marginTop: 4
            }}>
              <Sparkles size={12} />
              <span>Vibe Coded</span>
            </div>
          </div>

          <motion.div
            className="about-info-grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Features Section */}
            <motion.div variants={rowVariants} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', paddingLeft: 8 }}>
                Features
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="about-info-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
                  <span style={{ fontSize: 16 }}>🎬</span>
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>Any Quality</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>— 4K down to Audio-only</span>
                </div>
                <div className="about-info-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
                  <span style={{ fontSize: 16 }}>✂️</span>
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>Trim Before Download</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>— cut clips without downloading the full video</span>
                </div>
                <div className="about-info-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
                  <span style={{ fontSize: 16 }}>📋</span>
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>Playlist Support</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>— download full playlists or custom ranges</span>
                </div>
                <div className="about-info-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
                  <span style={{ fontSize: 16 }}>🕒</span>
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>Download History</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>— track your past downloads</span>
                </div>
              </div>
            </motion.div>

            {/* Supported Platforms Section */}
            <motion.div variants={rowVariants} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', paddingLeft: 8 }}>
                Supported Platforms
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 8px' }}>
                {['YouTube', 'TikTok', 'Instagram', 'Twitter/X', 'Facebook', 'Reddit', 'Twitch', 'Vimeo'].map(platform => (
                  <span key={platform} style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {platform}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 8 }}>
                + thousands more (powered by yt-dlp)
              </span>
            </motion.div>

            {/* Credits / Info Section */}
            <motion.div variants={rowVariants} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', paddingLeft: 8 }}>
                Credits & Info
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => openUrl('https://github.com/gitttsarya/Klip')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', background: 'var(--bg-surface)', borderRadius: 12,
                    border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 150ms'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--text-dim)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Github size={20} className="text-primary" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Developer: gitttsarya (Satish)</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>GitHub ↗</span>
                </button>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => openUrl('https://github.com/gitttsarya/Klip/releases')}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 12,
                      border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-primary)',
                      fontSize: 13, fontWeight: 500, transition: 'background 150ms'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseOut={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  >
                    Check for Updates
                  </button>
                  <button
                    onClick={() => openUrl('https://github.com/gitttsarya/Klip/issues')}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 12,
                      border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-primary)',
                      fontSize: 13, fontWeight: 500, transition: 'background 150ms'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseOut={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  >
                    Report an Issue
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
