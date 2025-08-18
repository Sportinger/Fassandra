import { useRef, useCallback, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { useDeviceOrientation } from './useDeviceOrientation';

const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0);
};

interface TiltOptions {
  maxTilt?: number;
  sensitivity?: number;
  mobileMultiplier?: number;
}

export const useCssTiltWithAccelerometer = (options: TiltOptions = {}) => {
  const {
    maxTilt = 8,
    sensitivity = 1,
    mobileMultiplier = 0.5,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const isMobile = isMobileDevice();
  const { orientation, isSupported, requestPermission } = useDeviceOrientation();
  const lastOrientationRef = useRef({ beta: 0, gamma: 0 });
  const smoothedOrientationRef = useRef({ beta: 0, gamma: 0 });

  // Mouse handling for desktop
  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!ref.current || isMobile) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate position relative to center (-1 to 1)
    const percentX = (e.clientX - centerX) / (rect.width / 2);
    const percentY = (e.clientY - centerY) / (rect.height / 2);
    
    // Clamp values
    const clampedX = Math.max(-1, Math.min(1, percentX));
    const clampedY = Math.max(-1, Math.min(1, percentY));
    
    // Calculate tilt
    const tiltX = clampedY * -maxTilt * sensitivity;
    const tiltY = clampedX * maxTilt * sensitivity;
    
    // Set CSS variables directly on the element
    ref.current.style.setProperty('--tilt-x', `${tiltX}deg`);
    ref.current.style.setProperty('--tilt-y', `${tiltY}deg`);
    ref.current.style.setProperty('--shadow-x', `${tiltY * -0.5}px`);
    ref.current.style.setProperty('--shadow-y', `${tiltX * -0.5 + 8}px`);
    
    // Add parallax offset variables
    ref.current.style.setProperty('--parallax-x', `${tiltY * 2}px`);
    ref.current.style.setProperty('--parallax-y', `${tiltX * -2}px`);
  }, [isMobile, maxTilt, sensitivity]);

  const handleMouseEnter = useCallback(() => {
    if (!ref.current || isMobile) return;
    ref.current.style.setProperty('--hover', '1');
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (!ref.current || isMobile) return;
    ref.current.style.setProperty('--tilt-x', '0deg');
    ref.current.style.setProperty('--tilt-y', '0deg');
    ref.current.style.setProperty('--shadow-x', '0px');
    ref.current.style.setProperty('--shadow-y', '8px');
    ref.current.style.setProperty('--hover', '0');
    ref.current.style.setProperty('--parallax-x', '0px');
    ref.current.style.setProperty('--parallax-y', '0px');
  }, [isMobile]);

  // Accelerometer handling for mobile
  useEffect(() => {
    if (!isMobile || !isSupported || !ref.current) return;

    const updateTilt = () => {
      if (!ref.current || orientation.beta === null || orientation.gamma === null) return;

      // Smooth the orientation values using exponential moving average
      const smoothingFactor = 0.15;
      smoothedOrientationRef.current.beta = 
        smoothedOrientationRef.current.beta * (1 - smoothingFactor) + 
        orientation.beta * smoothingFactor;
      smoothedOrientationRef.current.gamma = 
        smoothedOrientationRef.current.gamma * (1 - smoothingFactor) + 
        orientation.gamma * smoothingFactor;

      // Beta: front-to-back tilt (x-axis rotation)
      // Range: -180 to 180, but typically -90 to 90 for normal device usage
      // Neutral position is around 60 degrees when held naturally
      const neutralBeta = 60;
      const betaDiff = smoothedOrientationRef.current.beta - neutralBeta;
      
      // Gamma: left-to-right tilt (y-axis rotation)
      // Range: -90 to 90
      // Neutral position is 0 degrees
      const gammaDiff = smoothedOrientationRef.current.gamma;

      // Calculate tilt with mobile multiplier for subtler effect
      const tiltX = Math.max(-maxTilt, Math.min(maxTilt, 
        (betaDiff / 30) * maxTilt * sensitivity * mobileMultiplier));
      const tiltY = Math.max(-maxTilt, Math.min(maxTilt, 
        (gammaDiff / 30) * maxTilt * sensitivity * mobileMultiplier));

      // Apply the tilt
      ref.current.style.setProperty('--tilt-x', `${tiltX}deg`);
      ref.current.style.setProperty('--tilt-y', `${tiltY}deg`);
      ref.current.style.setProperty('--shadow-x', `${tiltY * -0.3}px`);
      ref.current.style.setProperty('--shadow-y', `${tiltX * -0.3 + 8}px`);
      
      // Subtler parallax for mobile
      ref.current.style.setProperty('--parallax-x', `${tiltY * 1.5}px`);
      ref.current.style.setProperty('--parallax-y', `${tiltX * -1.5}px`);
      
      // Always keep a subtle hover effect on mobile
      ref.current.style.setProperty('--hover', '0.3');
    };

    // Use requestAnimationFrame for smooth updates
    let animationFrameId: number;
    const animate = () => {
      updateTilt();
      animationFrameId = requestAnimationFrame(animate);
    };
    
    if (orientation.beta !== null && orientation.gamma !== null) {
      animate();
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isMobile, isSupported, orientation, maxTilt, sensitivity, mobileMultiplier]);

  // Handle touch events for mobile to trigger permission request if needed
  const handleTouchStart = useCallback(async () => {
    if (isMobile && isSupported && !orientation.beta) {
      await requestPermission();
    }
  }, [isMobile, isSupported, orientation.beta, requestPermission]);

  return {
    ref,
    className: 'tiltCard',
    onMouseMove: handleMouseMove,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleTouchStart,
    isMobile,
    isAccelerometerActive: isMobile && isSupported && orientation.beta !== null,
  };
};