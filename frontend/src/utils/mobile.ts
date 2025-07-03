// Mobile detection and utility functions

/**
 * Comprehensive mobile device detection
 */
export function isMobileDevice(): boolean {
  // Check user agent
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Mobile browser patterns
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Opera Mini/i,
    /IEMobile/i,
    /Mobile/i
  ];
  
  const isMobileUserAgent = mobilePatterns.some(pattern => pattern.test(userAgent));
  
  // Screen size detection
  const isMobileScreen = window.innerWidth <= 768;
  
  // Touch support detection
  const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return isMobileUserAgent || (isMobileScreen && hasTouchSupport);
}

/**
 * Check if device is in landscape mode
 */
export function isLandscape(): boolean {
  return window.innerWidth > window.innerHeight;
}

/**
 * Check if device is a tablet (larger mobile device)
 */
export function isTablet(): boolean {
  const screenWidth = window.innerWidth;
  return isMobileDevice() && screenWidth >= 768 && screenWidth <= 1024;
}

/**
 * Get optimal font size for mobile devices
 */
export function getMobileFontSize(): number {
  const screenWidth = window.innerWidth;
  
  // Base font size of 16px, scale based on screen width
  if (screenWidth <= 320) return 14; // Very small phones
  if (screenWidth <= 375) return 15; // Standard phones
  if (screenWidth <= 414) return 16; // Larger phones
  if (screenWidth <= 768) return 17; // Large phones / small tablets
  
  return 16; // Fallback
}

/**
 * Get optimal line height for mobile reading
 */
export function getMobileLineHeight(): number {
  // Slightly higher line height for mobile readability
  return isMobileDevice() ? 1.6 : 1.5;
}

/**
 * Calculate mobile-optimized page dimensions
 */
export function getMobilePageDimensions() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Account for mobile browser UI (address bar, etc.)
  const safeAreaTop = 0; // Could be enhanced with CSS env() support
  const safeAreaBottom = 80; // Space for toolbar and footer
  
  return {
    width: viewportWidth,
    height: viewportHeight,
    contentWidth: viewportWidth - 20, // 10px padding each side
    contentHeight: viewportHeight - safeAreaTop - safeAreaBottom,
    padding: 10,
    safeAreaTop,
    safeAreaBottom
  };
}

/**
 * Apply mobile-specific viewport meta tag
 */
export function setupMobileViewport(): void {
  let viewport = document.querySelector('meta[name="viewport"]');
  
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  
  // Mobile-optimized viewport settings
  viewport.setAttribute('content', 
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
  );
}

/**
 * Prevent mobile zoom on input focus
 */
export function preventMobileZoom(): void {
  // Add event listeners to prevent zoom on input focus
  const inputs = document.querySelectorAll('input, textarea, select');
  
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      // Temporarily disable viewport zoom
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
        );
      }
    });
    
    input.addEventListener('blur', () => {
      // Re-enable viewport zoom after focus
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes'
        );
      }
    });
  });
}

/**
 * Debounced resize handler for mobile orientation changes
 */
export function setupMobileResizeHandler(callback: () => void, delay: number = 300): () => void {
  let timeoutId: number;
  
  const handleResize = () => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(callback, delay);
  };
  
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', handleResize);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);
    clearTimeout(timeoutId);
  };
}

/**
 * Mobile-specific text formatting for consistent line breaks
 */
export function formatTextForMobile(text: string): string {
  // Ensure consistent line breaks across devices
  return text
    .replace(/\r\n/g, '\n') // Normalize Windows line endings
    .replace(/\r/g, '\n')   // Normalize Mac line endings
    .replace(/\n{3,}/g, '\n\n'); // Limit consecutive line breaks
}

/**
 * Check if user is using a mobile browser with known issues
 */
export function getMobileBrowserInfo() {
  const userAgent = navigator.userAgent;
  
  return {
    isChromeMobile: /Chrome.*Mobile/i.test(userAgent),
    isSafariMobile: /Safari.*Mobile/i.test(userAgent) && !/Chrome/i.test(userAgent),
    isFirefoxMobile: /Firefox.*Mobile/i.test(userAgent),
    isBraveMobile: /Brave.*Mobile/i.test(userAgent),
    isSamsungBrowser: /SamsungBrowser/i.test(userAgent),
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isAndroid: /Android/i.test(userAgent),
    browserVersion: extractBrowserVersion(userAgent)
  };
}

/**
 * Extract browser version for mobile compatibility checks
 */
function extractBrowserVersion(userAgent: string): string {
  const patterns = [
    { name: 'Chrome', pattern: /Chrome\/(\d+\.\d+)/ },
    { name: 'Safari', pattern: /Version\/(\d+\.\d+)/ },
    { name: 'Firefox', pattern: /Firefox\/(\d+\.\d+)/ },
    { name: 'Samsung', pattern: /SamsungBrowser\/(\d+\.\d+)/ }
  ];
  
  for (const { name, pattern } of patterns) {
    const match = userAgent.match(pattern);
    if (match) {
      return `${name} ${match[1]}`;
    }
  }
  
  return 'Unknown';
}

/**
 * Mobile performance optimization
 */
export function optimizeForMobile(): void {
  if (!isMobileDevice()) return;
  
  // Setup mobile viewport
  setupMobileViewport();
  
  // Prevent zoom on inputs
  preventMobileZoom();
  
  // Add mobile-specific CSS class to body
  document.body.classList.add('mobile-device');
  
  // Add orientation class
  const updateOrientation = () => {
    document.body.classList.toggle('landscape', isLandscape());
    document.body.classList.toggle('portrait', !isLandscape());
  };
  
  updateOrientation();
  setupMobileResizeHandler(updateOrientation);
  
  // Optimize touch events
  document.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('touchmove', () => {}, { passive: true });
} 