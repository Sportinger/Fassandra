import React from 'react';
import './LoadingStates.css';

/**
 * Spinner Loading Component
 * Simple circular spinner for quick loading states
 */
export const Spinner: React.FC<{ 
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}> = ({ size = 'medium', color, className = '' }) => {
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large'
  };

  return (
    <div className={`spinner ${sizeClasses[size]} ${className}`}>
      <div 
        className="spinner-circle" 
        style={color ? { borderTopColor: color } : undefined}
      />
    </div>
  );
};

/**
 * Loading Overlay Component
 * Full-screen or container overlay with loading indicator
 */
export const LoadingOverlay: React.FC<{
  message?: string;
  fullScreen?: boolean;
  transparent?: boolean;
  children?: React.ReactNode;
}> = ({ message = 'Loading...', fullScreen = false, transparent = false, children }) => {
  return (
    <div className={`loading-overlay ${fullScreen ? 'loading-overlay-fullscreen' : ''} ${transparent ? 'loading-overlay-transparent' : ''}`}>
      <div className="loading-overlay-content">
        {children || <Spinner size="large" />}
        {message && <p className="loading-message">{message}</p>}
      </div>
    </div>
  );
};

/**
 * Progress Bar Component
 * Shows determinate or indeterminate progress
 */
export const ProgressBar: React.FC<{
  progress?: number; // 0-100, undefined for indeterminate
  label?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'error';
  className?: string;
}> = ({ progress, label, showPercentage = true, color = 'primary', className = '' }) => {
  const isIndeterminate = progress === undefined;
  
  return (
    <div className={`progress-container ${className}`}>
      {label && <label className="progress-label">{label}</label>}
      <div className={`progress-bar progress-bar-${color}`}>
        <div 
          className={`progress-fill ${isIndeterminate ? 'progress-indeterminate' : ''}`}
          style={!isIndeterminate ? { width: `${Math.min(100, Math.max(0, progress))}%` } : undefined}
        />
      </div>
      {showPercentage && !isIndeterminate && (
        <span className="progress-percentage">{Math.round(progress || 0)}%</span>
      )}
    </div>
  );
};

/**
 * Skeleton Loader Component
 * Placeholder for content while loading
 */
export const Skeleton: React.FC<{
  variant?: 'text' | 'rect' | 'circle' | 'button';
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
  animate?: boolean;
}> = ({ 
  variant = 'text', 
  width, 
  height, 
  count = 1, 
  className = '', 
  animate = true 
}) => {
  const variantClasses = {
    text: 'skeleton-text',
    rect: 'skeleton-rect',
    circle: 'skeleton-circle',
    button: 'skeleton-button'
  };

  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`skeleton ${variantClasses[variant]} ${animate ? 'skeleton-animate' : ''} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height
      }}
    />
  ));

  return count > 1 ? <div className="skeleton-group">{skeletons}</div> : skeletons[0];
};

/**
 * Card Skeleton Component
 * Pre-built skeleton for card layouts
 */
export const CardSkeleton: React.FC<{
  showImage?: boolean;
  lines?: number;
  className?: string;
}> = ({ showImage = true, lines = 3, className = '' }) => {
  return (
    <div className={`card-skeleton ${className}`}>
      {showImage && <Skeleton variant="rect" height={200} />}
      <div className="card-skeleton-content">
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" count={lines} />
        <div className="card-skeleton-footer">
          <Skeleton variant="button" width={80} height={32} />
          <Skeleton variant="button" width={80} height={32} />
        </div>
      </div>
    </div>
  );
};

/**
 * List Skeleton Component
 * Pre-built skeleton for list layouts
 */
export const ListSkeleton: React.FC<{
  rows?: number;
  showAvatar?: boolean;
  className?: string;
}> = ({ rows = 5, showAvatar = false, className = '' }) => {
  return (
    <div className={`list-skeleton ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="list-skeleton-item">
          {showAvatar && <Skeleton variant="circle" width={40} height={40} />}
          <div className="list-skeleton-content">
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="text" width="80%" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Loading Button Component
 * Button with integrated loading state
 */
export const LoadingButton: React.FC<{
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}> = ({ 
  loading = false, 
  disabled = false, 
  onClick, 
  children, 
  variant = 'primary',
  className = '' 
}) => {
  return (
    <button
      className={`loading-button loading-button-${variant} ${loading ? 'loading-button-loading' : ''} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && <Spinner size="small" />}
      <span className={loading ? 'loading-button-text-hidden' : ''}>
        {children}
      </span>
    </button>
  );
};

/**
 * Async Component Wrapper
 * Wraps components that load data asynchronously
 */
export const AsyncWrapper: React.FC<{
  loading: boolean;
  error?: Error | null;
  onRetry?: () => void;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  children: React.ReactNode;
  minLoadTime?: number; // Minimum time to show loading state
}> = ({ 
  loading, 
  error, 
  onRetry, 
  loadingComponent, 
  errorComponent,
  children,
  minLoadTime = 0
}) => {
  const [showLoading, setShowLoading] = React.useState(loading);
  
  React.useEffect(() => {
    if (loading) {
      setShowLoading(true);
    } else if (minLoadTime > 0) {
      const timer = setTimeout(() => setShowLoading(false), minLoadTime);
      return () => clearTimeout(timer);
    } else {
      setShowLoading(false);
    }
  }, [loading, minLoadTime]);

  if (showLoading) {
    return <>{loadingComponent || <Spinner />}</>;
  }

  if (error) {
    return (
      <>
        {errorComponent || (
          <div className="async-error">
            <p>Error: {error.message}</p>
            {onRetry && (
              <button onClick={onRetry} className="retry-button">
                Retry
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
};

/**
 * Lazy Load Wrapper
 * For lazy-loaded components with loading state
 */
export const LazyLoadWrapper: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ children, fallback }) => {
  return (
    <React.Suspense fallback={fallback || <Spinner />}>
      {children}
    </React.Suspense>
  );
};