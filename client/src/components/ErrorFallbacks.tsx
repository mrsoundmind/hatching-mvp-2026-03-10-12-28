import React from 'react';

export function PanelErrorFallback({ error, resetErrorBoundary }: { error: any, resetErrorBoundary: () => void }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center hatchin-bg-panel rounded-2xl m-2 border border-red-500/20">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>
            <h3 className="text-lg font-semibold text-red-400 mb-2">Something went wrong</h3>
            <p className="text-sm hatchin-text-muted max-w-sm mb-6">
                {error.message || 'An unexpected error occurred in this panel.'}
            </p>
            <button
                onClick={resetErrorBoundary}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
            >
                Try again
            </button>
        </div>
    );
}
