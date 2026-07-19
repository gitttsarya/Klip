import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TrimSliderProps {
  duration: number; // in seconds
  onChange: (start: number, end: number) => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function TrimSlider({ duration, onChange, videoRef }: TrimSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration || 100);
  const [currentTime, setCurrentTime] = useState(0);
  
  useEffect(() => {
    if (end > duration) {
      setEnd(duration);
    }
  }, [duration, end]);

  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return;
    
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [videoRef]);
  
  const handlePointerDown = (e: React.PointerEvent, isStart: boolean) => {
    const container = containerRef.current;
    if (!container) return;
    
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    
    const handleMove = (moveEvent: PointerEvent) => {
      let percent = (moveEvent.clientX - rect.left) / rect.width;
      percent = Math.max(0, Math.min(1, percent));
      const val = percent * duration;
      
      if (isStart) {
        const newStart = Math.min(val, end - 1); // at least 1 sec gap
        setStart(newStart);
        onChange(newStart, end);
        if (videoRef?.current) videoRef.current.currentTime = newStart;
      } else {
        const newEnd = Math.max(val, start + 1);
        setEnd(newEnd);
        onChange(start, newEnd);
        if (videoRef?.current) videoRef.current.currentTime = newEnd;
      }
    };
    
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const startPercent = (start / Math.max(duration, 1)) * 100;
  const endPercent = (end / Math.max(duration, 1)) * 100;
  const currentPercent = (currentTime / Math.max(duration, 1)) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {formatTime(start)} — {formatTime(end)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Clip: {formatTime(end - start)}
        </span>
      </div>

      <div 
        ref={containerRef}
        style={{ 
          height: 32, position: 'relative', display: 'flex', alignItems: 'center',
          cursor: 'pointer' 
        }}
        onPointerDown={(e) => {
          // If clicking on track, seek video but don't move handles unless clicked near them
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect && videoRef?.current) {
            let percent = (e.clientX - rect.left) / rect.width;
            percent = Math.max(0, Math.min(1, percent));
            videoRef.current.currentTime = percent * duration;
          }
        }}
      >
        {/* Track Background */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: 6, background: 'var(--bg-hover)', borderRadius: 3 }} />
        
        {/* Active Track */}
        <div 
          style={{ 
            position: 'absolute', left: `${startPercent}%`, width: `${endPercent - startPercent}%`, 
            height: 6, background: 'var(--accent)', borderRadius: 3,
            pointerEvents: 'none'
          }} 
        />

        {/* Playhead */}
        {videoRef && (
          <div 
            style={{ 
              position: 'absolute', left: `${currentPercent}%`, width: 2, 
              height: 16, background: '#FF0000', zIndex: 1,
              pointerEvents: 'none', transform: 'translateX(-50%)'
            }} 
          />
        )}

        {/* Start Handle */}
        <motion.div
          onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, true); }}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          style={{
            position: 'absolute',
            left: `calc(${startPercent}% - 8px)`,
            width: 16, height: 16, borderRadius: 8,
            background: 'var(--text-primary)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            cursor: 'ew-resize',
            zIndex: 2,
            touchAction: 'none'
          }}
        />

        {/* End Handle */}
        <motion.div
          onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, false); }}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          style={{
            position: 'absolute',
            left: `calc(${endPercent}% - 8px)`,
            width: 16, height: 16, borderRadius: 8,
            background: 'var(--text-primary)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            cursor: 'ew-resize',
            zIndex: 2,
            touchAction: 'none'
          }}
        />
      </div>
    </div>
  );
}
