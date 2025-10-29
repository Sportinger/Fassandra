import React from 'react';
import './SavingIndicator.css';

export type SavingStatus = 'saved' | 'saving' | 'error';

interface SavingIndicatorProps {
  status: SavingStatus;
  lastSaved?: Date | null;
}

export const SavingIndicator: React.FC<SavingIndicatorProps> = ({ status, lastSaved }) => {
  const getStatusText = () => {
    switch (status) {
      case 'saving':
        return 'Saving...';
      case 'error':
        return 'Error saving';
      case 'saved':
        if (lastSaved) {
          const now = Date.now();
          const diff = now - lastSaved.getTime();
          if (diff < 60000) return 'Saved';
          if (diff < 3600000) return `Saved ${Math.floor(diff / 60000)}m ago`;
          return 'Saved';
        }
        return 'All changes saved';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'saving':
        return (
          <svg className="saving-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="30 10" />
          </svg>
        );
      case 'error':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 10a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm1-8H7v6h2V3z"/>
          </svg>
        );
      case 'saved':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.854 4.146a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7 11.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        );
    }
  };

  return (
    <div className={`saving-indicator saving-indicator--${status}`}>
      {getIcon()}
      <span className="saving-indicator__text">{getStatusText()}</span>
    </div>
  );
};
