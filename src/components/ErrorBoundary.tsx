/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
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

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Outpost Z ErrorBoundary caught an unhandled exception:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950 text-white font-chakra p-6 select-none">
          <div className="max-w-md w-full bg-zinc-900 border-2 border-red-700/80 rounded-sm shadow-2xl p-6 relative overflow-hidden">
            {/* Red hazard stripes at top */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

            <div className="flex items-center space-x-3 mb-4">
              <span className="w-4 h-4 rounded-full bg-red-600 animate-pulse inline-block" />
              <h2 className="text-xl font-bold uppercase tracking-wider text-red-400">
                {this.props.fallbackTitle || 'Tactical Simulation Alert'}
              </h2>
            </div>

            <p className="text-sm text-zinc-300 font-mono mb-4 leading-relaxed">
              The 3D tactical renderer encountered an unexpected exception. Simulation state has been safely contained.
            </p>

            {this.state.error && (
              <div className="bg-black/60 border border-zinc-800 rounded p-3 mb-5 max-h-32 overflow-y-auto font-mono text-xs text-red-300/90 break-words">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-700 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white font-bold tracking-widest uppercase transition-all duration-150 rounded-sm shadow-lg active:scale-98 cursor-pointer"
            >
              Reboot Tactical Systems
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
