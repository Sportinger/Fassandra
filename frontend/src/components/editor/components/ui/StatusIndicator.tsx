/**
 * StatusIndicator Component
 * Shows connection and status information
 */

import React from 'react';
import type { ConnectionStatus } from '../../types/index';

interface StatusIndicatorProps {
  status: ConnectionStatus;
  message?: string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  status, 
  message, 
  className = '' 
}) => {
  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return '#10b981'; // Green
      case 'connecting':
      case 'syncing':
        return '#f59e0b'; // Amber
      case 'disconnected':
      case 'error':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const getStatusText = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'syncing':
        return 'Syncing...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div 
      className={`status-indicator ${className}`}
      style={{
        position: 'fixed',
        top: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: getStatusColor(status),
        color: 'white',
        padding: '8px 16px',
        borderRadius: '4px',
        fontSize: '14px',
        zIndex: 1000,
      }}
    >
      <span className="status-dot" style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: 'currentColor',
        marginRight: '8px',
      }} />
      {message || getStatusText(status)}
    </div>
  );
}; 