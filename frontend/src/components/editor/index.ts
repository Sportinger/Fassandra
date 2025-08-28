// Main Editor component - NEW REFACTORED VERSION
export { Editor } from './components/Editor';

// Sub-components that are still used
export { FontSizeDropdown } from './FontSizeDropdown';
export { SpeakerDropdown } from './SpeakerDropdown';
export { ViewModeDropdown } from './ViewModeDropdown';
export * from './icons';
export { PrinterIcon, LayoutPanelTopIcon } from './icons';
export { SinglePageView } from './ViewModes';

// New architecture components
export { Toolbar } from './components/toolbar/Toolbar';
export { PageCanvas } from './components/page/PageCanvas';
export { LoadingSpinner } from './components/ui/LoadingSpinner';
export { StatusIndicator } from './components/ui/StatusIndicator';

// Types
export type * from './types';

// Utilities
export * from './utils/formatters';
export * from './utils/contentConverters';

// Extensions
export * from './extensions'; 
