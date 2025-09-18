import React from 'react';
import type { CueType } from '../../../types/cue';
import type {
  SidebarScene,
  SidebarCue,
  SidebarComment,
  SidebarPanelState,
  SidebarTab,
} from '../hooks/useSidebarData';
import { ScenesTab } from './right-sidebar/ScenesTab';
import { CuesTab } from './right-sidebar/CuesTab';
import { CommentsTab } from './right-sidebar/CommentsTab';

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
