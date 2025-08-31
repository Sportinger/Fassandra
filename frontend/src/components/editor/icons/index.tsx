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

// Trash2 Icon SVG
export const Trash2Icon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-trash2-icon lucide-trash-2 ${className}`}
  >
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
    <path d="M3 6h18"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

// Palette Icon SVG
export const PaletteIcon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-palette-icon lucide-palette ${className}`}
  >
    <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
  </svg>
);

// Megaphone Icon SVG
export const MegaphoneIcon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-megaphone-icon lucide-megaphone ${className}`}
  >
    <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
    <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/>
    <path d="M8 6v8"/>
  </svg>
);

// Corner Down Left Icon SVG
export const CornerDownLeftIcon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-corner-down-left-icon lucide-corner-down-left ${className}`}
  >
    <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
    <path d="m9 10-5 5 5 5"/>
  </svg>
);

// Layout List Icon SVG
export const LayoutListIcon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-layout-list-icon lucide-layout-list ${className}`}
  >
    <rect width="7" height="7" x="3" y="3" rx="1"/>
    <rect width="7" height="7" x="3" y="14" rx="1"/>
    <path d="M14 4h7"/>
    <path d="M14 9h7"/>
    <path d="M14 15h7"/>
    <path d="M14 20h7"/>
  </svg>
);

// Message Square Off Icon SVG
export const MessageSquareOffIcon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-message-square-off-icon lucide-message-square-off ${className}`}
  >
    <path d="M19 19H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.7.7 0 0 1 2 21.286V5a2 2 0 0 1 1.184-1.826"/>
    <path d="m2 2 20 20"/>
    <path d="M8.656 3H20a2 2 0 0 1 2 2v11.344"/>
  </svg>
);

// Bold Icon SVG
export const BoldIcon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-bold-icon lucide-bold ${className}`}
  >
    <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>
  </svg>
);

// Italic Icon SVG
export const ItalicIcon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-italic-icon lucide-italic ${className}`}
  >
    <line x1="19" x2="10" y1="4" y2="4"/>
    <line x1="14" x2="5" y1="20" y2="20"/>
    <line x1="15" x2="9" y1="4" y2="20"/>
  </svg>
);

// Text Align Center Icon SVG
export const TextAlignCenterIcon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-text-align-center-icon lucide-text-align-center ${className}`}
  >
    <path d="M21 5H3"/>
    <path d="M17 12H7"/>
    <path d="M19 19H5"/>
  </svg>
);

// Text Align End (Right) Icon SVG
export const TextAlignEndIcon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-text-align-end-icon lucide-text-align-end ${className}`}
  >
    <path d="M21 5H3"/>
    <path d="M21 12H9"/>
    <path d="M21 19H7"/>
  </svg>
);

// Text Align Start (Left) Icon SVG
export const TextAlignStartIcon: React.FC<{ size?: number; className?: string }> = ({
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
    className={`lucide lucide-text-align-start-icon lucide-text-align-start ${className}`}
  >
    <path d="M21 5H3"/>
    <path d="M15 12H3"/>
    <path d="M17 19H3"/>
  </svg>
);
