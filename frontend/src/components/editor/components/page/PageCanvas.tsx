/**
 * PageCanvas Component
 * Responsive DIN A4 page container with ruler support
 */

import React from 'react';
import type { PageCanvasProps } from '../../types/index';

export const PageCanvas: React.FC<PageCanvasProps> = ({ 
  children, 
  showRuler = false, 
  className = '' 
}) => {
  return (
    <div className={`pageCanvas ${showRuler ? 'withRuler' : ''} ${className}`}>
      {children}
    </div>
  );
}; 