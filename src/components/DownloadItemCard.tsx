import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Folder, AlertCircle, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { DownloadItem } from '../types';

interface DownloadItemCardProps {
  item: DownloadItem;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}

function PlatformBadge({ platform }: { platform: string }) {
  const colorMap: Record<string, string> = {
    YouTube: '#FF0000', TikTok: '#00F2EA', Instagram: '#E1306C',
    'Twitter/X': '#1DA1F2', Facebook: '#1877F2', Reddit: '#FF4500',
    Twitch: '#9146FF', Vimeo: '#1AB7EA',
  };
  const color = colorMap[platform] || 'var(--text-muted)';
  return (
    <span
      className="platform-badge"
      style={{ color, borderColor: `${color}30` }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color, display: 'inline-block',
        }}
      />
      {platform || 'Video'}
    </span>
  );
}

function ThumbnailSkeleton() {
  return <div className="skeleton" style={{ width: '100%', height: '100%' }} />;
}

export function DownloadItemCard({ item, onCancel, onRemove }: DownloadItemCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const isDone = item.phase === 'done';
  const isFailed = item.phase === 'failed';
  const isCancelled = item.phase === 'cancelled';
  const isActive = item.phase === 'downloading' || item.phase === 'merging' || item.phase === 'extracting';
  const isQueued = item.phase === 'queued' || item.phase === 'fetching-meta';
  const isFinished = isDone || isFailed || isCancelled;

  const progressColor = isDone ? 'var(--success)' : isFailed || isCancelled ? 'var(--error)' : 'var(--accent)';
  const progressPct = isDone ? 100 : isFailed || isCancelled ? 100 : item.percent;

  const statusText =
    isDone ? 'Complete' :
    isFailed ? item.errorMessage || 'Failed' :
    isCancelled ? 'Cancelled' :
    isQueued ? 'Queued' :
    item.phase === 'starting' ? (item.trimRange ? 'Trimming...' : 'Fetching video info...') :
    item.phase === 'merging' ? 'Processing…' :
    item.phase === 'extracting' ? 'Extracting audio…' :
    `${Math.round(item.percent)}%${item.speed ? ` · ${item.speed}` : ''}${item.eta ? ` · ETA ${item.eta}` : ''}`;

  return (
    <motion.div
      layout
      className="download-item"
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      whileHover={{ scale: 1.005, transition: { duration: 0.2 } }}
    >
      {/* Success glow overlay */}
      {isDone && (
        <motion.div
          className="item-success-glow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* Thumbnail */}
      <div className="download-item-thumb">
        {!imgErr && item.thumbnail ? (
          <>
            {!imgLoaded && <ThumbnailSkeleton />}
            <motion.img
              src={item.thumbnail}
              alt="thumb"
              style={{ opacity: imgLoaded ? 1 : 0, position: imgLoaded ? 'static' : 'absolute' }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgErr(true)}
              animate={{ opacity: imgLoaded ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            />
          </>
        ) : (
          <div
            style={{
              width: '100%', height: '100%', background: 'var(--bg-surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 18, opacity: 0.3 }}>▶</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="download-item-body">
        <p className="download-item-title" title={item.title}>
          {item.title}
        </p>

        <div className="download-item-meta">
          {item.platform && <PlatformBadge platform={item.platform} />}
          <span className="text-dim text-xs">{item.quality}</span>
          {item.duration && <span className="text-dim text-xs">{item.duration}</span>}
        </div>

        {/* Progress bar */}
        <div className="download-progress-bar-wrap">
          <motion.div
            className="download-progress-bar"
            animate={{
              scaleX: progressPct / 100,
              backgroundColor: progressColor,
            }}
            style={{ transformOrigin: 'left', scaleX: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Status text */}
        <div className="download-status-text">
          {isQueued && <Loader2 size={10} style={{ animation: 'spin 1.2s linear infinite', opacity: 0.5 }} />}
          {isFailed && <AlertCircle size={10} color="var(--error)" />}
          {isDone && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.1 }}
            >
              <Check size={10} color="var(--success)" />
            </motion.span>
          )}
          {isCancelled && <X size={10} color="var(--error)" />}
          <span
            style={{
              color: isDone ? 'var(--success)' : isFailed || isCancelled ? 'var(--error)' : 'var(--text-muted)',
              fontSize: 11,
            }}
          >
            {statusText}
          </span>

        </div>
      </div>

      {/* Actions */}
      <div className="download-item-actions">
        {isActive || isQueued ? (
          <motion.button
            className="btn-icon"
            onClick={() => onCancel(item.id)}
            title="Cancel"
            exit={{ opacity: 0, scale: 0.5 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X size={14} />
          </motion.button>
        ) : isFinished ? (
          <>
            {isDone && (
              <motion.button
                className="btn-icon"
                onClick={() => {
                  console.log("Opening folder for path:", item.filePath);
                  invoke('open_folder', { path: item.filePath }).catch(() => {})
                }}
                title="Open folder"
                exit={{ opacity: 0, scale: 0.5 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Folder size={14} />
              </motion.button>
            )}
            <motion.button
              className="btn-icon"
              onClick={() => onRemove(item.id)}
              title="Dismiss"
              exit={{ opacity: 0, scale: 0.5 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X size={12} />
            </motion.button>
          </>
        ) : null}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </motion.div>
  );
}
