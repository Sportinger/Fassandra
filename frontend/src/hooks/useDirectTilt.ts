import { useState, useRef, MouseEvent as ReactMouseEvent } from 'react';

export const useDirectTilt = () => {
  const [transform, setTransform] = useState('rotateX(0deg) rotateY(0deg)');
  const [shadow, setShadow] = useState('0 4px 12px rgba(0, 0, 0, 0.1)');
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
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
    
    // Update transform directly
    setTransform(`rotateX(${tiltX}deg) rotateY(${tiltY}deg)`);
    
    // Update shadow
    setShadow(`${tiltY * -0.5}px ${tiltX * -0.5 + 8}px 20px rgba(0, 0, 0, 0.15)`);
  };

  const handleMouseEnter = () => {
    // Just for setting initial hover state if needed
  };

  const handleMouseLeave = () => {
    setTransform('rotateX(0deg) rotateY(0deg)');
    setShadow('0 4px 12px rgba(0, 0, 0, 0.1)');
  };

  const style = {
    transform,
    transformStyle: 'preserve-3d' as const,
    boxShadow: shadow,
    willChange: 'transform',
  };

  return {
    ref,
    style,
    onMouseMove: handleMouseMove,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
};