import React from 'react';
import { useUploadState } from '../../hooks/useUploadState';

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
  maxWidth: 360,
  zIndex: 1000,
  background: 'rgba(20,20,20,0.92)',
  color: '#fff',
  borderRadius: 8,
  boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
  padding: 12,
  backdropFilter: 'blur(6px)'
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
};

const barStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: 6,
  borderRadius: 4,
  background: 'rgba(255,255,255,0.15)'
};

const fillBase: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  borderRadius: 4,
  background: 'linear-gradient(90deg,#62d0ff,#7cffc1)'
};

export const UploadOverlay: React.FC = () => {
  const { activeUploads } = useUploadState();

  const visibleUploads = activeUploads.filter(u => u.uploadStatus && u.uploadStatus !== 'completed');
  if (visibleUploads.length === 0) return null;

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Uploads in progress</div>
      {visibleUploads.map((u) => (
        <div key={u.id} style={itemStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.title}</div>
            <div style={barStyle}>
              <div style={{ ...fillBase, width: `${Math.max(0, Math.min(100, u.uploadProgress || 0))}%` }} />
            </div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
              {u.uploadSubStage || 'Processing...'}
            </div>
            {u.lastOutput && (
              <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {u.lastOutput}
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, minWidth: 36, textAlign: 'right' }}>{Math.round(u.uploadProgress || 0)}%</div>
        </div>
      ))}
    </div>
  );
};

export default UploadOverlay;
