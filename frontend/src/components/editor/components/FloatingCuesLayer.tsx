import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { Editor as TipTapEditor } from '@tiptap/react';
import { CUE_TYPE_ICONS } from '../../../types/cue';

type FloatingCueKey = string; // cueId

interface FloatingCueItem {
  key: FloatingCueKey;
  cueId: string;
  cueType: string;
  cueNumber: string;
  cueName?: string | null;
  top: number; // relative to .singlePageContainer
  left: number; // relative to .singlePageContainer
}

interface FloatingCuesLayerProps {
  editor: TipTapEditor | null;
  // Optional: place badges to the right of the connected word by this many pixels
  offsetY?: number;
  // Optional: toggle visibility (default: true)
  visible?: boolean;
  // Optional: external open handler (e.g., right sidebar)
  onOpenCue?: (payload: { cueId: string; cueType: string; cueNumber: string; cueName?: string | null }) => void;
}

// Helper: find first DOM element per unique cue (type+number)
function collectCueAnchors(_container: HTMLElement | null): Array<{ el: HTMLElement; cueId: string; cueType: string; cueNumber: string; cueName?: string | null }>{
  // 🔧 PERFORMANCE: Query only within ProseMirror editor instead of entire document
  const editorEl = document.querySelector('.ProseMirror') as HTMLElement | null;
  if (!editorEl) return [];

  const nodes = Array.from(editorEl.querySelectorAll('.cue-connection[data-cue-type][data-cue-number]')) as HTMLElement[];
  const seen = new Set<string>();
  const anchors: Array<{ el: HTMLElement; cueId: string; cueType: string; cueNumber: string; cueName?: string | null }> = [];
  for (const el of nodes) {
    const cueId = el.getAttribute('data-cue-id') || '';
    const cueType = el.getAttribute('data-cue-type') || '';
    const cueNumber = el.getAttribute('data-cue-number') || '';
    const cueName = el.getAttribute('data-cue-name');
    if (!cueId || !cueType) continue;
    const key = cueId; // dedupe by cueId (unique cue)
    if (seen.has(key)) continue; // Keep first occurrence as anchor
    seen.add(key);
    anchors.push({ el, cueId, cueType, cueNumber, cueName });
  }
  return anchors;
}

