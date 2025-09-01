import React, { useEffect, useRef, useState } from 'react';

interface RulerOverlayProps {
  active: boolean;
  onClose?: () => void;
}

export const RulerOverlay: React.FC<RulerOverlayProps> = ({ active, onClose }) => {
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState<number | null>(null);
  const [startInnerWidth, setStartInnerWidth] = useState<number>(0);
  const [dragMode, setDragMode] = useState<'left' | 'right' | 'center' | null>(null);
  const [frame, setFrame] = useState<number>(0); // force re-render during live drag
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  // Load persisted padding on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('editor.contentPaddingX');
      if (saved) document.documentElement.style.setProperty('--content-padding-x', `${Number(saved)}px`);
    } catch {}
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);

  const applyPad = (px: number, save: boolean) => {
    const v = Math.max(8, Math.min(200, Math.round(px)));
    document.documentElement.style.setProperty('--content-padding-x', `${v}px`);
    if (save) {
      try { localStorage.setItem('editor.contentPaddingX', String(v)); } catch {}
    }
  };

  const applyDragDelta = (dx: number) => {
    if (!dragging || startX == null) return;
    // Drag mapping by mode
    //  - right zone: natural (drag right -> widen content)
    //  - left/center zone: inverted (drag right -> narrow content)
    const delta = 2 * dx;
    let newInnerWidth =
      dragMode === 'right'
        ? startInnerWidth + delta
        : startInnerWidth - delta;
    const page = document.querySelector('.dinA4Page') as HTMLElement | null;
    const pageRect = page?.getBoundingClientRect();
    const pageWidth = pageRect?.width || 0;
    const maxInner = pageWidth - 16; // keep at least 8px padding each side
    const minInner = 120; // minimal readable width
    newInnerWidth = Math.max(minInner, Math.min(maxInner, newInnerWidth));
    const newPad = (pageWidth - newInnerWidth) / 2;
    applyPad(newPad, false);
    setFrame((f) => f + 1);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging || startX == null) return;
    const dx = e.clientX - startX;
    applyDragDelta(dx);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!dragging || startX == null) return;
    if (e.touches.length === 0) return;
    const dx = e.touches[0].clientX - startX;
    e.preventDefault();
    applyDragDelta(dx);
  };

  const handleMouseUp = () => {
    if (!dragging) return;
    // Save final value
    const cs = getComputedStyle(document.documentElement);
    const val = cs.getPropertyValue('--content-padding-x');
    let px = 0;
    if (val.endsWith('px')) px = parseFloat(val);
    applyPad(px, true);
    setDragging(false);
    setStartX(null);
    setDragMode(null);
    onClose?.();
  };

  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => handleMouseMove(e);
    const onUp = () => handleMouseUp();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', handleTouchMove as any);
      window.removeEventListener('touchend', onUp);
    };
  }, [active, dragging, startX, startInnerWidth]);

  if (!active) return null;

  // Read current geometry
  const page = document.querySelector('.dinA4Page') as HTMLElement | null;
  const inner = page?.querySelector('.pageInner') as HTMLElement | null;
  const pageRect = page?.getBoundingClientRect();
  const innerRect = inner?.getBoundingClientRect();

  if (!pageRect || !innerRect) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
  };

  const containerEl = document.querySelector('.singlePageContainer') as HTMLElement;
  const containerRect = containerEl.getBoundingClientRect();
  const innerCS = getComputedStyle(inner);
  const padL = parseFloat(innerCS.paddingLeft || '0') || 0;
  const padR = parseFloat(innerCS.paddingRight || '0') || 0;
  const barLeft = innerRect.left + padL - containerRect.left;   // left text edge
  const barRight = innerRect.right - padR - containerRect.left; // right text edge
  // Place bar at current viewport center within page bounds
  const viewMidAbs = window.scrollY + window.innerHeight / 2;
  const pageTopAbs = pageRect.top + window.scrollY;
  const pageBottomAbs = pageRect.bottom + window.scrollY;

  // Compute a tall hit area ~ 4 lines of text
  const cs = getComputedStyle(inner);
  const fontSize = parseFloat(cs.fontSize || '16') || 16;
  const lineHeight = (() => { const lh = cs.lineHeight; return lh === 'normal' ? 1.5 * fontSize : parseFloat(lh || '24'); })();
  const barHeight = Math.max(4 * lineHeight, 56);

  // Clamp bar center within page vertical range, then convert to container coordinates
  const clampedCenterAbs = Math.max(pageTopAbs + barHeight / 2, Math.min(pageBottomAbs - barHeight / 2, viewMidAbs));
  const containerTopAbs = containerRect.top + window.scrollY;
  const barTop = clampedCenterAbs - containerTopAbs - barHeight / 2;
  // Mobile central grip sizing
  const gripWidth = Math.min(320, Math.max(200, containerRect.width * 0.7));
  const gripLeft = Math.max(8, (containerRect.width - gripWidth) / 2);

  return (
    <div className="ruler-overlay" ref={containerRef} style={overlayStyle} onClick={(e) => { e.stopPropagation(); }}>
      {/* Dim the page area */}
      <div
        className="ruler-scrim"
        style={{
          position: 'absolute', left: pageRect.left, width: pageRect.width, top: pageRect.top,
          height: pageRect.height, background: 'rgba(0,0,0,0.08)', pointerEvents: 'none'
        }}
      />
      {/* Central double-arrow bar spanning the text width */}
      <div
        className="ruler-bar"
        style={{ position: 'absolute', top: barTop, left: barLeft, width: barRight - barLeft, height: barHeight, pointerEvents: 'auto', cursor: 'ew-resize' }}
        onMouseDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          setDragging(true);
          setStartX(e.clientX);
          setStartInnerWidth(barRight - barLeft);
          setDragMode('center');
        }}
        onTouchStart={(e) => {
          e.preventDefault(); e.stopPropagation();
          const x = e.touches && e.touches[0] ? e.touches[0].clientX : 0;
          setDragging(true);
          setStartX(x);
          setStartInnerWidth(barRight - barLeft);
          setDragMode('center');
        }}
      >
        {/* Separate drag zones near arrows */}
        {(() => {
          const totalW = barRight - barLeft;
          const zoneW = Math.min(220, Math.max(120, totalW * 0.22));
          return (
            <>
              <span
                className="drag-zone left"
                style={{ position: 'absolute', left: 0, top: 0, width: zoneW, height: '100%' }}
                onMouseDown={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  setDragging(true);
                  setStartX(e.clientX);
                  setStartInnerWidth(totalW);
                  setDragMode('left');
                }}
                onTouchStart={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  const x = e.touches && e.touches[0] ? e.touches[0].clientX : 0;
                  setDragging(true);
                  setStartX(x);
                  setStartInnerWidth(totalW);
                  setDragMode('left');
                }}
              />
              <span
                className="drag-zone right"
                style={{ position: 'absolute', right: 0, top: 0, width: zoneW, height: '100%' }}
                onMouseDown={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  setDragging(true);
                  setStartX(e.clientX);
                  setStartInnerWidth(totalW);
                  setDragMode('right');
                }}
                onTouchStart={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  const x = e.touches && e.touches[0] ? e.touches[0].clientX : 0;
                  setDragging(true);
                  setStartX(x);
                  setStartInnerWidth(totalW);
                  setDragMode('right');
                }}
              />
            </>
          );
        })()}
        {/* Left arrow icon (4x size) */}
        <span className="bar-icon left" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
            <path d="M13 9a1 1 0 0 1-1-1V5.061a1 1 0 0 0-1.811-.75l-6.835 6.836a1.207 1.207 0 0 0 0 1.707l6.835 6.835a1 1 0 0 0 1.811-.75V16a1 1 0 0 1 1-1h2a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1z"/>
            <path d="M20 9v6"/>
          </svg>
        </span>
        {/* Right arrow icon (4x size) */}
        <span className="bar-icon right" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
            <path d="M11 9a1 1 0 0 0 1-1V5.061a1 1 0 0 1 1.811-.75l6.836 6.836a1.207 1.207 0 0 1 0 1.707l-6.836 6.835a1 1 0 0 1-1.811-.75V16a1 1 0 0 0-1-1H9a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"/>
            <path d="M4 9v6"/>
          </svg>
        </span>
      </div>
      {/* Mobile-only central grip area: keeps arrows at edges but puts draggable zone in the visible middle */}
      {isMobile && (
        <div
          className="ruler-center-grip"
          aria-label="Adjust page width"
          style={{
            position: 'absolute',
            top: barTop,
            left: gripLeft,
            width: gripWidth,
            height: barHeight,
            pointerEvents: 'auto',
            cursor: 'ew-resize',
            borderRadius: 10,
            background: 'rgba(100,108,255,0.08)',
            border: '1px dashed rgba(100,108,255,0.4)'
          }}
          onMouseDown={(e) => {
            e.preventDefault(); e.stopPropagation();
            setDragging(true);
            setStartX(e.clientX);
            setStartInnerWidth(barRight - barLeft);
            setDragMode('center');
          }}
          onTouchStart={(e) => {
            e.preventDefault(); e.stopPropagation();
            const x = e.touches && e.touches[0] ? e.touches[0].clientX : 0;
            setDragging(true);
            setStartX(x);
            setStartInnerWidth(barRight - barLeft);
            setDragMode('center');
          }}
        />
      )}
    </div>
  );
};

export default RulerOverlay;
