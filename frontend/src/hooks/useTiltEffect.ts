import { useState, useRef, useCallback, useEffect, MouseEvent as ReactMouseEvent } from 'react';

export const useTiltEffect = () => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const isInsideRef = useRef(false);

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    
    // Make sure we're still hovered
    if (!isInsideRef.current) {
      isInsideRef.current = true;
      setIsHovered(true);
    }
    
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      if (!ref.current) return;
      
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate position relative to center (-1 to 1)
      const percentX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
      const percentY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));
      
      // Calculate tilt (8 degrees max)
      const tiltX = percentY * -8;
      const tiltY = percentX * 8;
      
      setTilt({ x: tiltX, y: tiltY });
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    isInsideRef.current = true;
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    // Check if we're actually leaving the card element
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (ref.current && ref.current.contains(relatedTarget)) {
      return; // Still inside the card
    }
    
    isInsideRef.current = false;
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  // Single style object with all transforms (no scale for scripts)
  const style = {
    transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
    // Only transition box-shadow, not transform (to prevent jitter)
    transition: 'box-shadow 0.2s ease-out',
    transformStyle: 'preserve-3d' as const,
    boxShadow: isHovered 
      ? `${tilt.y * -0.5}px ${tilt.x * -0.5 + 8}px 20px rgba(0, 0, 0, 0.15)`
      : '0 4px 12px rgba(0, 0, 0, 0.1)',
    willChange: isHovered ? 'transform' : 'auto',
  };

  return {
    ref,
    style,
    onMouseMove: handleMouseMove,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
};