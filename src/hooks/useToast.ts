import { useState, useCallback } from 'react';
import type { Toast, ToastType } from '../types';

// Simple uuid-like generator since we may not have uuid package
let counter = 0;
function genId() { return `toast-${Date.now()}-${counter++}`; }

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', action?: { label: string; onClick: () => void }) => {
    const id = genId();
    setToasts(prev => [...prev, { id, type, message, action }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
