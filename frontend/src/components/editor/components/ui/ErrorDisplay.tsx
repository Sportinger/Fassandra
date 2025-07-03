/**
 * ErrorDisplay Component
 * Simple error display with retry functionality
 */

import React from 'react';

interface ErrorDisplayProps {
  error?: Error | string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
  error, 
  onRetry, 
  className = '' 
}) => {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'An unexpected error occurred';

  return (
    <div className={`editorError ${className}`}>
      <h3>Something went wrong</h3>
      <p>{errorMessage}</p>
      {onRetry && (
        <button onClick={onRetry} className="retry-button">
          Try Again
        </button>
      )}
    </div>
  );
}; 