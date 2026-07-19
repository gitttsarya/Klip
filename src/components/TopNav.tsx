import { motion } from 'framer-motion';
import { Settings, Info, History, Download, ListVideo } from 'lucide-react';

export type Screen = 'download' | 'playlist' | 'settings' | 'about' | 'history';

interface TopNavProps {
  active: Screen;
  onChange: (s: Screen) => void;
  showHistory?: boolean;
}

export function TopNav({ active, onChange, showHistory }: TopNavProps) {
  const NAV_ITEMS = [
    { id: 'download', label: 'Download', Icon: Download },
    { id: 'playlist', label: 'Playlist', Icon: ListVideo },
    ...(showHistory ? [{ id: 'history', label: 'History', Icon: History }] : []),
    { id: 'settings', label: 'Settings',  Icon: Settings },
    { id: 'about',    label: 'About',     Icon: Info },
  ] as const;

  return (
    <header className="top-nav">

      {/* Nav — absolutely centered in the bar */}
      <nav
        className="top-nav-menu"
        aria-label="Main navigation"
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`nav-${id}`}
            className={`topnav-item ${active === id ? 'active' : ''}`}
            onClick={() => onChange(id as Screen)}
          >
            {active === id && (
              <motion.div
                className="topnav-pill"
                layoutId="topnav-active-pill"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <Icon size={14} className="topnav-icon" />
            <span className="topnav-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* Right spacer to keep centering balanced */}
      <div style={{ flexShrink: 0, width: 80 }} />
    </header>
  );
}
