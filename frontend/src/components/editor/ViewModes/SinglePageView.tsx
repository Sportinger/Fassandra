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
  return (
    <div className={`single-page-view ${className}`}>
      {showRuler && <Ruler />}
      <div className="dinA4Page">
        {children}
      </div>
    </div>
  );
}; 