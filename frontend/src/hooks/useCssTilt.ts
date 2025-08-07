import { useRef, useCallback, MouseEvent as ReactMouseEvent } from 'react';

export const useCssTilt = () => {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate position relative to center (-1 to 1)
    const percentX = (e.clientX - centerX) / (rect.width / 2);
    const percentY = (e.clientY - centerY) / (rect.height / 2);
    
    // Clamp values
    const clampedX = Math.max(-1, Math.min(1, percentX));
    const clampedY = Math.max(-1, Math.min(1, percentY));
    
    // Calculate tilt (8 degrees max)
    const tiltX = clampedY * -8;
    const tiltY = clampedX * 8;
    
    // Set CSS variables directly on the element
    ref.current.style.setProperty('--tilt-x', `${tiltX}deg`);
    ref.current.style.setProperty('--tilt-y', `${tiltY}deg`);
    ref.current.style.setProperty('--shadow-x', `${tiltY * -0.5}px`);
    ref.current.style.setProperty('--shadow-y', `${tiltX * -0.5 + 8}px`);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.setProperty('--hover', '1');
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.setProperty('--tilt-x', '0deg');
    ref.current.style.setProperty('--tilt-y', '0deg');
    ref.current.style.setProperty('--shadow-x', '0px');
    ref.current.style.setProperty('--shadow-y', '8px');
    ref.current.style.setProperty('--hover', '0');
  }, []);

  return {
    ref,
    className: 'tiltCard',
    onMouseMove: handleMouseMove,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
};