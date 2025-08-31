import React, { useEffect, useRef, useState } from 'react';

interface RulerOverlayProps {
  active: boolean;
  onClose?: () => void;
}

export const RulerOverlay: React.FC<RulerOverlayProps> = ({ active, onClose }) => {
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState<number | null>(null);
  const [startInnerWidth, setStartInnerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging || startX == null) return;
    const dx = e.clientX - startX;
    // Expand/contract inner width symmetrically: newWidth = startInnerWidth + 2*dx
    let newInnerWidth = startInnerWidth + 2 * dx;
    const page = document.querySelector('.dinA4Page') as HTMLElement | null;
    const pageRect = page?.getBoundingClientRect();
    const pageWidth = pageRect?.width || 0;
    const maxInner = pageWidth - 16; // keep at least 8px padding each side
    const minInner = 120; // minimal readable width
    newInnerWidth = Math.max(minInner, Math.min(maxInner, newInnerWidth));
    const newPad = (pageWidth - newInnerWidth) / 2;
    applyPad(newPad, false);
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
  };

  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => handleMouseMove(e);
    const onUp = () => handleMouseUp();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
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

  const containerRect = (document.querySelector('.singlePageContainer') as HTMLElement).getBoundingClientRect();
  const barLeft = innerRect.left - containerRect.left;
  const barRight = innerRect.right - containerRect.left;
  const barTop = pageRect.top - containerRect.top + Math.max(24, Math.min(pageRect.height - 24, innerRect.top - pageRect.top + innerRect.height / 2));

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
        style={{ position: 'absolute', top: barTop - 9, left: barLeft, width: barRight - barLeft, height: 18 }}
        onMouseDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          setDragging(true);
          setStartX(e.clientX);
          setStartInnerWidth(barRight - barLeft);
        }}
      >
        <span className="bar-line" />
        <span className="bar-arrow left" />
        <span className="bar-arrow right" />
      </div>
    </div>
  );
};

export default RulerOverlay;
