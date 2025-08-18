import React from 'react';

interface AccelerometerDebugProps {
  debug: {
    isMobile: boolean;
    isSupported: boolean;
    permissionGranted: boolean;
    hasData: boolean;
    orientation: {
      alpha: number | null;
      beta: number | null;
      gamma: number | null;
    };
    message: string;
  };
}

export const AccelerometerDebug: React.FC<AccelerometerDebugProps> = ({ debug }) => {
  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      left: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 10000,
      maxWidth: '300px',
    }}>
      <div>📱 Mobile: {debug.isMobile ? '✅' : '❌'}</div>
      <div>🎯 Supported: {debug.isSupported ? '✅' : '❌'}</div>
      <div>🔐 Permission: {debug.permissionGranted ? '✅' : '❌'}</div>
      <div>📊 Has Data: {debug.hasData ? '✅' : '❌'}</div>
      <div>📍 Status: {debug.message}</div>
      {debug.orientation.beta !== null && (
        <>
          <div>α: {debug.orientation.alpha?.toFixed(1)}°</div>
          <div>β: {debug.orientation.beta?.toFixed(1)}°</div>
          <div>γ: {debug.orientation.gamma?.toFixed(1)}°</div>
        </>
      )}
      <div style={{ marginTop: '5px', fontSize: '10px' }}>
        Tilt your phone to see the effect!
      </div>
    </div>
  );
};