export const FloatingCuesLayer: React.FC<FloatingCuesLayerProps> = ({ editor, offsetY = -20, visible = true, onOpenCue }) => {
  const [items, setItems] = useState<FloatingCueItem[]>([]);

  const computePositions = useCallback(() => {
    // 🔧 PERFORMANCE: Skip computation if not visible
    if (!visible) return;

    const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop || 0; // container rarely scrolls; window scroll is in rects

    const anchors = collectCueAnchors(container);
    // Get content bounds to place badges in the right margin
    const page = (container.querySelector('.dinA4Page') || container.querySelector('.borderlessPanel')) as HTMLElement | null;
    const inner = (page?.querySelector('.pageInner') as HTMLElement | null) || (container.querySelector('.borderlessPanel .pageInner') as HTMLElement | null);
    const refRect = (inner || page)?.getBoundingClientRect() || containerRect;
    const cs = inner ? getComputedStyle(inner) : null;
    const padR = cs ? (parseFloat(cs.paddingRight || '0') || 0) : 0;
    const rightEdge = (refRect.right - padR) - containerRect.left; // relative to container content edge
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const sideOffset = isMobile ? -12 : 16; // on mobile, tuck slightly inside the page edge
    type Temp = FloatingCueItem & { rawTop: number; col: number };
    const temps: Temp[] = [];
    for (const { el, cueId, cueType, cueNumber, cueName } of anchors) {
      const r = el.getBoundingClientRect();
      const rawTop = (r.top - containerRect.top) + scrollTop + offsetY;
      const left = rightEdge + sideOffset; // base column
      temps.push({ key: cueId, cueId, cueType, cueNumber, cueName, top: rawTop, left, rawTop, col: 0 });
    }
    // Sort by raw top
    temps.sort((a, b) => a.rawTop - b.rawTop);
    // Group into bands by vertical proximity, then assign horizontal columns within a band
    const band = 14; // px tolerance to treat as same row
    const groups: Array<{ items: Temp[]; y: number }> = [];
    for (const t of temps) {
      let g = groups.find(gr => Math.abs(gr.y - t.rawTop) <= band);
      if (!g) {
        g = { items: [], y: t.rawTop };
        groups.push(g);
      }
      t.col = g.items.length; // assign next column index
      g.items.push(t);
    }
    // Apply vertical spacing (optional) and horizontal offsets
    const minGap = 18;
    const hShift = 22; // px horizontal shift between columns (disabled on mobile)
    // Flatten in order and adjust positions
    const out: FloatingCueItem[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      // Keep group y; ensure non-overlap with previous group vertically
      let baseTop = g.y;
      if (out.length > 0) {
        const prev = out[out.length - 1];
        if (baseTop - prev.top < minGap) baseTop = prev.top + minGap;
      }
      for (const t of g.items) {
        const top = baseTop; // same row baseline
        const left = (rightEdge + sideOffset) + (isMobile ? 0 : t.col * hShift);
        out.push({ key: t.key, cueId: t.cueId, cueType: t.cueType, cueNumber: t.cueNumber, cueName: t.cueName, top, left });
      }
    }
    setItems(out);
  }, [offsetY, visible]);

  // 🔧 PERFORMANCE: Throttle updates and use requestIdleCallback for zero-latency typing
  const scheduleAsyncUpdate = useCallback(() => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => computePositions(), { timeout: 1000 });
    } else {
      // Fallback: debounce
      setTimeout(computePositions, 300);
    }
  }, [computePositions]);

  // Recompute on editor updates (async to avoid blocking typing)
  useEffect(() => {
    if (!editor) return;
    editor.on('update', scheduleAsyncUpdate);
    // Selection updates can be immediate since they don't happen during typing
    editor.on('selectionUpdate', computePositions);
    // Initial compute after mount
    const id = window.setTimeout(computePositions, 50);
    return () => {
      window.clearTimeout(id);
      editor.off('update', scheduleAsyncUpdate);
      editor.off('selectionUpdate', computePositions);
    };
  }, [editor, scheduleAsyncUpdate, computePositions]);

  // Recompute on resize/scroll
  useEffect(() => {
    // 🔧 PERFORMANCE: Throttle scroll to 60fps (16ms) and debounce resize
    let scrollTimeout: number | undefined;
    const onScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = window.setTimeout(() => {
        computePositions();
        scrollTimeout = undefined;
      }, 16);
    };

    let resizeTimeout: number | undefined;
    const onResize = () => {
      if (resizeTimeout) window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(computePositions, 150);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true); // capture container/window scrolls
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      if (scrollTimeout) window.clearTimeout(scrollTimeout);
      if (resizeTimeout) window.clearTimeout(resizeTimeout);
    };
  }, [computePositions]);

  if (!visible) return null;

  // Popover state
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>('');
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  const openFor = (cueId: string, currentName: string | null | undefined) => {
    setOpenId(cueId);
    setDraftName(currentName || '');
  };

  const closePopover = () => setOpenId(null);

  const jumpTo = (cueId: string) => {
    const el = document.querySelector(`.cue-connection[data-cue-id="${cueId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('hover-highlight');
      setTimeout(() => el.classList.remove('hover-highlight'), 1000);
    }
  };

  const saveName = (cueId: string) => {
    if (!editor) return;
    (editor as any).commands.updateCueById(cueId, { cueName: draftName });
    setOpenId(null);
  };

  const removeCue = (cueId: string) => {
    if (!editor) return;
    (editor as any).commands.removeCueConnection(cueId);
    setOpenId(null);
  };

  const extendCue = (cueId: string) => {
    if (!editor) return;
    (editor as any).commands.startCueExtend?.(cueId);
    setOpenId(null);
  };

  const setType = (cueId: string, cueType: string) => {
    if (!editor) return;
    (editor as any).commands.updateCueById(cueId, { cueType });
  };

  return (
    <div className="floating-cues-layer" aria-hidden>
      {items.map(item => {
        const isOpen = openId === item.cueId;
        return (
          <div
            key={item.key}
            style={{
              position: 'absolute',
              top: `${item.top}px`,
              left: `${item.left}px`,
              zIndex: openId === item.cueId || hoverId === item.cueId ? 999 : 1,
            }}
            onMouseEnter={() => setHoverId(item.cueId)}
            onMouseLeave={() => setHoverId(prev => (prev === item.cueId ? null : prev))}
          >
            <div
              className={`floating-cue floating-cue-${item.cueType}`}
              title={`${item.cueType.toUpperCase()} Q${item.cueNumber || ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenCue) {
                  onOpenCue({ cueId: item.cueId, cueType: item.cueType, cueNumber: item.cueNumber, cueName: item.cueName });
                } else {
                  openFor(item.cueId, item.cueName);
                }
              }}
            >
              <span className="floating-cue-icon" aria-hidden>{CUE_TYPE_ICONS[item.cueType as keyof typeof CUE_TYPE_ICONS] || '🎛️'}</span>
              <span className="floating-cue-number">Q{item.cueNumber}</span>
              {item.cueName ? <span className="floating-cue-name">{item.cueName}</span> : null}
            </div>
            {!onOpenCue && isOpen && (
              isMobile ? (
                <div className="floating-cue-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                  <div className="popover-inner">
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      {(['light','video','sound','props'] as const).map(t => (
                        <button
                          key={t}
                          className={`cue-type-chip ${t === item.cueType ? 'active' : ''}`}
                          type="button"
                          onClick={() => setType(item.cueId, t)}
                          title={`Set type: ${t}`}
                        >{CUE_TYPE_ICONS[t]}</button>
                      ))}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <input
                        className="floating-cue-input"
                        placeholder="Cue name"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                      />
                    </div>
                    <div className="popover-actions">
                      <button type="button" onClick={() => saveName(item.cueId)}>Save</button>
                      <button type="button" onClick={() => jumpTo(item.cueId)}>Jump</button>
                      <button type="button" onClick={() => extendCue(item.cueId)}>Move Link</button>
                      <button type="button" onClick={() => removeCue(item.cueId)} style={{ color: '#dc2626' }}>Delete</button>
                      <button type="button" onClick={closePopover}>Close</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="floating-cue-popover"
                  style={{ position: 'absolute', top: '0', right: '100%', marginRight: 8, zIndex: 10 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="popover-inner">
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      {(['light','video','sound','props'] as const).map(t => (
                        <button
                          key={t}
                          className={`cue-type-chip ${t === item.cueType ? 'active' : ''}`}
                          type="button"
                          onClick={() => setType(item.cueId, t)}
                          title={`Set type: ${t}`}
                        >{CUE_TYPE_ICONS[t]}</button>
                      ))}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <input
                        className="floating-cue-input"
                        placeholder="Cue name"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                      />
                    </div>
                    <div className="popover-actions">
                      <button type="button" onClick={() => saveName(item.cueId)}>Save</button>
                      <button type="button" onClick={() => jumpTo(item.cueId)}>Jump</button>
                      <button type="button" onClick={() => extendCue(item.cueId)}>Move Link</button>
                      <button type="button" onClick={() => removeCue(item.cueId)} style={{ color: '#dc2626' }}>Delete</button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        );
      })}
      {openId && (
        <div className="floating-cues-backdrop" onClick={closePopover} />
      )}
    </div>
  );
};

export default FloatingCuesLayer;
