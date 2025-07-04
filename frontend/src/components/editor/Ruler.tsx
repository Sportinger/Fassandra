import React from 'react';
import './styles/responsive.css';

interface RulerProps {
  className?: string;
}

export const Ruler: React.FC<RulerProps> = ({ className = '' }) => {
  return (
    <div className={`ruler ${className}`}>
      <div className="ruler-horizontal">
        {/* Horizontal ruler markings */}
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="ruler-mark"
            style={{
              left: `${i * 1}cm`,
              height: i % 5 === 0 ? '8px' : '4px',
            }}
          >
            {i % 5 === 0 && (
              <span className="ruler-label">{i}</span>
            )}
          </div>
        ))}
      </div>
      
      <div className="ruler-vertical">
        {/* Vertical ruler markings */}
        {Array.from({ length: 30 }, (_, i) => (
          <div
            key={i}
            className="ruler-mark"
            style={{
              top: `${i * 1}cm`,
              width: i % 5 === 0 ? '8px' : '4px',
            }}
          >
            {i % 5 === 0 && (
              <span className="ruler-label">{i}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}; 