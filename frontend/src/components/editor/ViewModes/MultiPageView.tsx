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
  return (
    <div className={`multi-page-view ${className}`}>
      {showRuler && <Ruler />}
      <div className="multiplePagesContainer">
        <div className="dinA4Page multiplePage">
          {children}
        </div>
        {/* Could add more pages here in the future */}
      </div>
    </div>
  );
}; 