import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { Editor as TipTapEditor } from '@tiptap/react';

type Point = { x: number; y: number };

function cueColorForType(t?: string): string {
  switch ((t || '').toLowerCase()) {
    case 'light': return '#fbbf24';
    case 'video': return '#3b82f6';
    case 'sound': return '#22c55e';
    case 'props': return '#a855f7';
    default: return '#dc2626';
  }
}

function getElCenter(el: HTMLElement): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function getElLeftMid(el: HTMLElement): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top + r.height / 2 };
}

export const CueConnectors: React.FC<{ editor: TipTapEditor | null; expandedCueId: string | null; visible?: boolean }>
  = ({ editor, expandedCueId, visible = true }) => {
  const [path, setPath] = useState<string>('');
  const [stroke, setStroke] = useState<string>('#dc2626');

  const recompute = useCallback(() => {
    if (!expandedCueId) { setPath(''); return; }
    const card = document.querySelector(`.rightSidebar [data-cue-id="${expandedCueId}"]`) as HTMLElement | null;
    const word = document.querySelector(`.cue-connection[data-cue-id="${expandedCueId}"]`) as HTMLElement | null;
    if (!card || !word) { setPath(''); return; }

    const cueType = word.getAttribute('data-cue-type') || undefined;
    setStroke(cueColorForType(cueType));

    // Points in viewport coordinates
    const start = getElLeftMid(card); // left edge of sidebar card
    // Target: left-bottom corner of the highlighted word box (slightly outside)
    const wr = word.getBoundingClientRect();
    const target = { x: wr.left - 2, y: wr.top + wr.height }; // a tiny 2px padding left of the box

    // Determine the left edge of the page content so we can make the elbow
    // BEFORE entering the page to avoid overlaying text while changing height.
    const pageInner = (document.querySelector('.dinA4Page .pageInner') as HTMLElement | null)
                   || (document.querySelector('.borderlessPanel .pageInner') as HTMLElement | null)
                   || (document.querySelector('.dinA4Page') as HTMLElement | null)
                   || (document.querySelector('.borderlessPanel') as HTMLElement | null);
    const pageRect = pageInner ? pageInner.getBoundingClientRect() : undefined;
    const pageLeft = pageRect ? pageRect.left : Math.min(start.x, target.x);
    const pageRight = pageRect ? pageRect.right : Math.max(start.x, target.x);
    const sidebar = document.querySelector('.rightSidebar') as HTMLElement | null;
    const sidebarLeft = sidebar ? sidebar.getBoundingClientRect().left : (pageRight + 240);

    // Build an orthogonal elbow path: start -> elbowX (same y) -> elbowX (target y) -> target
    // Choose elbowX to be just to the RIGHT of the page content so we enter the page at correct height
    // and then go horizontally LEFT into the word without crossing vertical text.
    // Place elbow in the middle of the gutter between page right and sidebar left
    let elbowX = (pageRight + sidebarLeft) / 2;
    // Ensure the elbow stays to the right of the word's left edge so we always approach from the right
    elbowX = Math.max(elbowX, target.x + 24);
    const p1 = { x: start.x - 8, y: start.y }; // small step out of card
    const p2 = { x: elbowX, y: start.y };
    const p3 = { x: elbowX, y: target.y };
    const p4 = { x: target.x, y: target.y };
    const d = `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y}`;
    setPath(d);
  }, [expandedCueId]);

  useEffect(() => {
    if (!visible) return;
    const onScroll = () => recompute();
    const onResize = () => recompute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    const id = window.setInterval(recompute, 200); // guard against layout shifts
    recompute();
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize); window.clearInterval(id); };
  }, [recompute, visible]);

  useEffect(() => {
    if (!editor || !visible) return;
    const cb = () => recompute();
    editor.on('update', cb);
    editor.on('selectionUpdate', cb);
    return () => { editor.off('update', cb); editor.off('selectionUpdate', cb); };
  }, [editor, recompute, visible]);

  if (!visible || !expandedCueId || !path) return null;

  // full-screen SVG overlay (pointer-events: none)
  return (
    <svg
      style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 1050 }}
      aria-hidden
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} shapeRendering="crispEdges" />
    </svg>
  );
};

export default CueConnectors;
