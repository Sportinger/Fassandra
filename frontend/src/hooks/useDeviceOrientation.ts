import { useEffect, useState, useCallback, useRef } from 'react';

interface DeviceOrientationData {
  alpha: number | null; // rotation around z-axis (0-360)
  beta: number | null;  // rotation around x-axis (-180 to 180)
  gamma: number | null; // rotation around y-axis (-90 to 90)
}

export const useDeviceOrientation = () => {
  const [orientation, setOrientation] = useState<DeviceOrientationData>({
    alpha: null,
    beta: null,
    gamma: null,
  });
  
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [debug, setDebug] = useState<string>('Initializing...');
  const hasReceivedData = useRef(false);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    // Some Android devices need absolute values
    const alpha = event.alpha !== null ? event.alpha : 0;
    const beta = event.beta !== null ? event.beta : 0;
    const gamma = event.gamma !== null ? event.gamma : 0;
    
    if (!hasReceivedData.current && (event.alpha !== null || event.beta !== null || event.gamma !== null)) {
      hasReceivedData.current = true;
      setPermissionGranted(true);
      console.log('Accelerometer data received:', { alpha, beta, gamma });
    }
    
    setOrientation({
      alpha,
      beta,
      gamma,
    });
    
    setDebug(`α:${alpha?.toFixed(1)} β:${beta?.toFixed(1)} γ:${gamma?.toFixed(1)}`);
  }, []);

  const requestPermission = useCallback(async () => {
    console.log('Requesting device orientation permission...');
    
    // For iOS 13+ we need to request permission
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        console.log('iOS permission result:', permission);
        setPermissionGranted(permission === 'granted');
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting device orientation permission:', error);
        return false;
      }
    }
    
    // For Android/other devices, permission is implicit
    console.log('Android/other device - permission implicit');
    setPermissionGranted(true);
    return true;
  }, []);

  useEffect(() => {
    console.log('Setting up device orientation listener...');
    
    // Check multiple APIs for better compatibility
    const checkOrientation = () => {
      if (window.DeviceOrientationEvent) {
        console.log('DeviceOrientationEvent is supported');
        setIsSupported(true);
        
        // For Android, we need to check if we're in a secure context
        if (window.isSecureContext) {
          console.log('Secure context confirmed');
        } else {
          console.warn('Not in secure context - accelerometer may not work');
          setDebug('HTTPS required for accelerometer');
        }
        
        // Add listener with options for better compatibility
        window.addEventListener('deviceorientation', handleOrientation, true);
        
        // For Android, immediately mark as permitted
        if (!/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          setPermissionGranted(true);
          setDebug('Waiting for device movement...');
        }
        
        return true;
      } else {
        console.log('DeviceOrientationEvent not supported');
        setDebug('Accelerometer not supported');
        return false;
      }
    };

    const supported = checkOrientation();
    
    // Cleanup
    return () => {
      if (supported) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, [handleOrientation]);

  return {
    orientation,
    isSupported,
    permissionGranted,
    requestPermission,
    debug,
  };
};