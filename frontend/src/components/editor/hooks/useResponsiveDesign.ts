/**
 * useResponsiveDesign Hook
 * Manages responsive behavior and device detection for the editor
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ResponsiveConfig, DimensionConfig, Breakpoint, UseResponsiveDesignReturn } from '../types/index';

// Breakpoint definitions
const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

// Device detection utilities
const detectMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
  ];
  
  return mobilePatterns.some(pattern => navigator.userAgent.match(pattern)) ||
         'ontouchstart' in window ||
         navigator.maxTouchPoints > 0;
};

const getBreakpoint = (width: number): Breakpoint => {
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
};

const calculateDimensions = (config: ResponsiveConfig): DimensionConfig => {
  const { viewport, breakpoint } = config;
  
  // Base calculations for responsive scaling
  const baseWidth = 21; // cm - DIN A4 width
  const baseHeight = 29.7; // cm - DIN A4 height
  const ratio = baseHeight / baseWidth; // 1.414
  
  // Calculate responsive page dimensions
  let pageWidth: string;
  let pageHeight: string;
  let contentPaddingX: string;
  let contentPaddingY: string;
  let baseFontSize: string;
  let lineHeight: string;
  
  switch (breakpoint) {
    case 'mobile':
      // Mobile: Full width, proportional scaling
      pageWidth = '100%';
      pageHeight = '100vh';
      contentPaddingX = 'clamp(12px, 4vw, 16px)';
      contentPaddingY = 'clamp(16px, 5vh, 24px)';
      baseFontSize = 'clamp(15px, 2.2vw, 16px)';
      lineHeight = '1.5';
      break;
      
    case 'tablet':
      // Tablet: Scaled down DIN A4
      pageWidth = 'clamp(400px, 80vw, 600px)';
      pageHeight = `calc(var(--page-width) * ${ratio})`;
      contentPaddingX = 'clamp(20px, 3vw, 40px)';
      contentPaddingY = 'clamp(24px, 4vh, 60px)';
      baseFontSize = 'clamp(15px, 2vw, 17px)';
      lineHeight = '1.5';
      break;
      
    case 'desktop':
    case 'wide':
      // Desktop: Full DIN A4 size
      pageWidth = '21cm';
      pageHeight = '29.7cm';
      contentPaddingX = '1.5cm';
      contentPaddingY = '2cm';
      baseFontSize = '16px';
      lineHeight = '1.5';
      break;
  }
  
  return {
    pageWidth,
    pageHeight,
    contentPaddingX,
    contentPaddingY,
    baseFontSize,
    lineHeight,
  };
};

export const useResponsiveDesign = (): UseResponsiveDesignReturn => {
  // Viewport state
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));
  
  // Update viewport on resize
  const updateViewport = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    setViewport({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);
  
  // Set up resize listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    const handleResize = () => {
      // Debounce resize events
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(updateViewport, 100);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [updateViewport]);
  
  // Calculate responsive configuration
  const config = useMemo((): ResponsiveConfig => {
    const breakpoint = getBreakpoint(viewport.width);
    const isMobile = detectMobile() || breakpoint === 'mobile';
    const isTablet = breakpoint === 'tablet' && !isMobile;
    const isDesktop = breakpoint === 'desktop' || breakpoint === 'wide';
    
    return {
      breakpoint,
      isMobile,
      isTablet,
      isDesktop,
      viewport,
    };
  }, [viewport]);
  
  // Calculate dimension configuration
  const dimensions = useMemo((): DimensionConfig => {
    return calculateDimensions(config);
  }, [config]);
  
  // Apply CSS custom properties
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    
    // Set responsive CSS custom properties
    root.style.setProperty('--page-width', dimensions.pageWidth);
    root.style.setProperty('--page-height', dimensions.pageHeight);
    root.style.setProperty('--content-padding-x', dimensions.contentPaddingX);
    root.style.setProperty('--content-padding-y', dimensions.contentPaddingY);
    root.style.setProperty('--font-size-base', dimensions.baseFontSize);
    root.style.setProperty('--line-height-normal', dimensions.lineHeight);
    
    // Set breakpoint data attributes for CSS
    root.setAttribute('data-breakpoint', config.breakpoint);
    root.setAttribute('data-mobile', config.isMobile.toString());
    root.setAttribute('data-tablet', config.isTablet.toString());
    root.setAttribute('data-desktop', config.isDesktop.toString());
    
    // Add mobile-specific class for additional styling
    if (config.isMobile) {
      document.body.classList.add('mobile-device');
    } else {
      document.body.classList.remove('mobile-device');
    }
  }, [config, dimensions]);
  
  // Debug logging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ResponsiveDesign] Config updated:', {
        breakpoint: config.breakpoint,
        viewport: config.viewport,
        dimensions,
        isMobile: config.isMobile,
        isTablet: config.isTablet,
        isDesktop: config.isDesktop,
      });
    }
  }, [config, dimensions]);
  
  return {
    config,
    dimensions,
    isMobile: config.isMobile,
    isTablet: config.isTablet,
    isDesktop: config.isDesktop,
    updateViewport,
  };
}; 