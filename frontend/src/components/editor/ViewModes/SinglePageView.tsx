import React from 'react';
import { Ruler } from '../Ruler';
import '../styles/responsive.css';

interface SinglePageViewProps {
  children: React.ReactNode;
  showRuler: boolean;
  className?: string;
}

export const SinglePageView: React.FC<SinglePageViewProps> = ({ 
  children, 
  showRuler,
  className = ''
}) => {
  console.log('[SinglePageView] Received showRuler:', showRuler);
  
  // Side effect for logging when ruler should render
  if (showRuler) {
    console.log('[SinglePageView] Rendering Ruler component');
  }
  
  return (
    <div className={`single-page-view ${className}`}>
      {showRuler && <Ruler />}
      <div className="dinA4Page">
        {children}
      </div>
    </div>
  );
}; 