import { useState, useRef, useEffect, useCallback } from 'react';

interface TiltState {
  tiltX: number;
  tiltY: number;
  glareX: number;
  glareY: number;
  shadowX: number;
  shadowY: number;
  scale: number;
}

interface Use3DTiltEffectOptions {
  maxTilt?: number;
  scale?: number;
  perspective?: number;
  transitionSpeed?: number;
  resetSpeed?: number;
  glare?: boolean;
  maxGlare?: number;
  shadow?: boolean;
  gyroscope?: boolean;
}

export const use3DTiltEffect = (options: Use3DTiltEffectOptions = {}) => {
  const {
    maxTilt = 8,
    scale = 1.02,
    perspective = 1000,
    transitionSpeed = 100,
    resetSpeed = 200,
    glare = true,
    maxGlare = 0.2,
    shadow = true,
    gyroscope = false,
  } = options;

  const [tiltState, setTiltState] = useState<TiltState>({
    tiltX: 0,
    tiltY: 0,
    glareX: 50,
    glareY: 50,
    shadowX: 0,
    shadowY: 0,
    scale: 1,
  });

  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const calculateTilt = useCallback((point: { clientX: number; clientY: number }) => {
    if (!elementRef.current || prefersReducedMotion) return;

    const rect = elementRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const { clientX, clientY } = point;
    
    const percentX = (clientX - centerX) / (rect.width / 2);
    const percentY = (clientY - centerY) / (rect.height / 2);
    
    const limitedPercentX = Math.max(-1, Math.min(1, percentX));
    const limitedPercentY = Math.max(-1, Math.min(1, percentY));
    
    const tiltX = limitedPercentY * -maxTilt;
    const tiltY = limitedPercentX * maxTilt;
    
    const glareX = ((limitedPercentX + 1) / 2) * 100;
    const glareY = ((limitedPercentY + 1) / 2) * 100;
    
    const shadowX = limitedPercentX * -5;
    const shadowY = limitedPercentY * -5;

    setTiltState({
      tiltX,
      tiltY,
      glareX,
      glareY,
      shadowX,
      shadowY,
      scale,
    });
  }, [maxTilt, scale, prefersReducedMotion]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      calculateTilt(e);
    });
  }, [calculateTilt]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setTiltState({
      tiltX: 0,
      tiltY: 0,
      glareX: 50,
      glareY: 50,
      shadowX: 0,
      shadowY: 0,
      scale: 1,
    });
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length > 0) {
      calculateTilt(e.touches[0]);
    }
  }, [calculateTilt]);

  const handleTouchEnd = useCallback(() => {
    handleMouseLeave();
  }, [handleMouseLeave]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('touchmove', handleTouchMove);
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleMouseEnter, handleMouseLeave, handleMouseMove, handleTouchMove, handleTouchEnd]);

  const getContainerStyle = () => {
    if (prefersReducedMotion) {
      return {};
    }

    return {
      transform: `rotateX(${tiltState.tiltX}deg) rotateY(${tiltState.tiltY}deg) scale(${isHovered ? tiltState.scale : 1})`,
      transition: `transform ${isHovered ? transitionSpeed : resetSpeed}ms ease-out`,
      transformStyle: 'preserve-3d' as const,
      willChange: isHovered ? 'transform' : 'auto',
    };
  };

  const getGlareStyle = () => {
    if (!glare || prefersReducedMotion) {
      return { display: 'none' };
    }

    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: `radial-gradient(
        circle at ${tiltState.glareX}% ${tiltState.glareY}%,
        rgba(255, 255, 255, ${isHovered ? maxGlare : 0}) 0%,
        transparent 60%
      )`,
      pointerEvents: 'none' as const,
      transition: `opacity ${isHovered ? transitionSpeed : resetSpeed}ms ease-out`,
      borderRadius: 'inherit',
      zIndex: 2,
    };
  };

  const getShadowStyle = () => {
    if (!shadow || prefersReducedMotion) {
      return {};
    }

    const baseBlur = 12;
    const hoverBlur = 20;
    const currentBlur = isHovered ? hoverBlur : baseBlur;
    
    return {
      boxShadow: `
        ${tiltState.shadowX}px ${tiltState.shadowY + 4}px ${currentBlur}px rgba(0, 0, 0, ${isHovered ? 0.15 : 0.1})
      `,
      transition: `box-shadow ${isHovered ? transitionSpeed : resetSpeed}ms ease-out`,
    };
  };

  const getParallaxStyle = (depth: number = 1) => {
    if (prefersReducedMotion) {
      return {};
    }

    const translateX = tiltState.tiltY * depth * 0.5;
    const translateY = tiltState.tiltX * depth * -0.5;
    
    return {
      transform: `translateX(${translateX}px) translateY(${translateY}px) translateZ(${depth * 10}px)`,
      transition: `transform ${isHovered ? transitionSpeed : resetSpeed}ms ease-out`,
      transformStyle: 'preserve-3d' as const,
    };
  };

  return {
    ref: elementRef,
    isHovered,
    tiltState,
    getContainerStyle,
    getGlareStyle,
    getShadowStyle,
    getParallaxStyle,
  };
};
