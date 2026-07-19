import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{ 
              background: 'var(--bg-surface)', 
              padding: 32, 
              borderRadius: 16, 
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              maxWidth: 400
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 32, background: 'rgba(255, 92, 122, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <AlertTriangle size={32} color="#FF5C7A" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Screen crashed
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.5 }}>
              A rendering error occurred in this view. Switching to another tab might clear the issue.
            </p>
            
            <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 8, width: '100%', marginBottom: 24, overflowX: 'auto' }}>
              <code style={{ fontSize: 11, color: '#FF5C7A', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.error?.message || 'Unknown error'}
              </code>
            </div>

            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8,
                background: 'var(--text-primary)', color: 'var(--bg-base)',
                border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
