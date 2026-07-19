import { motion } from 'framer-motion';
import { Download } from 'lucide-react';

export function EmptyState() {
  return (
    <motion.div 
      className="empty-state"
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="empty-icon-wrap"
        animate={{
          y: [0, -8, 0],
          boxShadow: [
            '0 0 0px rgba(186,254,0,0)',
            '0 0 24px rgba(186,254,0,0.25)',
            '0 0 0px rgba(186,254,0,0)',
          ],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Download size={28} color="var(--text-dim)" />
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p className="text-base font-semibold text-muted">No downloads yet</p>
        <p className="text-sm text-dim">Paste a URL above and hit Download</p>
      </div>
    </motion.div>
  );
}
