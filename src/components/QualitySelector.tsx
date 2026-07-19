import { motion } from 'framer-motion';

const QUALITIES = ['Best', '4K', '1080p', '720p', '480p', 'Audio'];

interface QualitySelectorProps {
  value: string;
  onChange: (q: string) => void;
  options?: { id: string, label: string }[];
  isLoading?: boolean;
}

export function QualitySelector({ value, onChange, options, isLoading }: QualitySelectorProps) {
  const displayOptions = options || QUALITIES.map(q => ({ id: q, label: q }));

  if (isLoading) {
    return (
      <div className="quality-selector" style={{ gap: 8 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="shimmer"
            style={{ width: 60, height: 32, borderRadius: 8, background: 'var(--bg-hover)' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="quality-selector" role="group" aria-label="Quality selection">
      {displayOptions.map(opt => (
        <button
          key={opt.id}
          id={`quality-${opt.id}`}
          className={`quality-option ${value === opt.id ? 'active' : ''}`}
          onClick={() => onChange(opt.id)}
          style={{ position: 'relative' }}
        >
          {value === opt.id && (
            <motion.div
              className="quality-indicator"
              layoutId="quality-pill"
              style={{ inset: 0, position: 'absolute', zIndex: -1, borderRadius: 8, background: 'var(--accent)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
