import { useState, useRef, useCallback, MouseEvent as ReactMouseEvent } from 'react';

export const useSimpleTilt = () => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      if (!ref.current) return;
      
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Limit to -1 to 1 range
      const percentX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
      const percentY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));
      
      const tiltX = percentY * -8; // Subtle tilt as per spec (8 degrees)
      const tiltY = percentX * 8;
      
      setTilt({
        x: tiltX,
        y: tiltY,
      });
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setScale(1.03);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setScale(1);
    setTilt({ x: 0, y: 0 });
  }, []);

  // Separate transforms: tilt without transition, scale with transition
  const style = {
    transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${scale})`,
    transition: 'scale 0.2s ease-out, box-shadow 0.2s ease-out',
    transformStyle: 'preserve-3d' as const,
    boxShadow: scale > 1 
      ? `${tilt.y * -0.5}px ${tilt.x * -0.5 + 8}px 20px rgba(0, 0, 0, 0.15)`
      : '0 4px 12px rgba(0, 0, 0, 0.1)',
    willChange: scale > 1 ? 'transform' : 'auto',
  };

  return {
    ref,
    style,
    onMouseMove: handleMouseMove,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
};