import { useState, useRef, useCallback, MouseEvent as ReactMouseEvent } from 'react';

export const use3DTilt = () => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const tiltRef = useRef({ x: 0, y: 0 });

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
      
      // Calculate position relative to center (-1 to 1)
      const percentX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
      const percentY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));
      
      // Calculate tilt (8 degrees max as per spec)
      const tiltX = percentY * -8;
      const tiltY = percentX * 8;
      
      // Store in ref for immediate access
      tiltRef.current = { x: tiltX, y: tiltY };
      
      setTilt({ x: tiltX, y: tiltY });
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setIsHovered(false);
    tiltRef.current = { x: 0, y: 0 };
    setTilt({ x: 0, y: 0 });
  }, []);

  // Tilt style with smooth damping
  const tiltStyle = {
    transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
    transition: 'transform 0.1s ease-out',
    transformStyle: 'preserve-3d' as const,
  };

  // Container style with scale and shadow
  const containerStyle = {
    transform: `scale(${isHovered ? 1.03 : 1})`,
    transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
    boxShadow: isHovered 
      ? `${tilt.y * -0.5}px ${tilt.x * -0.5 + 8}px 20px rgba(0, 0, 0, 0.15)`
      : '0 4px 12px rgba(0, 0, 0, 0.1)',
    willChange: isHovered ? 'transform' : 'auto',
  };

  return {
    ref,
    tiltStyle,
    containerStyle,
    onMouseMove: handleMouseMove,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
};