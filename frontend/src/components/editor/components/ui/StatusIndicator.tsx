/**
 * StatusIndicator Component
 * Shows connection and status information
 */

import React from 'react';
import type { ConnectionStatus } from '../../types';

interface StatusIndicatorProps {
  status: ConnectionStatus;
  message?: string;
  className?: string;
  activeUserCount?: number;
  isMobile?: boolean;
  mode?: 'banner' | 'sphere'; // Add mode option
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  status, 
  message, 
  className = '',
  activeUserCount = 0,
  isMobile = false,
  mode = 'banner'
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

  // 🎭 THEATER PRIORITY: Enhanced status messages for theater professionals
  const getStatusText = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return activeUserCount > 0 
          ? `🎭 Rehearsal Active (${activeUserCount + 1} ${activeUserCount === 0 ? 'person' : 'people'})`
          : '🎭 Ready for Collaboration';
      case 'connecting':
        return isMobile ? '🎭 Mobile: Connecting to rehearsal...' : '🎭 Connecting to rehearsal...';
      case 'syncing':
        return '🎭 Syncing script changes...';
      case 'disconnected':
        return isMobile ? '🎭 Mobile: Working offline' : '🎭 Working offline';
      case 'error':
        return isMobile ? '🎭 Mobile: Connection issue' : '🎭 Connection issue';
      default:
        return '🎭 Theater collaboration platform';
    }
  };

  // 🎭 ENHANCED: Dynamic positioning for mobile vs desktop
  const getIndicatorStyle = () => {
    const baseStyle = {
      background: getStatusColor(status),
      color: 'white',
      padding: isMobile ? '6px 12px' : '8px 16px',
      borderRadius: '6px',
      fontSize: isMobile ? '12px' : '14px',
      fontWeight: '500' as const,
      zIndex: 1000,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      backdropFilter: 'blur(8px)',
      transition: 'all 0.3s ease',
      // 🎭 THEATER STYLING: Better visual hierarchy
      border: status === 'connected' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
    };

    if (isMobile) {
      return {
        ...baseStyle,
        position: 'fixed' as const,
        top: '10px',
        left: '10px',
        right: '10px',
        textAlign: 'center' as const,
        transform: 'none',
      };
    } else {
      return {
        ...baseStyle,
        position: 'fixed' as const,
        top: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }
  };

  // 🎭 ENHANCED: Pulse animation for active collaboration
  const shouldPulse = status === 'connected' && activeUserCount > 0;

  // Sphere mode - compact indicator for header
  if (mode === 'sphere') {
    return (
      <div 
        className={`status-sphere ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(status),
          position: 'relative',
          cursor: 'help',
          transition: 'all 0.3s ease',
          boxShadow: status === 'disconnected' || status === 'error' 
            ? '0 0 12px rgba(239, 68, 68, 0.6)' 
            : status === 'connecting' || status === 'syncing'
            ? '0 0 8px rgba(245, 158, 11, 0.5)'
            : '0 2px 4px rgba(0, 0, 0, 0.1)',
          animation: status === 'disconnected' || status === 'error' 
            ? 'pulseError 2s infinite' 
            : status === 'connecting' || status === 'syncing'
            ? 'pulseWarning 1.5s infinite'
            : shouldPulse ? 'pulseCollaboration 3s infinite' : 'none',
          opacity: status === 'connected' && activeUserCount === 0 ? 0.7 : 1,
        }}
        title={getStatusText(status)}
      >
        {/* Inner dot for visual interest */}
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: 'white',
          opacity: 0.9,
        }} />
        
        {/* Active user count badge */}
        {status === 'connected' && activeUserCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#10b981',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
          }}>
            {activeUserCount}
          </span>
        )}
      </div>
    );
  }

  // Original banner mode
  return (
    <div 
      className={`status-indicator ${className} ${shouldPulse ? 'pulse-animation' : ''}`}
      style={getIndicatorStyle()}
    >
      <span className="status-dot" style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: 'currentColor',
        marginRight: '8px',
        // 🎭 ENHANCED: Animated dot for active sessions
        animation: shouldPulse ? 'pulseGlow 2s infinite' : 'none',
      }} />
      {message || getStatusText(status)}
      
      {/* 🎭 THEATER FEATURE: Show active collaborators count */}
      {status === 'connected' && activeUserCount > 0 && (
        <span style={{
          marginLeft: '8px',
          fontSize: isMobile ? '10px' : '12px',
          opacity: 0.9,
          background: 'rgba(255, 255, 255, 0.2)',
          padding: '2px 6px',
          borderRadius: '10px',
        }}>
          +{activeUserCount}
        </span>
      )}
      

    </div>
  );
}; 