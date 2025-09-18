import React from 'react';
import type { Editor as EditorInstance } from '@tiptap/react';
import type { SidebarComment, SidebarPanelState } from '../../hooks/useSidebarData';
import { useCommentCardActions } from './hooks/useCommentCardActions';

interface CommentsTabProps {
  commentsCollapsed: boolean;
  onToggleCollapsed: () => void;
  sidebarComments: SidebarComment[];
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  sidebarPanel: SidebarPanelState;
  setSidebarPanel: React.Dispatch<React.SetStateAction<SidebarPanelState>>;
  editor: EditorInstance | null;
}

export const CommentsTab: React.FC<CommentsTabProps> = ({
  commentsCollapsed,
  onToggleCollapsed,
  sidebarComments,
  activeCommentId,
  setActiveCommentId,
  sidebarPanel,
  setSidebarPanel,
  editor,
}) => {
  const {
    toggleCommentHighlight,
    focusComment,
    toggleCommentEditing,
    saveComment,
    deleteComment,
    isEditingComment,
  } = useCommentCardActions({
    editor,
    setActiveCommentId,
    sidebarPanel,
    setSidebarPanel,
  });

  return (
  <div className="rs-tabpanel" role="tabpanel" id="rs-panel-comments" aria-labelledby="rs-tab-comments">
    <div className="rs-section">
      <div className="rs-header">
        <span>Comments</span>
        <button onClick={onToggleCollapsed}>{commentsCollapsed ? '▸' : '▾'}</button>
      </div>
      {!commentsCollapsed && (
        <div className="rs-list">
          {sidebarComments.map(comment => {
            const isEditing = isEditingComment(comment.id);
            const draft = isEditing && sidebarPanel?.type === 'comment' ? sidebarPanel.draft : '';

            return (
            <div
              key={comment.id}
              className={`rs-card ${activeCommentId === comment.id ? 'active' : ''}`}
              data-comment-id={comment.id}
              onMouseEnter={() => toggleCommentHighlight(comment.id, true)}
              onMouseLeave={() => toggleCommentHighlight(comment.id, false)}
              onClick={() => focusComment(comment.id)}
            >
              <div className="rs-comment">
                <div className="rs-avatar">💬</div>
                <div className="content">
                  <div className="name">Comment</div>
                  <div className="text">{comment.text || 'No text yet'}</div>
                  {isEditing ? (
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        value={draft}
                        onChange={event =>
                          setSidebarPanel(prev =>
                            prev && prev.type === 'comment' ? { ...prev, draft: event.target.value } : prev,
                          )
                        }
                        style={{ width: '100%', minHeight: 90, padding: 8, borderRadius: 6, border: '1px solid var(--color-border)' }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          className="rs-btn primary"
                          onClick={() => saveComment(comment.id, draft)}
                        >
                          Save
                        </button>
                        <button
                          className="rs-btn"
                          style={{ color: '#dc2626', borderColor: '#7f1d1d' }}
                          onClick={() => deleteComment(comment.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button
                        className="rs-btn"
                        onClick={event => {
                          event.stopPropagation();
                          toggleCommentEditing(comment.id, comment.text);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
          })}
          {sidebarComments.length === 0 && <div style={{ opacity: 0.5, fontSize: 12 }}>No comments yet.</div>}
        </div>
      )}
    </div>
  </div>
  );
};

export default CommentsTab;
