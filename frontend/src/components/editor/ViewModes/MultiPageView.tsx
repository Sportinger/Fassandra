import React from 'react';
import { Ruler } from '../Ruler';
import '../styles/responsive.css';

interface MultiPageViewProps {
  children: React.ReactNode;
  showRuler: boolean;
  className?: string;
}

export const MultiPageView: React.FC<MultiPageViewProps> = ({ 
  children, 
  showRuler,
  className = ''
}) => {
  console.log('[MultiPageView] Rendering with showRuler:', showRuler);
  
  return (
    <div className={`multi-page-view ${className}`}>
      {showRuler && <Ruler />}
      <div className="multiplePagesContainer">
        {/* Primary page - contains the main editor content */}
        <div className="dinA4Page multiplePage">
          {children}
        </div>
        
        {/* Future pages could be added here dynamically */}
        {/* For now, we'll show a placeholder for demonstration */}
        <div className="dinA4Page multiplePage" style={{ minHeight: '200px', opacity: 0.3 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            Page 2 (Future content overflow will appear here)
          </div>
        </div>
      </div>
    </div>
  );
}; 