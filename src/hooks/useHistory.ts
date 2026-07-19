import { useState, useEffect, useCallback } from 'react';
import type { DownloadItem } from '../types';

const HISTORY_KEY = 'klip-history';

export function useHistory(enabled: boolean) {
  const [history, setHistory] = useState<DownloadItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const addToHistory = useCallback((item: DownloadItem) => {
    if (!enabled) return;
    setHistory(prev => {
      // Check if it already exists (in case of re-runs or bugs)
      if (prev.some(i => i.id === item.id)) return prev;
      
      const next = [item, ...prev];
      // Optional: limit to last 1000 items to avoid blowing up localStorage
      if (next.length > 1000) next.length = 1000;
      
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, [enabled]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  return { history, addToHistory, clearHistory };
}
