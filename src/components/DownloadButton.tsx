import { useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Download, Loader2 } from 'lucide-react';

interface DownloadButtonProps {
  onClick: () => void;
  disabled?: boolean;
  progress?: number | null; // null = idle, 0-100 = progress mode
  phase?: string;
}

export function DownloadButton({ onClick, disabled = false, progress = null, phase }: DownloadButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [hovered, setHovered] = useState(false);
  const isProgress = progress !== null;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  }, [mouseX, mouseY]);

  const glowX = useTransform(mouseX, v => `${50 + v * 0.3}%`);
  const glowY = useTransform(mouseY, v => `${50 + v * 0.3}%`);

  const phaseLabel =
    phase === 'starting' ? 'Starting…' :
    phase === 'merging' ? 'Processing…' :
    phase === 'extracting' ? 'Extracting audio…' :
    phase === 'downloading' ? `${Math.round(progress ?? 0)}%` :
    'Downloading…';

  return (
    <motion.button
      ref={buttonRef}
      id="download-btn"
      className="btn btn-primary"
      style={{
        position: 'relative',
        overflow: 'hidden',
        minWidth: 160,
        height: 60,
        fontSize: 16,
        borderRadius: 16,
      }}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      {/* Cursor glow overlay */}
      <AnimatePresence>
        {hovered && !isProgress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle 60px at ${glowX.get()} ${glowY.get()}, rgba(255,255,255,0.2), transparent)`,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Progress fill */}
      <AnimatePresence>
        {isProgress && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: (progress ?? 0) / 100 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
              transformOrigin: 'left',
              pointerEvents: 'none',
            }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Button content */}
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
        <AnimatePresence mode="wait">
          {isProgress ? (
            <motion.span
              key="progress"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              {phaseLabel}
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Download size={14} />
              Download
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </motion.button>
  );
}
