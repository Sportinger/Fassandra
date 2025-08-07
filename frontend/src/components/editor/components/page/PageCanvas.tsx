import React from 'react';
import { Ruler } from '../../Ruler';
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
  logger.debug('PageCanvas', '[PageCanvas] Received showRuler:', showRuler);

  // Side effect for logging when ruler should render
  if (showRuler) {
    logger.debug('PageCanvas', '[PageCanvas] Rendering Ruler component');
  }

  return (
    <div className={`pageCanvas ${showRuler ? 'withRuler' : ''} ${className}`}>
      {showRuler && <Ruler />}
      {children}
    </div>
  );
}; 