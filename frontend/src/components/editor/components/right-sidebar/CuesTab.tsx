import React from 'react';
import type { Editor as EditorInstance } from '@tiptap/react';
import type { CueType } from '../../../../types/cue';
import { CUE_TYPE_ICONS } from '../../../../types/cue';
import type { SidebarCue, SidebarPanelState } from '../../hooks/useSidebarData';
import { useCueCardActions } from './hooks/useCueCardActions';

interface CuesTabProps {
  cuesCollapsed: boolean;
  onToggleCollapsed: () => void;
  sidebarCues: SidebarCue[];
  cueFilters: Record<CueType, boolean>;
  onToggleCueFilter: (type: CueType) => void;
  activeCueId: string | null;
  setActiveCueId: (id: string | null) => void;
  expandedCueId: string | null;
  setExpandedCueId: React.Dispatch<React.SetStateAction<string | null>>;
  sidebarPanel: SidebarPanelState;
  setSidebarPanel: React.Dispatch<React.SetStateAction<SidebarPanelState>>;
  cueDescriptions: Record<string, string>;
  setCueDescriptions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editor: EditorInstance | null;
}

export const CuesTab: React.FC<CuesTabProps> = ({
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
  const filtered = sidebarCues
    .filter(c => cueFilters[c.cueType as CueType])
    .sort((a, b) => a.y - b.y);

  const {
    handleCueClick,
    handleDescriptionChange,
    toggleCueEditing,
    moveCueLink,
    deleteCueConnection,
  } = useCueCardActions({
    editor,
    sidebarPanel,
    setSidebarPanel,
    setActiveCueId,
    setExpandedCueId,
    setCueDescriptions,
  });

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
              {(['light', 'video', 'sound', 'props'] as CueType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  className={`rs-chip ${cueFilters[type] ? 'active' : ''}`}
                  onClick={() => onToggleCueFilter(type)}
                  aria-pressed={cueFilters[type]}
                  title={type}
                >
                  <span aria-hidden>{CUE_TYPE_ICONS[type]}</span>
                </button>
              ))}
            </div>
            {filtered.map(cue => (
              <div
                key={cue.cueId}
                data-cue-id={cue.cueId}
                className={`rs-card clickable ${activeCueId === cue.cueId ? 'active' : ''}`}
                onClick={() => {
                  // Don't toggle expansion if in edit mode
                  if (sidebarPanel?.type === 'cue' && sidebarPanel.cueId === cue.cueId) {
                    return;
                  }
                  handleCueClick(cue.cueId);
                }}
              >
                <div className="rs-cue-row">
                  <span className="rs-cue-emoji" aria-hidden>
                    {CUE_TYPE_ICONS[cue.cueType as keyof typeof CUE_TYPE_ICONS] || '🎛️'}
                  </span>
                  <span
                    className={`rs-cue-number ${sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === cue.cueId ? 'editable-hint' : ''}`}
                    contentEditable={Boolean(sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === cue.cueId)}
                    suppressContentEditableWarning
                    onClick={event => {
                      if (sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === cue.cueId) {
                        event.stopPropagation();
                      }
                    }}
                    onBlur={event => {
                      const element = event.currentTarget as HTMLElement;
                      let newNumber = (element.innerText || '').replace('Q', '').trim();
                      const oldNumber = cue.cueNumber;

                      if (newNumber !== oldNumber) {
                        // Update both CueBlock and all CueConnectionMarks
                        (editor as any)?.commands.updateCueBlockAndConnections?.(
                          cue.cueType,
                          oldNumber,
                          newNumber,
                          true
                        );
                      }

                      // Ensure Q prefix is shown
                      if (newNumber && !element.innerText?.startsWith('Q')) {
                        element.innerText = `Q${newNumber}`;
                      }
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        (event.currentTarget as HTMLElement).blur();
                      }
                    }}
                  >
                    Q{cue.cueNumber}
                  </span>
                  <span
                    className={`rs-cue-name ${sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === cue.cueId ? 'editable-hint' : ''}`}
                    contentEditable={Boolean(sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === cue.cueId)}
                    suppressContentEditableWarning
                    data-cue-id={cue.cueId}
                    onClick={event => {
                      if (sidebarPanel && sidebarPanel.type === 'cue' && sidebarPanel.cueId === cue.cueId) {
                        event.stopPropagation();
                      }
                    }}
                    onBlur={event => {
                      const element = event.currentTarget as HTMLElement;
                      const newName = (element.innerText || '').trim();
                      (editor as any)?.commands.updateCueById?.(cue.cueId, { cueName: newName });
                    }}
                  >
                    {cue.cueName || cue.cueType?.toUpperCase?.() || ''}
                  </span>
                  <button
                    className="rs-btn rs-cue-edit"
                    onClick={event => {
                      event.stopPropagation();
                      toggleCueEditing(cue);
                    }}
                  >
                    {sidebarPanel?.type === 'cue' && sidebarPanel.cueId === cue.cueId ? 'Save' : 'Edit'}
                  </button>
                </div>
                {expandedCueId === cue.cueId && (
                  <div className="rs-cue-details">
                    <div className="row">
                      <span className="k">Type</span>
                      <span className="v">{cue.cueType.toUpperCase()}</span>
                    </div>
                    <div className="row">
                      <span className="k">Number</span>
                      <span className="v">{cue.cueNumber}</span>
                    </div>
                    {cue.cueName && (
                      <div className="row">
                        <span className="k">Name</span>
                        <span className="v">{cue.cueName}</span>
                      </div>
                    )}
                    {cue.text && (
                      <div className="row">
                        <span className="k">Stichwort</span>
                        <span className="v">{"\u0022..." + cue.text + "...\u0022"}</span>
                      </div>
                    )}
                  </div>
                )}
                {sidebarPanel?.type === 'cue' && sidebarPanel.cueId === cue.cueId && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="rs-btn"
                        onClick={event => {
                          event.stopPropagation();
                          moveCueLink(cue.cueId);
                        }}
                      >
                        Move Link
                      </button>
                      <button
                        className="rs-btn"
                        style={{ color: '#dc2626', borderColor: '#7f1d1d' }}
                        onClick={event => {
                          event.stopPropagation();
                          deleteCueConnection(cue.cueId);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label style={{ display: 'block', fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                        Description (temporary, frontend only)
                      </label>
                      <textarea
                        value={cueDescriptions[cue.cueId] || ''}
                        onChange={event => handleDescriptionChange(cue.cueId, event.target.value)}
                        placeholder="Add details for technicians, stage directions, timing…"
                        style={{
                          width: '100%',
                          minHeight: 80,
                          padding: 8,
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          background: 'transparent',
                          color: 'var(--color-text)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {sidebarCues.length === 0 && (
              <div style={{ opacity: 0.5, fontSize: 12 }}>No cues in this script yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CuesTab;
