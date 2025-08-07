/**
 * Shared Component Library
 * 
 * Centralized export for all reusable components
 * Following composition over inheritance pattern
 */

// Loading Components
export { Spinner, LoadingOverlay, ProgressBar, LoadingButton } from '../LoadingStates';

// Error Components  
export { default as ErrorBoundary } from '../ErrorBoundary';
export { default as RouteErrorBoundary } from '../RouteErrorBoundary';
export * from '../ErrorFallbacks';

// UI Components
export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Card } from './Card';
export type { CardProps, CardHeaderProps, CardBodyProps, CardFooterProps } from './Card';

// Form Components (to be added)
// export * from './forms';

// Layout Components (to be added)  
// export * from './layout';