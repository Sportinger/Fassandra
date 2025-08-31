import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { Editor as TipTapEditor } from '@tiptap/react';
import { CUE_TYPE_ICONS } from '../../../types/cue';

type FloatingCueKey = string; // `${cueType}#${cueNumber}`

interface FloatingCueItem {
  key: FloatingCueKey;
  cueType: string;
  cueNumber: string;
  top: number; // relative to .singlePageContainer
  left: number; // relative to .singlePageContainer
}

interface FloatingCuesLayerProps {
  editor: TipTapEditor | null;
  // Optional: place badges to the right of the connected word by this many pixels
  offsetX?: number;
  offsetY?: number;
  // Optional: toggle visibility (default: true)
  visible?: boolean;
}

// Helper: find first DOM element per unique cue (type+number)
function collectCueAnchors(_container: HTMLElement | null): Array<{ el: HTMLElement; cueType: string; cueNumber: string }>{
  // We intentionally query the whole document for cue-connection spans,
  // because they live inside the editor DOM. Positioning will be done
  // relative to the provided container later.
  const nodes = Array.from(document.querySelectorAll('.cue-connection[data-cue-type][data-cue-number]')) as HTMLElement[];
  const seen = new Set<string>();
  const anchors: Array<{ el: HTMLElement; cueType: string; cueNumber: string }> = [];
  for (const el of nodes) {
    const cueType = el.getAttribute('data-cue-type') || '';
    const cueNumber = el.getAttribute('data-cue-number') || '';
    if (!cueType || !cueNumber) continue;
    const key = `${cueType}#${cueNumber}`;
    if (seen.has(key)) continue; // Keep first occurrence as anchor
    seen.add(key);
    anchors.push({ el, cueType, cueNumber });
  }
  return anchors;
}

export const FloatingCuesLayer: React.FC<FloatingCuesLayerProps> = ({ editor, offsetX = 8, offsetY = -20, visible = true }) => {
  const [items, setItems] = useState<FloatingCueItem[]>([]);

  const computePositions = useCallback(() => {
    const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop || 0; // container rarely scrolls; window scroll is in rects

    const anchors = collectCueAnchors(container);
    const next: FloatingCueItem[] = [];
    for (const { el, cueType, cueNumber } of anchors) {
      const r = el.getBoundingClientRect();
      const top = (r.top - containerRect.top) + scrollTop + offsetY;
      const left = (r.right - containerRect.left) + 8 + 0; // right side of word + small gap
      next.push({ key: `${cueType}#${cueNumber}`, cueType, cueNumber, top, left });
    }
    setItems(next);
  }, [offsetY]);

  // Recompute on editor updates
  useEffect(() => {
    if (!editor) return;
    const update = () => computePositions();
    editor.on('update', update);
    // Also reposition after selection changes which may reflow marks
    editor.on('selectionUpdate', update);
    // Initial compute after mount
    const id = window.setTimeout(computePositions, 50);
    return () => {
      window.clearTimeout(id);
      editor.off('update', update);
      editor.off('selectionUpdate', update);
    };
  }, [editor, computePositions]);

  // Recompute on resize/scroll
  useEffect(() => {
    const onResize = () => computePositions();
    const onScroll = () => computePositions();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true); // capture container/window scrolls
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [computePositions]);

  if (!visible) return null;

  return (
    <div className="floating-cues-layer" aria-hidden>
      {items.map(item => (
        <div
          key={item.key}
          className={`floating-cue floating-cue-${item.cueType}`}
          style={{ position: 'absolute', top: `${item.top}px`, left: `${item.left}px` }}
          title={`${item.cueType.toUpperCase()} Q${item.cueNumber}`}
        >
          <span className="floating-cue-icon" aria-hidden>{CUE_TYPE_ICONS[item.cueType as keyof typeof CUE_TYPE_ICONS] || '🎛️'}</span>
          <span className="floating-cue-number">Q{item.cueNumber}</span>
        </div>
      ))}
    </div>
  );
};

export default FloatingCuesLayer;

