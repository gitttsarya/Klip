import { useEffect, useRef } from 'react';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { isSupportedUrl } from '../lib/platforms';

export function useClipboardDetect(
  enabled: boolean,
  onDetect: (url: string) => void
) {
  const lastDetectedRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;

    // Check clipboard when window gains focus
    const checkClipboard = async () => {
      try {
        const text = await readText();
        const url = (text || '').trim();
        
        if (url && url !== lastDetectedRef.current && isSupportedUrl(url)) {
          lastDetectedRef.current = url;
          onDetect(url);
        }
      } catch {
        // Ignore clipboard read errors
      }
    };

    window.addEventListener('focus', checkClipboard);
    
    // Check once on mount
    checkClipboard();

    return () => {
      window.removeEventListener('focus', checkClipboard);
    };
  }, [enabled, onDetect]);
}
