/**
 * App.tsx — Root React component; hash-based window-type routing.
 *
 * Main exports:
 *   - App (default export): React.ReactElement
 *
 * Execution flow:
 *   1. Read window.location.hash (stripped of '#')
 *   2. hash === 'floating' → render <FloatingWidget>
 *      anything else        → render <SettingsWindow>
 *   3. Wrap in ErrorBoundary to catch and display render errors without crashing
 *
 * Design notes:
 *   - Both BrowserWindow instances load the same index.html; the hash determines
 *     which UI surface to render, avoiding a second HTML entry point
 *   - ErrorBoundary renders a readable monospace error dump in the window on failure
 */
import React from 'react';
import { FloatingWidget } from './components/FloatingWidget';
import { SettingsWindow } from './components/SettingsWindow';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', color: '#f87171', background: '#1a0a0a', minHeight: '100vh' }}>
          <h2>⚠ Render Error</h2>
          <pre style={{ marginTop: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <pre style={{ marginTop: 8, fontSize: 11, color: '#fca5a5' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App(): React.ReactElement {
  const hash = window.location.hash.replace('#', '');
  return (
    <ErrorBoundary>
      {hash === 'floating' ? <FloatingWidget /> : <SettingsWindow />}
    </ErrorBoundary>
  );
}
