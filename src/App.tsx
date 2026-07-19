import { useState } from 'react';
import { motion } from 'framer-motion';
import { TopNav, type Screen } from './components/TopNav';
import { TitleBar } from './components/TitleBar';
import { DownloadScreen } from './components/DownloadScreen';
import { PlaylistScreen } from './components/PlaylistScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { AboutScreen } from './components/AboutScreen';
import { ToastContainer } from './components/Toast';
import { useDownloads } from './hooks/useDownloads';
import { useSettings } from './hooks/useSettings';
import { useToast } from './hooks/useToast';
import { useHistory } from './hooks/useHistory';
import { useClipboardDetect } from './hooks/useClipboardDetect';
import { HistoryScreen } from './components/HistoryScreen';
import { ErrorBoundary } from './components/ErrorBoundary';

const screenVariants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('download');
  const [downloadUrl, setDownloadUrl] = useState('');
  
  const { settings, updateSettings } = useSettings();
  const { history, addToHistory, clearHistory } = useHistory(settings.downloadHistory);
  const { items, addDownload, cancelDownload, removeItem, clearCompleted } = useDownloads(settings.concurrentLimit, addToHistory);
  const { toasts, addToast, removeToast } = useToast();

  useClipboardDetect(settings.autoDetectClipboard ?? true, (detectedUrl) => {
    addToast('Supported URL detected in clipboard!', 'info', {
      label: 'Paste & Download',
      onClick: () => {
        setDownloadUrl(detectedUrl);
        setScreen('download');
      }
    });
  });

  function handleAddDownload(url: string, quality: string, trimRange?: { start: number, end: number }) {
    addDownload(url, quality, settings.outputDir, trimRange);
  }

  // Apply theme to root
  const isLight = settings.theme === 'light';

  return (
    <motion.div
      className="app-shell"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={isLight ? {
        '--bg-base': '#F5F6F8',
        '--bg-elevated': '#ECEEF2',
        '--bg-card': '#FFFFFF',
        '--bg-surface': '#F0F2F5',
        '--bg-hover': '#E5E8EE',
        '--text-primary': '#111318',
        '--text-muted': '#5A6070',
        '--text-dim': '#9BA3B4',
        '--border': '#DDE0E8',
        '--shadow-card': '0 2px 12px rgba(0,0,0,0.06)',
      } as React.CSSProperties : undefined}
    >
      <TitleBar />
      <TopNav active={screen} onChange={setScreen} showHistory={settings.downloadHistory} />

      <main className="app-content">
        <div className="ambient-glow" />

        <div className="content-column">
          <motion.div
            key={screen}
            variants={screenVariants}
            initial="enter"
            animate="center"
            transition={{ type: 'spring', stiffness: 380, damping: 32, duration: 0.3 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <ErrorBoundary>
              {screen === 'download' && (
                <DownloadScreen
                  items={items}
                  url={downloadUrl}
                  onUrlChange={setDownloadUrl}
                  quality={settings.quality}
                  outputDir={settings.outputDir}
                  fetchRealQualities={settings.fetchRealQualities}
                  trimBeforeDownload={settings.trimBeforeDownload}
                  onQualityChange={q => updateSettings({ quality: q })}
                  onAddDownload={handleAddDownload}
                  onCancel={cancelDownload}
                  onRemove={removeItem}
                  onClearCompleted={clearCompleted}
                  onToast={addToast}
                />
              )}
              {screen === 'playlist' && (
                <ErrorBoundary>
                  <PlaylistScreen
                    quality={settings.quality}
                    onQualityChange={q => updateSettings({ quality: q })}
                    onAddDownload={handleAddDownload}
                    onToast={addToast}
                  />
                </ErrorBoundary>
              )}
              {screen === 'settings' && (
                <ErrorBoundary>
                  <SettingsScreen
                    settings={settings}
                    onUpdate={updateSettings}
                    onToast={addToast}
                  />
                </ErrorBoundary>
              )}
              {screen === 'history' && (
                <ErrorBoundary>
                  <HistoryScreen 
                    history={history} 
                    onClearHistory={clearHistory}
                    onDownloadAgain={(url, quality, trimRange) => {
                      addDownload(url, quality, settings.outputDir, trimRange);
                      setScreen('download');
                    }} 
                  />
                </ErrorBoundary>
              )}
              {screen === 'about' && (
                <ErrorBoundary>
                  <AboutScreen />
                </ErrorBoundary>
              )}
            </ErrorBoundary>
          </motion.div>
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </motion.div>
  );
}
