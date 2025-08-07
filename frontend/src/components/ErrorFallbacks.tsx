import React from 'react';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

export const NetworkErrorFallback: React.FC<ErrorFallbackProps> = ({ resetError }) => (
  <div className="error-fallback network-error">
    <div className="error-icon">🌐</div>
    <h3>Network Connection Issue</h3>
    <p>Unable to connect to the server. Please check your internet connection.</p>
    {resetError && (
      <button onClick={resetError} className="error-reset-button">
        Retry Connection
      </button>
    )}
  </div>
);

export const ChunkLoadErrorFallback: React.FC<ErrorFallbackProps> = ({ resetError }) => (
  <div className="error-fallback chunk-error">
    <div className="error-icon">📦</div>
    <h3>Loading Error</h3>
    <p>Failed to load application resources. This might be due to an outdated version.</p>
    <div className="error-actions">
      <button onClick={() => window.location.reload()} className="error-reset-button">
        Refresh Page
      </button>
      {resetError && (
        <button onClick={resetError} className="error-home-button">
          Try Again
        </button>
      )}
    </div>
  </div>
);

export const PermissionErrorFallback: React.FC<ErrorFallbackProps> = ({ resetError }) => (
  <div className="error-fallback permission-error">
    <div className="error-icon">🔒</div>
    <h3>Permission Denied</h3>
    <p>You don't have permission to access this resource.</p>
    <div className="error-actions">
      <button onClick={() => window.location.href = '/'} className="error-home-button">
        Go to Home
      </button>
      {resetError && (
        <button onClick={resetError} className="error-reset-button">
          Try Again
        </button>
      )}
    </div>
  </div>
);

export const DataErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => (
  <div className="error-fallback data-error">
    <div className="error-icon">📊</div>
    <h3>Data Loading Error</h3>
    <p>Failed to load the requested data. Please try again.</p>
    {error?.message && (
      <p className="error-detail">Error: {error.message}</p>
    )}
    {resetError && (
      <button onClick={resetError} className="error-reset-button">
        Reload Data
      </button>
    )}
  </div>
);

export const MinimalErrorFallback: React.FC<ErrorFallbackProps> = ({ resetError }) => (
  <div className="error-fallback minimal-error">
    <p>Something went wrong</p>
    {resetError && (
      <button onClick={resetError} className="error-reset-button-minimal">
        Retry
      </button>
    )}
  </div>
);

export const RouteErrorFallback: React.FC<ErrorFallbackProps> = () => (
  <div className="error-fallback route-error">
    <div className="error-icon">🗺️</div>
    <h3>Page Not Found</h3>
    <p>The page you're looking for doesn't exist or has been moved.</p>
    <div className="error-actions">
      <button onClick={() => window.history.back()} className="error-home-button">
        Go Back
      </button>
      <button onClick={() => window.location.href = '/'} className="error-reset-button">
        Go to Home
      </button>
    </div>
  </div>
);

interface AsyncErrorFallbackProps extends ErrorFallbackProps {
  retry?: () => void;
}

export const AsyncErrorFallback: React.FC<AsyncErrorFallbackProps> = ({ error, retry, resetError }) => (
  <div className="error-fallback async-error">
    <div className="error-icon">⏳</div>
    <h3>Loading Failed</h3>
    <p>The operation timed out or failed to complete.</p>
    {error?.message && (
      <details className="error-details-inline">
        <summary>Details</summary>
        <p>{error.message}</p>
      </details>
    )}
    <div className="error-actions">
      {retry && (
        <button onClick={retry} className="error-reset-button">
          Retry
        </button>
      )}
      {resetError && (
        <button onClick={resetError} className="error-home-button">
          Reset
        </button>
      )}
    </div>
  </div>
);

export const ErrorFallbackSelector: React.FC<{ error: Error; resetError?: () => void }> = ({ 
  error, 
  resetError 
}) => {
  if (error.message.includes('Network') || error.message.includes('fetch')) {
    return <NetworkErrorFallback error={error} resetError={resetError} />;
  }
  
  if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
    return <ChunkLoadErrorFallback error={error} resetError={resetError} />;
  }
  
  if (error.message.includes('Permission') || error.message.includes('Unauthorized')) {
    return <PermissionErrorFallback error={error} resetError={resetError} />;
  }
  
  if (error.message.includes('404') || error.message.includes('Not Found')) {
    return <RouteErrorFallback error={error} resetError={resetError} />;
  }
  
  return <DataErrorFallback error={error} resetError={resetError} />;
};