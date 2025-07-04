/**
 * PageCanvas Component
 * Responsive DIN A4 page container with ruler support
 */

import React from 'react';
import { Ruler } from '../../Ruler';
import type { PageCanvasProps } from '../../types/index';

export const PageCanvas: React.FC<PageCanvasProps> = ({ 
  children, 
  showRuler = false, 
  className = '' 
}) => {
  console.log('[PageCanvas] Received showRuler:', showRuler);

  // Side effect for logging when ruler should render
  if (showRuler) {
    console.log('[PageCanvas] Rendering Ruler component');
  }

  return (
    <div className={`pageCanvas ${showRuler ? 'withRuler' : ''} ${className}`}>
      {showRuler && <Ruler />}
      {children}
    </div>
  );
}; 