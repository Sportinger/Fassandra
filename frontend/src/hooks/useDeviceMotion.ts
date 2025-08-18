import { useEffect, useState, useCallback, useRef } from 'react';

interface DeviceMotionData {
  x: number | null;
  y: number | null;
  z: number | null;
}

export const useDeviceMotion = () => {
  const [acceleration, setAcceleration] = useState<DeviceMotionData>({
    x: null,
    y: null,
    z: null,
  });
  
  const [rotationRate, setRotationRate] = useState<DeviceMotionData>({
    x: null,
    y: null,
    z: null,
  });
  
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [debug, setDebug] = useState<string>('Initializing motion...');
  const hasReceivedData = useRef(false);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    // Try to get accelerometer data including gravity
    const accel = event.accelerationIncludingGravity;
    const rotation = event.rotationRate;
    
    if (accel && (accel.x !== null || accel.y !== null || accel.z !== null)) {
      if (!hasReceivedData.current) {
        hasReceivedData.current = true;
        setPermissionGranted(true);
        console.log('DeviceMotion data received:', { accel, rotation });
      }
      
      setAcceleration({
        x: accel.x || 0,
        y: accel.y || 0,
        z: accel.z || 0,
      });
      
      setDebug(`Motion: x:${accel.x?.toFixed(1)} y:${accel.y?.toFixed(1)} z:${accel.z?.toFixed(1)}`);
    }
    
    if (rotation && (rotation.alpha !== null || rotation.beta !== null || rotation.gamma !== null)) {
      setRotationRate({
        x: rotation.alpha || 0,
        y: rotation.beta || 0,
        z: rotation.gamma || 0,
      });
    }
  }, []);

  const requestPermission = useCallback(async () => {
    console.log('Requesting device motion permission...');
    
    // For iOS 13+ we need to request permission
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        console.log('iOS motion permission result:', permission);
        setPermissionGranted(permission === 'granted');
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting device motion permission:', error);
        return false;
      }
    }
    
    // For Android/other devices, permission is implicit
    console.log('Android/other device - motion permission implicit');
    setPermissionGranted(true);
    return true;
  }, []);

  useEffect(() => {
    console.log('Setting up device motion listener...');
    
    const checkMotion = () => {
      if (window.DeviceMotionEvent) {
        console.log('DeviceMotionEvent is supported');
        setIsSupported(true);
        
        // Check secure context
        if (window.isSecureContext) {
          console.log('Secure context confirmed for motion');
        } else {
          console.warn('Not in secure context - motion may not work');
          setDebug('HTTPS required for motion sensors');
        }
        
        // Add listener with options for better compatibility
        window.addEventListener('devicemotion', handleMotion, true);
        
        // For Android, immediately mark as permitted
        if (!/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          setPermissionGranted(true);
          setDebug('Waiting for device motion...');
        }
        
        return true;
      } else {
        console.log('DeviceMotionEvent not supported');
        setDebug('Motion sensors not supported');
        return false;
      }
    };

    const supported = checkMotion();
    
    // Cleanup
    return () => {
      if (supported) {
        window.removeEventListener('devicemotion', handleMotion, true);
      }
    };
  }, [handleMotion]);

  return {
    acceleration,
    rotationRate,
    isSupported,
    permissionGranted,
    requestPermission,
    debug,
  };
};