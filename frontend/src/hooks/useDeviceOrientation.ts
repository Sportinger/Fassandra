import { useEffect, useState, useCallback } from 'react';

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

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    setOrientation({
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
    });
  }, []);

  const requestPermission = useCallback(async () => {
    // For iOS 13+ we need to request permission
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        setPermissionGranted(permission === 'granted');
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting device orientation permission:', error);
        return false;
      }
    }
    
    // For other devices, permission is implicit
    setPermissionGranted(true);
    return true;
  }, []);

  useEffect(() => {
    // Check if device orientation is supported
    if ('DeviceOrientationEvent' in window) {
      setIsSupported(true);
      
      // Try to add the listener directly (works on Android and older iOS)
      window.addEventListener('deviceorientation', handleOrientation);
      
      // Check if we're getting data
      const checkTimeout = setTimeout(() => {
        if (orientation.alpha === null && orientation.beta === null && orientation.gamma === null) {
          // No data received, might need permission
          requestPermission();
        } else {
          setPermissionGranted(true);
        }
      }, 1000);

      return () => {
        window.removeEventListener('deviceorientation', handleOrientation);
        clearTimeout(checkTimeout);
      };
    }
  }, [handleOrientation, orientation.alpha, orientation.beta, orientation.gamma, requestPermission]);

  return {
    orientation,
    isSupported,
    permissionGranted,
    requestPermission,
  };
};