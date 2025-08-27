import React from 'react';

// Search Icon SVG
export const SearchIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = ''
}) => {
  try {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: 'block',
          backgroundColor: 'transparent'
        }}
        className={className}
      >
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    );
  } catch (error) {
    console.error('SearchIcon render error:', error);
    return <span>🔍</span>;
  }
};

// Clapperboard Icon SVG
export const ClapperboardIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = ''
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-clapperboard-icon lucide-clapperboard ${className}`}
  >
    <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/>
    <path d="m6.2 5.3 3.1 3.9"/>
    <path d="m12.4 3.4 3.1 4"/>
    <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
  </svg>
);

// Goal Icon SVG
export const GoalIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = ''
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-goal-icon lucide-goal ${className}`}
  >
    <path d="M12 13V2l8 4-8 4"/>
    <path d="M20.561 10.222a9 9 0 1 1-12.55-5.29"/>
    <path d="M8.002 9.997a5 5 0 1 0 8.9 2.02"/>
  </svg>
);

// Drama Icon SVG
export const DramaIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = ''
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-drama-icon lucide-drama ${className}`}
  >
    <path d="M10 11h.01"/>
    <path d="M14 6h.01"/>
    <path d="M18 6h.01"/>
    <path d="M6.5 13.1h.01"/>
    <path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3"/>
    <path d="M17.4 9.9c-.8.8-2 .8-2.8 0"/>
    <path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7"/>
    <path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4"/>
  </svg>
);

// Message Square Quote Icon SVG
export const MessageSquareQuoteIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = ''
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-message-square-quote-icon lucide-message-square-quote ${className}`}
  >
    <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>
    <path d="M14 13a2 2 0 0 0 2-2V9h-2"/>
    <path d="M8 13a2 2 0 0 0 2-2V9H8"/>
  </svg>
);

// Printer Icon SVG
export const PrinterIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = ''
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-printer-icon lucide-printer ${className}`}
  >
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/>
    <rect x="6" y="14" width="12" height="8" rx="1"/>
  </svg>
);

// Layout Panel Top Icon SVG
export const LayoutPanelTopIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = ''
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-layout-panel-top-icon lucide-layout-panel-top ${className}`}
  >
    <rect width="18" height="7" x="3" y="3" rx="1"/>
    <rect width="7" height="7" x="3" y="14" rx="1"/>
    <rect width="7" height="7" x="14" y="14" rx="1"/>
  </svg>
);
