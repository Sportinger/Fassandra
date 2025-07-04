import React from 'react';

interface RulerProps {
  className?: string;
}

export const Ruler: React.FC<RulerProps> = ({ className = '' }) => {
  console.log('[Ruler] Component rendered!');
  
  // Generate ruler marks for a 30cm vertical ruler (DIN A4 height)
  const generateMarks = () => {
    const marks = [];
    // Create marks every 0.5cm for 30cm
    for (let i = 0; i <= 60; i++) {
      const cmValue = i * 0.5;
      const isFullCm = i % 2 === 0;
      const isFiveCm = cmValue % 5 === 0 && cmValue > 0;
      
      marks.push(
        <div
          key={i}
          className="ruler-mark"
          style={{
            position: 'absolute',
            top: `${cmValue}cm`,
            right: '0',
            width: isFiveCm ? '12px' : isFullCm ? '8px' : '4px',
            height: '1px',
            backgroundColor: '#000',
            transformOrigin: 'right center',
          }}
        >
          {isFiveCm && (
            <span 
              className="ruler-label"
              style={{
                position: 'absolute',
                right: '14px',
                top: '-6px',
                fontSize: '10px',
                fontWeight: '500',
                color: '#000',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              {cmValue}
            </span>
          )}
        </div>
      );
    }
    console.log('[Ruler] Generated', marks.length, 'marks');
    return marks;
  };

  return (
    <div 
      className={`ruler-container ${className}`}
      style={{
        position: 'fixed',
        left: '0',
        top: '60px', // Fixed value instead of CSS variable for debugging
        width: '30px', // Made wider for better visibility
        height: 'calc(100vh - 60px)',
        background: 'rgba(255, 0, 0, 0.1)', // Red background for debugging
        pointerEvents: 'none',
        zIndex: '9998', // Very high z-index
        overflow: 'visible',
        border: '1px solid red', // Debug border
      }}
    >
      <div 
        className="ruler-vertical"
        style={{
          position: 'relative',
          width: '100%',
          height: '30cm', // DIN A4 height
          background: 'rgba(0, 255, 0, 0.1)', // Green background for debugging
        }}
      >
        {generateMarks()}
      </div>
    </div>
  );
}; 