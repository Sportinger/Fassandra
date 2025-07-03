/**
 * Editor Configuration Constants
 * Centralized configuration for the collaborative editor
 */

// ===== RESPONSIVE BREAKPOINTS =====

export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// ===== DIN A4 CONFIGURATION =====

export const DIN_A4_CONFIG = {
  // Standard DIN A4 dimensions in cm
  width: 21, // cm
  height: 29.7, // cm
  ratio: 1.414, // height/width
  
  // Content padding in cm
  paddingX: 1.5, // cm
  paddingY: 2, // cm
  
  // Print DPI
  dpi: 96,
  
  // CSS units conversion
  widthPx: 794, // 21cm at 96 DPI
  heightPx: 1123, // 29.7cm at 96 DPI
} as const;

// ===== TYPOGRAPHY SCALE =====

export const TYPOGRAPHY = {
  // Base font size and scale
  baseFontSize: 16,
  scaleRatio: 1.25,
  
  // Line height values
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Font weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  // Letter spacing
  letterSpacing: {
    tight: '-0.025em',
    normal: '0em',
    wide: '0.05em',
  },
} as const;

// ===== ANIMATION TIMINGS =====

export const ANIMATIONS = {
  // Transition durations
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
    slow2: 500,
  },
  
  // Easing functions
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

// ===== SPACING SCALE =====

export const SPACING = {
  // Spacing scale in rem
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
  '4xl': '6rem',   // 96px
} as const;

// ===== Z-INDEX SCALE =====

export const Z_INDEX = {
  base: 0,
  elevated: 10,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modal: 400,
  overlay: 500,
  tooltip: 600,
} as const;

// ===== EDITOR SPECIFIC CONSTANTS =====

export const EDITOR_CONFIG = {
  // Collaboration settings
  collaboration: {
    awarenessUpdateInterval: 5000,
    maxReconnectAttempts: 5,
    reconnectDelay: 2000,
    heartbeatInterval: 30000,
  },
  
  // Performance settings
  performance: {
    debounceDelay: 300,
    throttleDelay: 100,
    virtualScrollThreshold: 1000,
  },
  
  // Mobile optimizations
  mobile: {
    touchThreshold: 10,
    swipeThreshold: 50,
    longPressDelay: 500,
  },
  
  // Keyboard shortcuts
  shortcuts: {
    save: 'Ctrl+S',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    bold: 'Ctrl+B',
    italic: 'Ctrl+I',
    underline: 'Ctrl+U',
  },
} as const;

// ===== THEME CONSTANTS =====

export const THEME = {
  // Color palette
  colors: {
    // Gray scale
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    
    // Brand colors
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    
    // Status colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  
  // Border radius
  borderRadius: {
    none: '0px',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  },
} as const; 