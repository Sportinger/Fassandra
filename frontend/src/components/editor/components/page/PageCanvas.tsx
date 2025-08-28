import React from 'react';
import type { PageCanvasProps } from '../../types/index';

import logger from '../../../../services/LoggingService';
/**
 * PageCanvas Component
 * Responsive DIN A4 page container with ruler support
 */

export const PageCanvas: React.FC<PageCanvasProps> = ({ 
  children, 
  showRuler = false, 
  className = '' 
}) => {
  logger.debug('PageCanvas', '[PageCanvas] showRuler (no-op):', showRuler);
  return (
    <div className={`pageCanvas ${className}`}>
      {children}
    </div>
  );
}; 
