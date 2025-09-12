import React, { useCallback, useEffect, useState } from 'react';
import type { Editor as TipTapEditor } from '@tiptap/react';

interface CommentItem {
  id: string;
  top: number;
  left: number;
  text: string;
}

interface FloatingCommentsLayerProps {
  editor: TipTapEditor | null;
  onOpenComment?: (payload: { id: string; text: string }) => void;
}

export const FloatingCommentsLayer: React.FC<FloatingCommentsLayerProps> = ({ editor, onOpenComment }) => {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [panel, setPanel] = useState<{ id: string | null; left: number; top: number; width: number }>({ id: null, left: 0, top: 0, width: 0 });

  const compute = useCallback(() => {
    const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
    const page = (document.querySelector('.dinA4Page') || document.querySelector('.borderlessPanel')) as HTMLElement | null;
    const inner = (page?.querySelector('.pageInner') as HTMLElement | null) || (document.querySelector('.borderlessPanel .pageInner') as HTMLElement | null);
    if (!container || !page || !inner) return;
    const containerRect = container.getBoundingClientRect();
    const innerRect = inner.getBoundingClientRect();
    const innerCS = getComputedStyle(inner);
    const padR = parseFloat(innerCS.paddingRight || '0') || 0;
    const rightEdge = (innerRect.right - padR) - containerRect.left; // match cue overlay positioning
    const scrollTop = container.scrollTop || 0;
    const seen = new Set<string>();
    const out: CommentItem[] = [];
    document.querySelectorAll('.comment-annotation[data-comment-id]').forEach((el) => {
      const span = el as HTMLElement;
      const id = span.getAttribute('data-comment-id') || '';
      if (!id || seen.has(id)) return;
      seen.add(id);
      const r = span.getBoundingClientRect();
      const top = (r.top - containerRect.top) + scrollTop - 20; // align with cue offset
      const text = span.getAttribute('data-comment-text') || '';
      out.push({ id, top, left: rightEdge + 16, text });
    });
    out.sort((a, b) => a.top - b.top);
    // nudge to avoid overlap (match cues spacing ~22px)
    const gap = 22;
    for (let i = 1; i < out.length; i++) if (out[i].top - out[i-1].top < gap) out[i].top = out[i-1].top + gap;
    setItems(out);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const update = () => compute();
    editor.on('update', update);
    editor.on('selectionUpdate', update);
    const id = window.setTimeout(compute, 50);
    return () => { window.clearTimeout(id); editor.off('update', update); editor.off('selectionUpdate', update); };
  }, [editor, compute]);

  useEffect(() => {
    const onResize = () => compute();
    const onScroll = () => compute();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll, true); };
  }, [compute]);

  // Open comment from external event
  useEffect(() => {
    const handler = (e: any) => {
      setOpenId(e.detail?.commentId || null);
      setDraft(e.detail?.commentText || '');
    };
    window.addEventListener('fassandra:open-comment', handler as any);
    return () => window.removeEventListener('fassandra:open-comment', handler as any);
  }, []);

  const save = (id: string) => {
    if (!editor) return;
    (editor as any).commands.updateCommentById(id, { commentText: draft });
    setOpenId(null);
    setPanel({ id: null, left: 0, top: 0, width: 0 });
  };
  const remove = (id: string) => {
    if (!editor) return;
    (editor as any).commands.removeCommentById(id);
    setOpenId(null);
    setPanel({ id: null, left: 0, top: 0, width: 0 });
  };

  const [preview, setPreview] = useState<{x:number; y:number; text:string|null}>({x:0,y:0,text:null});

  const highlight = (id: string, on: boolean) => {
    document.querySelectorAll(`.comment-annotation[data-comment-id="${id}"]`).forEach((el) => {
      el.classList.toggle('connected-highlight', on);
    });
  };

  return (
    <div className="floating-comments-layer" aria-hidden>
      {items.map(it => (
        <div key={it.id} style={{ position: 'absolute', top: it.top, left: it.left, zIndex: 5 }}>
          <div
            className="floating-comment"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenComment) {
                onOpenComment({ id: it.id, text: it.text || '' });
              } else {
                setOpenId(it.id);
                setDraft(it.text || '');
                // highlight while editing
                highlight(it.id, true);
                // compute panel under the highlighted range with same width
                const container = document.querySelector('.singlePageContainer') as HTMLElement | null;
                const anchor = document.querySelector(`.comment-annotation[data-comment-id="${it.id}"]`) as HTMLElement | null;
                if (container && anchor) {
                  const cr = container.getBoundingClientRect();
                  const ar = anchor.getBoundingClientRect();
                  const top = (ar.bottom - cr.top) + (container.scrollTop || 0) + 6;
                  const left = (ar.left - cr.left);
                  const width = ar.width;
                  setPanel({ id: it.id, left, top, width });
                }
              }
            }}
            onMouseEnter={() => { highlight(it.id, true); setPreview(p => ({...p, text: it.text || ''})); }}
            onMouseLeave={() => { highlight(it.id, false); setPreview({x:0,y:0,text:null}); }}
            onMouseMove={(e) => { setPreview({ x: e.clientX + 12, y: e.clientY + 12, text: it.text || '' }); }}
            title="Open comment"
          >
            <span className="icon" aria-hidden>💬</span>
          </div>
        </div>
      ))}
      {!onOpenComment && panel.id && (
        <div className="comment-popover" style={{ position: 'absolute', top: panel.top, left: panel.left, width: panel.width, zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
          <div className="inner">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment..." />
            <div className="actions">
              <button onClick={() => panel.id && save(panel.id)}>Save</button>
              <button onClick={() => panel.id && remove(panel.id)} style={{ color: '#dc2626' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {preview.text && (
        <div className="comment-hover-preview" style={{ left: preview.x, top: preview.y }}>
          {preview.text}
        </div>
      )}
    </div>
  );
};

export default FloatingCommentsLayer;
