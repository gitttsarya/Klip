import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '../types';

const DEFAULTS: AppSettings = {
  outputDir: '',
  quality: 'Best',
  theme: 'dark',
  concurrentLimit: 3,
  windowWidth: 960,
  windowHeight: 680,
  autoDetectClipboard: true,
  fetchRealQualities: true,
  trimBeforeDownload: true,
  downloadHistory: true,
  accentColor: '#BAFE00',
};

export const ACCENT_PRESETS = [
  { name: 'Lime', hex: '#BAFE00', text: '#121214' },
  { name: 'Violet', hex: '#8B5CF6', text: '#F5F5F7' },
  { name: 'Cyan', hex: '#22D3EE', text: '#121214' },
  { name: 'Coral', hex: '#FF5C7A', text: '#F5F5F7' },
  { name: 'Amber', hex: '#FBBF24', text: '#121214' },
];

// Simple localStorage-backed settings (Tauri Store plugin needs initialization)
function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('klip-settings');
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem('klip-settings', JSON.stringify(s));
  } catch {}
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  // On first load, get default download dir from Rust
  useEffect(() => {
    if (!settings.outputDir) {
      invoke<string>('get_default_download_dir')
        .then(dir => {
          setSettings(prev => {
            const next = { ...prev, outputDir: dir };
            saveSettings(next);
            return next;
          });
        })
        .catch(() => {});
    }
  }, []);

  // Apply accent color
  useEffect(() => {
    const preset = ACCENT_PRESETS.find(p => p.hex === settings.accentColor) || ACCENT_PRESETS[0];
    document.documentElement.style.setProperty('--accent', preset.hex);
    document.documentElement.style.setProperty('--text-on-accent', preset.text);
  }, [settings.accentColor]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
