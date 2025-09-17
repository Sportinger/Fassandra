import React from 'react';
import type { CueType } from '../../../types/cue';
import { CUE_TYPE_ICONS } from '../../../types/cue';
import type {
  SidebarScene,
  SidebarCue,
  SidebarComment,
  SidebarPanelState,
  SidebarTab,
} from '../hooks/useSidebarData';

interface ScenesTabProps {
  scenes: SidebarScene[];
  activeSceneId: string | null;
  onSelect: (scene: SidebarScene) => void;
}

const ScenesTab: React.FC<ScenesTabProps> = ({ scenes, activeSceneId, onSelect }) => (
  <div className="rs-tabpanel" role="tabpanel" id="rs-panel-scenes" aria-labelledby="rs-tab-scenes">
    <div className="rs-list">
      {scenes.map(scene => (
        <div
          key={scene.id}
          className={`rs-card clickable ${activeSceneId===scene.id ? 'active' : ''}`}
          onClick={() => onSelect(scene)}
        >
          <div className="rs-scene-row">
            <span className="rs-scene-number">Szene {scene.sceneNumber}</span>
            <span className="rs-scene-name">{scene.sceneName}</span>
          </div>
        </div>
      ))}
      {scenes.length === 0 && <div className="rs-empty">No scenes in this script yet.</div>}
    </div>
  </div>
);

interface CuesTabProps {
  cuesCollapsed: boolean;
  onToggleCollapsed: () => void;
  sidebarCues: SidebarCue[];
  cueFilters: Record<CueType, boolean>;
  onToggleCueFilter: (type: CueType) => void;
  activeCueId: string | null;
  setActiveCueId: (id: string | null) => void;
  expandedCueId: string | null;
  setExpandedCueId: (id: string | null) => void;
  sidebarPanel: SidebarPanelState;
  setSidebarPanel: React.Dispatch<React.SetStateAction<SidebarPanelState>>;
  cueDescriptions: Record<string, string>;
  setCueDescriptions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editor: any;
}

