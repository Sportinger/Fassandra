import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

import logger from '../../../../../services/LoggingService';

interface ToolbarKeyboardState {
  windowWidth: number;
  keyboardHeight: number;
  keyboardManuallyShown: boolean;
  vvLeft: number;
  vvWidth: number;
  hiddenInputRef: React.MutableRefObject<HTMLInputElement | null>;
  toggleKeyboard: () => void;
}

const hasWindow = typeof window !== 'undefined';

/**
 * Centralises the floating toolbar's viewport/keyboard bookkeeping so the main
 * component can stay focused on rendering concerns.
 */
export const useToolbarKeyboard = (editor: Editor | null): ToolbarKeyboardState => {
  const initialWidth = hasWindow ? window.innerWidth : 1024;
  const [windowWidth, setWindowWidth] = useState(initialWidth);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardManuallyShown, setKeyboardManuallyShown] = useState(false);
  const [vvLeft, setVvLeft] = useState(() => (hasWindow && window.visualViewport ? window.visualViewport.offsetLeft : 0));
  const [vvWidth, setVvWidth] = useState(() => (hasWindow && window.visualViewport ? window.visualViewport.width : initialWidth));
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const suppressFocusScrollRef = useRef(false);

  // Close the keyboard when the user taps outside of the editor/toolbar on mobile.
  useEffect(() => {
    if (!hasWindow) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (!keyboardManuallyShown) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.ProseMirror') || target.closest('.floatingToolbar') || target.closest('.keyboardFab')) {
        return;
      }
      setKeyboardManuallyShown(false);
      hiddenInputRef.current?.blur();
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [keyboardManuallyShown]);

  // Hint the browser to suppress the soft keyboard until explicitly requested.
  useEffect(() => {
    if (!hasWindow) return;
    try {
      const isMobile = window.innerWidth <= 767;
      const pmEl: HTMLElement | null = document.querySelector('.ProseMirror');
      if (!pmEl) return;
      if (isMobile && !keyboardManuallyShown) {
        pmEl.setAttribute('inputmode', 'none');
        pmEl.setAttribute('autocomplete', 'off');
        pmEl.setAttribute('autocorrect', 'off');
        pmEl.setAttribute('autocapitalize', 'off');
      } else {
        pmEl.removeAttribute('inputmode');
        pmEl.removeAttribute('autocomplete');
        pmEl.removeAttribute('autocorrect');
        pmEl.removeAttribute('autocapitalize');
      }
    } catch {
      // No-op: attribute toggling is best-effort only.
    }
  }, [keyboardManuallyShown]);

  // Track window width for responsive decisions.
  useEffect(() => {
    if (!hasWindow) return;

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mobile virtual keyboard detection tuned for rehearsal devices.
  useEffect(() => {
    if (!hasWindow) return;
    if (windowWidth > 767) {
      setKeyboardHeight(0);
      return;
    }

    let initialViewportHeight = window.innerHeight;
    let initialVisualViewportHeight = window.visualViewport?.height || window.innerHeight;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isChromeMobile = /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);
    const isLandscape = window.innerWidth > window.innerHeight;
    const deviceType = isIOS ? (navigator.userAgent.includes('iPad') ? 'iPad' : 'iPhone') : 'Android';

    const detectKeyboard = () => {
      if (window.visualViewport) {
        const vv = window.visualViewport;
        const insetBottom = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
        const keyboardHeightCalculated = insetBottom > 50 ? insetBottom : 0;
        setVvLeft(vv.offsetLeft || 0);
        setVvWidth(vv.width || window.innerWidth);

        logger.debug('Toolbar', '[🎭 Mobile Keyboard] Visual Viewport detection:', {
          windowHeight: window.innerHeight,
          visualHeight: vv.height,
          offsetTop: vv.offsetTop,
          insetBottom,
          keyboardHeight: keyboardHeightCalculated,
          deviceType,
          isLandscape,
          isAndroid,
          isChromeMobile,
        });

        setKeyboardHeight(keyboardHeightCalculated);
      } else {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        const keyboardHeightCalculated = heightDifference > 100 ? heightDifference : 0;

        logger.debug('Toolbar', '[🎭 Mobile Keyboard] Fallback detection:', {
          initial: initialViewportHeight,
          current: currentHeight,
          keyboardHeight: keyboardHeightCalculated,
          isAndroid,
          isChromeMobile,
        });

        setKeyboardHeight(keyboardHeightCalculated);
      }
    };

    let detectTimeout: ReturnType<typeof setTimeout>;
    const debouncedDetect = () => {
      clearTimeout(detectTimeout);
      detectTimeout = setTimeout(detectKeyboard, 50);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', debouncedDetect, { passive: true } as any);
      window.visualViewport.addEventListener('scroll', debouncedDetect, { passive: true } as any);
    }

    window.addEventListener('resize', debouncedDetect);

    if (isIOS && isSafari) {
      const handleFocusIn = (event: FocusEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          setTimeout(() => {
            debouncedDetect();
            if (!suppressFocusScrollRef.current) {
              target.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
          }, 300);
        }
      };

      const handleFocusOut = () => {
        setTimeout(() => setKeyboardHeight(0), 300);
      };

      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);

      return () => {
        clearTimeout(detectTimeout);
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', debouncedDetect as any);
          window.visualViewport.removeEventListener('scroll', debouncedDetect as any);
        }
        window.removeEventListener('resize', debouncedDetect);
      };
    }

    const handleOrientationChange = () => {
      setTimeout(() => {
        initialViewportHeight = window.innerHeight;
        initialVisualViewportHeight = window.visualViewport?.height || window.innerHeight;
        setKeyboardHeight(0);
        setTimeout(debouncedDetect, 100);
      }, 500);
    };

    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      clearTimeout(detectTimeout);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', debouncedDetect);
        window.visualViewport.removeEventListener('scroll', debouncedDetect);
      }
      window.removeEventListener('resize', debouncedDetect);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [windowWidth]);

  const toggleKeyboard = useCallback(() => {
    if (!hasWindow) return;
    const isMobile = window.innerWidth <= 767;
    if (!isMobile) return;

    if (keyboardManuallyShown) {
      hiddenInputRef.current?.blur();
      setKeyboardManuallyShown(false);
      return;
    }

    suppressFocusScrollRef.current = true;
    const sx = window.scrollX;
    const sy = window.scrollY;
    try {
      (hiddenInputRef.current as any)?.focus?.({ preventScroll: true });
    } catch {
      hiddenInputRef.current?.focus();
    }
    setKeyboardManuallyShown(true);
    setTimeout(() => {
      try {
        if ((editor as any)?.chain) {
          (editor as any).chain().focus(undefined, { scrollIntoView: false }).run();
        } else {
          (editor as any)?.commands?.focus?.(null, { scrollIntoView: false });
        }
      } catch {
        (editor as any)?.commands?.focus?.();
      }
      try {
        window.scrollTo(sx, sy);
      } catch {
        // Ignore scroll restoration errors
      }
      setTimeout(() => { suppressFocusScrollRef.current = false; }, 300);
    }, 120);
  }, [editor, keyboardManuallyShown]);

  return useMemo(() => ({
    windowWidth,
    keyboardHeight,
    keyboardManuallyShown,
    vvLeft,
    vvWidth,
    hiddenInputRef,
    toggleKeyboard,
  }), [windowWidth, keyboardHeight, keyboardManuallyShown, vvLeft, vvWidth, toggleKeyboard]);
};
