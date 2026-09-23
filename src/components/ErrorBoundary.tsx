import { Component, type ReactNode } from 'react';
import { exportBackup } from '../lib/backup';

/**
 * If a screen crashes, show a calm message instead of a blank page, with a
 * way to save a backup (your data is still safe in the database) and reload.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen">
        <h1>Something went wrong</h1>
        <p>This screen hit an error. Your data is still saved on the phone.</p>
        <p className="muted small">{this.state.error.message}</p>
        <button className="btn block" onClick={() => { location.hash = '#/'; location.reload(); }}>Reload app</button>
        <button className="btn block ghost" onClick={() => exportBackup()}>Export a backup</button>
      </div>
    );
  }
}
