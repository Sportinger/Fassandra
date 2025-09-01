import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';

// Renders children into document.body to avoid stacking/transform issues on iOS Safari
// Exposes the container element via ref so callers can use it in click-outside checks.
export interface MobilePortalProps {
  children: React.ReactNode;
}

export const MobilePortal = forwardRef<HTMLDivElement, MobilePortalProps>(({ children }, ref) => {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  if (!elRef.current) {
    elRef.current = document.createElement('div');
    // Ensure highest stacking by default; callers can still control inner elements
    elRef.current.style.position = 'fixed';
    elRef.current.style.left = '0';
    elRef.current.style.right = '0';
    elRef.current.style.top = 'auto';
    elRef.current.style.zIndex = '4000';
  }

  useImperativeHandle(ref, () => elRef.current as HTMLDivElement, []);

  useEffect(() => {
    const el = elRef.current as HTMLDivElement;
    document.body.appendChild(el);
    setMounted(true);
    return () => {
      try { document.body.removeChild(el); } catch { /* ignore */ }
    };
  }, []);

  if (!mounted) return null;
  return createPortal(children, elRef.current as HTMLDivElement);
});

MobilePortal.displayName = 'MobilePortal';
