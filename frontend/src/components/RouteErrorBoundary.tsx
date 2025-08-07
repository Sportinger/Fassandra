import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { RouteErrorFallback } from './ErrorFallbacks';
import logger from '../services/LoggingService';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  routeName: string;
}

const RouteErrorBoundary: React.FC<RouteErrorBoundaryProps> = ({ children, routeName }) => {
  const handleRouteError = (error: Error, errorInfo: React.ErrorInfo) => {
    logger.error('RouteErrorBoundary', `Error in route: ${routeName}`, {
      route: routeName,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  };

  return (
    <ErrorBoundary
      level="page"
      onError={handleRouteError}
      fallback={<RouteErrorFallback error={new Error(`Failed to load ${routeName}`)} />}
      resetOnPropsChange={true}
      showDetails={import.meta.env.DEV}
    >
      {children}
    </ErrorBoundary>
  );
};

export default RouteErrorBoundary;