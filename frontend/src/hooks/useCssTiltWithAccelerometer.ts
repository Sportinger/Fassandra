import { useRef, useCallback, useEffect, MouseEvent as ReactMouseEvent, useState } from 'react';
import { useDeviceOrientation } from './useDeviceOrientation';

const isMobileDevice = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0);
  
  console.log('Mobile detection:', { 
    userAgent, 
    isMobile,
    hasTouchStart: 'ontouchstart' in window,
    maxTouchPoints: navigator.maxTouchPoints 
  });
  
  return isMobile;
};

interface TiltOptions {
  maxTilt?: number;
  sensitivity?: number;
  mobileMultiplier?: number;
  invert?: boolean; // invert tilt directions
}

export const useCssTiltWithAccelerometer = (options: TiltOptions = {}) => {
  const {
    maxTilt = 8,
    sensitivity = 1,
    mobileMultiplier = 0.5,
    invert = false,
  } = options;

  const ref = useRef<HTMLDivElement | null>(null);
  const [isMobile] = useState(() => isMobileDevice());
  const { orientation, isSupported, permissionGranted, requestPermission, debug } = useDeviceOrientation();
  const lastOrientationRef = useRef({ beta: 0, gamma: 0 });
  const smoothedOrientationRef = useRef({ beta: 0, gamma: 0 });
  const [isActive, setIsActive] = useState(false);
  const lastMovementTime = useRef(Date.now());
  const autoCenterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const targetTiltRef = useRef({ x: 0, y: 0 });
  const currentTiltRef = useRef({ x: 0, y: 0 });

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
    let tiltX = clampedY * -maxTilt * sensitivity;
    let tiltY = clampedX * maxTilt * sensitivity;
    if (invert) { tiltX = -tiltX; tiltY = -tiltY; }
    
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
    if (!isMobile || !isSupported) {
      return;
    }

    const updateTilt = () => {
      if (!ref.current) return;
      
      // Check if we have valid orientation data
      if (orientation.beta === null || orientation.gamma === null) {
        return;
      }

      if (!isActive) {
        setIsActive(true);
      }

      // Detect if there's new movement
      const movementThreshold = 2;
      const hasMovement = Math.abs(orientation.beta - lastOrientationRef.current.beta) > movementThreshold ||
                         Math.abs(orientation.gamma - lastOrientationRef.current.gamma) > movementThreshold;
      
      if (hasMovement) {
        lastMovementTime.current = Date.now();
        lastOrientationRef.current = { beta: orientation.beta, gamma: orientation.gamma };
        
        // Clear any existing auto-center timeout
        if (autoCenterTimeoutRef.current) {
          clearTimeout(autoCenterTimeoutRef.current);
        }
        
        // Set new auto-center timeout for 2 seconds
        autoCenterTimeoutRef.current = setTimeout(() => {
          targetTiltRef.current = { x: 0, y: 0 };
        }, 2000);
      }

      // Smooth the orientation values
      const smoothingFactor = 0.15;
      smoothedOrientationRef.current.beta = 
        smoothedOrientationRef.current.beta * (1 - smoothingFactor) + 
        orientation.beta * smoothingFactor;
      smoothedOrientationRef.current.gamma = 
        smoothedOrientationRef.current.gamma * (1 - smoothingFactor) + 
        orientation.gamma * smoothingFactor;

      // Calculate target tilt based on device orientation
      const neutralBeta = 45;
      const betaDiff = (smoothedOrientationRef.current.beta - neutralBeta);
      const gammaDiff = smoothedOrientationRef.current.gamma;

      // INVERTED: Tilt opposite to phone movement
      // Phone tilt up = card tilts down, phone left = card right
      if (hasMovement) {
        let tx = (betaDiff / 25) * maxTilt * sensitivity * mobileMultiplier;      // up/down
        let ty = -(gammaDiff / 25) * maxTilt * sensitivity * mobileMultiplier;    // left/right inverted baseline
        if (invert) { tx = -tx; ty = -ty; }
        targetTiltRef.current.x = Math.max(-maxTilt, Math.min(maxTilt, tx));
        targetTiltRef.current.y = Math.max(-maxTilt, Math.min(maxTilt, ty));
      }

      // Smooth interpolation to target (for auto-centering effect)
      const lerpFactor = 0.1;
      currentTiltRef.current.x += (targetTiltRef.current.x - currentTiltRef.current.x) * lerpFactor;
      currentTiltRef.current.y += (targetTiltRef.current.y - currentTiltRef.current.y) * lerpFactor;

      // Apply the tilt
      ref.current.style.setProperty('--tilt-x', `${currentTiltRef.current.x}deg`);
      ref.current.style.setProperty('--tilt-y', `${currentTiltRef.current.y}deg`);
      ref.current.style.setProperty('--shadow-x', `${currentTiltRef.current.y * -0.3}px`);
      ref.current.style.setProperty('--shadow-y', `${Math.abs(currentTiltRef.current.x) * 0.3 + 8}px`);
      
      // Subtler parallax for mobile (also inverted)
      ref.current.style.setProperty('--parallax-x', `${currentTiltRef.current.y * 1.5}px`);
      ref.current.style.setProperty('--parallax-y', `${currentTiltRef.current.x * -1.5}px`);
      
      // Always keep a subtle hover effect on mobile
      ref.current.style.setProperty('--hover', '0.3');
    };

    // Use requestAnimationFrame for smooth updates
    let animationFrameId: number;
    const animate = () => {
      updateTilt();
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (autoCenterTimeoutRef.current) {
        clearTimeout(autoCenterTimeoutRef.current);
      }
    };
  }, [isMobile, isSupported, orientation.beta, orientation.gamma, maxTilt, sensitivity, mobileMultiplier, isActive]);

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
    debug: {
      isMobile,
      isSupported,
      permissionGranted,
      hasData: orientation.beta !== null,
      orientation,
      message: debug,
    }
  };
};
