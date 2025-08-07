import React, { Component, ErrorInfo, ReactNode } from 'react';
import logger from '../services/LoggingService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props;
    
    // Use enhanced error boundary logging
    logger.logErrorBoundary(
      `${level}-boundary`,
      error,
      { componentStack: errorInfo.componentStack || '' },
      {
        level,
        errorCount: this.state.errorCount + 1,
        isolate: this.props.isolate,
        hasCustomFallback: !!this.props.fallback
      }
    );

    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    if (onError) {
      onError(error, errorInfo);
    }

    if (this.state.errorCount >= 3) {
      logger.error('ErrorBoundary', 'Multiple errors detected, possible error loop', {
        errorCount: this.state.errorCount,
        level
      });
    }

    if (this.props.isolate && this.state.errorCount < 3) {
      this.scheduleReset(5000);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    
    if (hasError) {
      if (resetOnPropsChange && prevProps.children !== this.props.children) {
        this.resetErrorBoundary();
      }
      
      if (resetKeys && this.hasResetKeysChanged(resetKeys)) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  hasResetKeysChanged = (resetKeys: Array<string | number>): boolean => {
    if (resetKeys.length !== this.previousResetKeys.length) {
      this.previousResetKeys = resetKeys;
      return true;
    }
    
    for (let i = 0; i < resetKeys.length; i++) {
      if (resetKeys[i] !== this.previousResetKeys[i]) {
        this.previousResetKeys = resetKeys;
        return true;
      }
    }
    
    return false;
  };

  scheduleReset = (delay: number) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    
    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  };

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    });
    
    logger.info('ErrorBoundary', 'Error boundary reset');
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { fallback, children, showDetails, level = 'component' } = this.props;

    if (hasError && error) {
      if (fallback) {
        return <>{fallback}</>;
      }

      return (
        <div className={`error-boundary-fallback error-boundary-${level}`}>
          <div className="error-container">
            <h2 className="error-title">
              {level === 'page' ? '⚠️ Page Error' : 
               level === 'section' ? '⚠️ Section Error' : 
               '⚠️ Component Error'}
            </h2>
            
            <p className="error-message">
              {level === 'page' 
                ? 'This page has encountered an error and cannot be displayed.'
                : level === 'section'
                ? 'This section has encountered an error.'
                : 'A component has encountered an error.'}
            </p>

            {showDetails && (
              <details className="error-details">
                <summary>Error Details</summary>
                <div className="error-details-content">
                  <p><strong>Error:</strong> {error.message}</p>
                  {errorInfo && (
                    <pre className="error-stack">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="error-actions">
              <button 
                onClick={this.resetErrorBoundary}
                className="error-reset-button"
              >
                Try Again
              </button>
              
              {level === 'page' && (
                <button 
                  onClick={() => window.location.href = '/'}
                  className="error-home-button"
                >
                  Go to Home
                </button>
              )}
            </div>

            {this.state.errorCount > 1 && (
              <p className="error-count-warning">
                This error has occurred {this.state.errorCount} times.
              </p>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;