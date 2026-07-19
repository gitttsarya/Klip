import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { Toast } from '../types';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const iconMap = {
  success: <CheckCircle size={16} color="var(--success)" />,
  error:   <AlertCircle  size={16} color="var(--error)" />,
  warning: <AlertTriangle size={16} color="var(--warning)" />,
  info:    <Info size={16} color="var(--accent)" />,
};

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="toast-container">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            layout
          >
            {iconMap[toast.type]}
            <span className="toast-message" style={{ flex: 1 }}>{toast.message}</span>
            {toast.action && (
              <button
                className="btn"
                onClick={() => {
                  toast.action!.onClick();
                  onRemove(toast.id);
                }}
                style={{
                  background: 'var(--accent)', color: 'var(--bg-base)', padding: '4px 12px',
                  borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  marginLeft: 8
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              className="btn-icon"
              onClick={() => onRemove(toast.id)}
              style={{ padding: '2px' }}
            >
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