const CuesTab: React.FC<CuesTabProps> = ({
  cuesCollapsed,
  onToggleCollapsed,
  sidebarCues,
  cueFilters,
  onToggleCueFilter,
  activeCueId,
  setActiveCueId,
  expandedCueId,
  setExpandedCueId,
  sidebarPanel,
  setSidebarPanel,
  cueDescriptions,
  setCueDescriptions,
  editor,
}) => {
  const filtered = sidebarCues.filter(c => cueFilters[c.cueType as CueType]).sort((a,b) => a.y - b.y);

  const handleCueClick = (cueId: string) => {
    const el = document.querySelector('.cue-connection[data-cue-id="' + cueId + '"]');
    if (el) {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLElement).classList.add('hover-highlight');
      setTimeout(() => (el as HTMLElement).classList.remove('hover-highlight'), 800);
    }
    setActiveCueId(cueId);
    setExpandedCueId(prev => prev === cueId ? null : cueId);
  };

  const handleDescriptionChange = (cueId: string, text: string) => {
    setCueDescriptions(prev => ({ ...prev, [cueId]: text }));
  };

  return (
    <div className="rs-tabpanel" role="tabpanel" id="rs-panel-cues" aria-labelledby="rs-tab-cues">
      <div className="rs-section">
        <div className="rs-header">
          <span>Cues</span>
          <button onClick={onToggleCollapsed}>{cuesCollapsed ? '▸' : '▾'}</button>
        </div>
        {!cuesCollapsed && (
          <div className="rs-list">
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {(['light','video','sound','props'] as CueType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  className={`rs-chip ${cueFilters[t] ? 'active' : ''}`}
                  onClick={() => onToggleCueFilter(t)}
                  aria-pressed={cueFilters[t]}
                  title={t}
                >
                  <span aria-hidden>{CUE_TYPE_ICONS[t]}</span>
                </button>
              ))}
            </div>
            {filtered.map(c => (
              <div
                key={c.cueId}
                data-cue-id={c.cueId}
                className={`rs-card clickable ${activeCueId===c.cueId ? 'active' : ''}`}
                onClick={() => handleCueClick(c.cueId)}
              >
                <div className="rs-cue-row">
                  <span className="rs-cue-emoji" aria-hidden>{CUE_TYPE_ICONS[c.cueType as keyof typeof CUE_TYPE_ICONS] || '🎛️'}</span>
                  <span className="rs-cue-number">Q{c.cueNumber}</span>
                  <span
                    className={`rs-cue-name ${sidebarPanel && sidebarPanel.type==='cue' && sidebarPanel.cueId===c.cueId ? 'editable-hint' : ''}`}
                    contentEditable={Boolean(sidebarPanel && sidebarPanel.type==='cue' && sidebarPanel.cueId===c.cueId)}
                    suppressContentEditableWarning
                    data-cue-id={c.cueId}
                    onClick={(e) => {
                      if (sidebarPanel && sidebarPanel.type==='cue' && sidebarPanel.cueId===c.cueId) e.stopPropagation();
                    }}
                    onBlur={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      const newName = (el.innerText || '').trim();
                      if (editor) (editor as any).commands.updateCueById(c.cueId, { cueName: newName });
                    }}
                  >
                    {c.cueName || (c.cueType?.toUpperCase?.() || '')}
                  </span>
                  <button
                    className="rs-btn rs-cue-edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      const isEditing = !!(sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === c.cueId);
                      if (isEditing) {
                        try {
                          const el = document.querySelector(`.rs-cue-name[data-cue-id="${c.cueId}"]`) as HTMLElement | null;
                          const newName = (el?.innerText || '').trim();
                          if (editor) (editor as any).commands.updateCueById(c.cueId, { cueName: newName });
                        } catch {}
                        setSidebarPanel(null);
                      } else {
                        setSidebarPanel({ type: 'cue', cueId: c.cueId, cueType: c.cueType, cueNumber: c.cueNumber, cueName: c.cueName || '', draftName: c.cueName || '' });
                        setTimeout(() => {
                          try {
                            const el = document.querySelector(`.rs-cue-name[data-cue-id="${c.cueId}"]`) as HTMLElement | null;
                            if (el) {
                              el.focus();
                              const range = document.createRange();
                              range.selectNodeContents(el);
                              range.collapse(false);
                              const sel = window.getSelection();
                              sel?.removeAllRanges();
                              sel?.addRange(range);
                            }
                          } catch {}
                        }, 0);
                      }
                    }}
                  >
                    {(sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === c.cueId) ? 'Save' : 'Edit'}
                  </button>
                </div>
                {expandedCueId === c.cueId && (
                  <div className="rs-cue-details">
                    <div className="row"><span className="k">Type</span><span className="v">{c.cueType.toUpperCase()}</span></div>
                    <div className="row"><span className="k">Number</span><span className="v">{c.cueNumber}</span></div>
                    {c.cueName && <div className="row"><span className="k">Name</span><span className="v">{c.cueName}</span></div>}
                    {c.text && (
                      <div className="row">
                        <span className="k">Stichwort</span>
                        <span className="v">{"\u0022..." + c.text + "...\u0022"}</span>
                      </div>
                    )}
                  </div>
                )}
                {sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === c.cueId && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="rs-btn" onClick={(e) => { e.stopPropagation(); if (!editor) return; (editor as any).commands.startCueExtend?.(c.cueId); }}>Move Link</button>
                      <button className="rs-btn" style={{ color: '#dc2626', borderColor: '#7f1d1d' }} onClick={(e) => { e.stopPropagation(); if (!editor) return; (editor as any).commands.removeCueConnection(c.cueId); setSidebarPanel(null); }}>Delete</button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label style={{ display: 'block', fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Description (temporary, frontend only)</label>
                      <textarea
                        value={cueDescriptions[c.cueId] || ''}
                        onChange={(e) => handleDescriptionChange(c.cueId, e.target.value)}
                        placeholder="Add details for technicians, stage directions, timing…"
                        style={{ width: '100%', minHeight: 80, padding: 8, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {sidebarCues.length === 0 && <div style={{ opacity: 0.5, fontSize: 12 }}>No cues in this script yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
};

interface CommentsTabProps {
  commentsCollapsed: boolean;
  onToggleCollapsed: () => void;
  sidebarComments: SidebarComment[];
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  sidebarPanel: SidebarPanelState;
  setSidebarPanel: React.Dispatch<React.SetStateAction<SidebarPanelState>>;
  editor: any;
}

const CommentsTab: React.FC<CommentsTabProps> = ({
  commentsCollapsed,
  onToggleCollapsed,
  sidebarComments,
  activeCommentId,
  setActiveCommentId,
  sidebarPanel,
  setSidebarPanel,
  editor,
}) => (
  <div className="rs-tabpanel" role="tabpanel" id="rs-panel-comments" aria-labelledby="rs-tab-comments">
    <div className="rs-section">
      <div className="rs-header">
        <span>Comments</span>
        <button onClick={onToggleCollapsed}>{commentsCollapsed ? '▸' : '▾'}</button>
      </div>
      {!commentsCollapsed && (
        <div className="rs-list">
          {sidebarComments.map(cm => (
            <div
              key={cm.id}
              className={`rs-card ${activeCommentId===cm.id ? 'active' : ''}`}
              data-comment-id={cm.id}
              onMouseEnter={() => {
                document.querySelectorAll(`.comment-annotation[data-comment-id="${cm.id}"]`).forEach(el => {
                  el.classList.add('connected-highlight');
                });
              }}
              onMouseLeave={() => {
                document.querySelectorAll(`.comment-annotation[data-comment-id="${cm.id}"]`).forEach(el => {
                  el.classList.remove('connected-highlight');
                });
              }}
              onClick={() => {
                const el = document.querySelector(`.comment-annotation[data-comment-id="${cm.id}"]`) as HTMLElement | null;
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('connected-highlight');
                  setTimeout(() => el.classList.remove('connected-highlight'), 800);
                }
                setActiveCommentId(cm.id);
              }}
            >
              <div className="rs-comment">
                <div className="rs-avatar">💬</div>
                <div className="content">
                  <div className="name">Comment</div>
                  <div className="text">{cm.text || 'No text yet'}</div>
                  {(sidebarPanel && sidebarPanel.type === 'comment' && sidebarPanel.id === cm.id) ? (
                    <div style={{ marginTop: 8 }}>
                      <textarea value={(sidebarPanel as any).draft} onChange={(e) => setSidebarPanel(p => p && p.type === 'comment' ? { ...p, draft: e.target.value } : p)} style={{ width: '100%', minHeight: 90, padding: 8, borderRadius: 6, border: '1px solid var(--color-border)' }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="rs-btn primary" onClick={() => { if (!editor) return; (editor as any).commands.updateCommentById(cm.id, { commentText: (sidebarPanel as any).draft }); setSidebarPanel(null); }}>Save</button>
                        <button className="rs-btn" style={{ color: '#dc2626', borderColor: '#7f1d1d' }} onClick={() => { if (!editor) return; (editor as any).commands.removeCommentById(cm.id); setSidebarPanel(null); }}>Delete</button>
                      </div>
                    </div>
                  ) : (
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button className="rs-btn" onClick={(e) => { e.stopPropagation(); setSidebarPanel(prev => (prev && prev.type==='comment' && prev.id===cm.id) ? null : { type: 'comment', id: cm.id, draft: cm.text }); }}>Edit</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {sidebarComments.length === 0 && <div style={{ opacity: 0.5, fontSize: 12 }}>No comments yet.</div>}
        </div>
      )}
    </div>
  </div>
);

interface RightSidebarProps {
  open: boolean;
  onToggleOpen: () => void;
  tab: SidebarTab;
  setTab: (tab: SidebarTab) => void;
  scenes: SidebarScene[];
  activeSceneId: string | null;
  setActiveSceneId: (id: string | null) => void;
  sidebarPanel: SidebarPanelState;
  setSidebarPanel: React.Dispatch<React.SetStateAction<SidebarPanelState>>;
  cuesCollapsed: boolean;
  setCuesCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarCues: SidebarCue[];
  cueFilters: Record<CueType, boolean>;
  setCueFilters: React.Dispatch<React.SetStateAction<Record<CueType, boolean>>>;
  activeCueId: string | null;
  setActiveCueId: (id: string | null) => void;
  expandedCueId: string | null;
  setExpandedCueId: React.Dispatch<React.SetStateAction<string | null>>;
  cueDescriptions: Record<string, string>;
  setCueDescriptions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  commentsCollapsed: boolean;
  setCommentsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarComments: SidebarComment[];
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  editor: any;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  open,
  onToggleOpen,
  tab,
  setTab,
  scenes,
  activeSceneId,
  setActiveSceneId,
  sidebarPanel,
  setSidebarPanel,
  cuesCollapsed,
  setCuesCollapsed,
  sidebarCues,
  cueFilters,
  setCueFilters,
  activeCueId,
  setActiveCueId,
  expandedCueId,
  setExpandedCueId,
  cueDescriptions,
  setCueDescriptions,
  commentsCollapsed,
  setCommentsCollapsed,
  sidebarComments,
  activeCommentId,
  setActiveCommentId,
  editor,
}) => {
  const handleSceneSelect = (scene: SidebarScene) => {
    const sceneNodes = document.querySelectorAll('[data-type="scene-block"]');
    const target = sceneNodes[scene.index] as HTMLElement | undefined;
    if (target) {
      sceneNodes.forEach(node => {
        if (node instanceof HTMLElement) {
          node.classList.remove('sidebar-scene-highlight');
        }
      });
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('sidebar-scene-highlight');
      window.setTimeout(() => target.classList.remove('sidebar-scene-highlight'), 1200);
    }
    setActiveSceneId(scene.id);
    setSidebarPanel(null);
  };

  const toggleCueFilter = (type: CueType) => {
    setCueFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div className={`rightSidebar ${open ? 'open' : 'collapsed'}`}>
      <div
        className="rightSidebarToggle"
        role="button"
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        title={open ? 'Collapse' : 'Expand'}
        onClick={onToggleOpen}
      >
        {open ? '<' : '>'}
      </div>
      {open && (
        <div className="rightSidebarInner">
          <div className="rs-tablist" role="tablist" aria-label="Sidebar sections">
            <button
              type="button"
              id="rs-tab-scenes"
              role="tab"
              aria-selected={tab === 'scenes'}
              aria-controls="rs-panel-scenes"
              className={`rs-tab ${tab === 'scenes' ? 'active' : ''}`}
              onClick={() => setTab('scenes')}
            >
              Szenen
            </button>
            <button
              type="button"
              id="rs-tab-cues"
              role="tab"
              aria-selected={tab === 'cues'}
              aria-controls="rs-panel-cues"
              className={`rs-tab ${tab === 'cues' ? 'active' : ''}`}
              onClick={() => setTab('cues')}
            >
              Cues
            </button>
            <button
              type="button"
              id="rs-tab-comments"
              role="tab"
              aria-selected={tab === 'comments'}
              aria-controls="rs-panel-comments"
              className={`rs-tab ${tab === 'comments' ? 'active' : ''}`}
              onClick={() => setTab('comments')}
            >
              Comments
            </button>
          </div>

          {tab === 'scenes' && (
            <ScenesTab
              scenes={scenes}
              activeSceneId={activeSceneId}
              onSelect={handleSceneSelect}
            />
          )}

          {tab === 'cues' && (
            <CuesTab
              cuesCollapsed={cuesCollapsed}
              onToggleCollapsed={() => setCuesCollapsed(v => !v)}
              sidebarCues={sidebarCues}
              cueFilters={cueFilters}
              onToggleCueFilter={toggleCueFilter}
              activeCueId={activeCueId}
              setActiveCueId={setActiveCueId}
              expandedCueId={expandedCueId}
              setExpandedCueId={setExpandedCueId}
              sidebarPanel={sidebarPanel}
              setSidebarPanel={setSidebarPanel}
              cueDescriptions={cueDescriptions}
              setCueDescriptions={setCueDescriptions}
              editor={editor}
            />
          )}

          {tab === 'comments' && (
            <CommentsTab
              commentsCollapsed={commentsCollapsed}
              onToggleCollapsed={() => setCommentsCollapsed(v => !v)}
              sidebarComments={sidebarComments}
              activeCommentId={activeCommentId}
              setActiveCommentId={setActiveCommentId}
              sidebarPanel={sidebarPanel}
              setSidebarPanel={setSidebarPanel}
              editor={editor}
            />
          )}
        </div>
      )}
    </div>
  );
};
