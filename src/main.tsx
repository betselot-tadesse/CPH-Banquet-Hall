import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent harmless Vite HMR WebSocket connection messages in sandboxed iframe from bubbling
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason?.message || String(reason || '');
  const stack = reason?.stack || '';
  if (
    msg.includes('WebSocket') ||
    stack.includes('@vite/client') ||
    stack.includes('createWebSocketModuleRunnerTransport')
  ) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  const file = event.filename || '';
  const stack = event.error?.stack || '';
  if (
    msg.includes('WebSocket') ||
    file.includes('@vite/client') ||
    stack.includes('createWebSocketModuleRunnerTransport')
  ) {
    event.preventDefault();
  }
});

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#CFE5DC] flex items-center justify-center p-6 text-center font-['Plus_Jakarta_Sans']">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-[#C2D8CE] space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto text-xl font-black">
              ⚠️
            </div>
            <h2 className="text-lg font-extrabold text-[#192A24]">Notice</h2>
            <p className="text-xs text-[#5A6F66]">
              A temporary display error occurred. Please refresh or restore session.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-2.5 rounded-xl bg-[#236B50] hover:bg-[#1C5740] text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
