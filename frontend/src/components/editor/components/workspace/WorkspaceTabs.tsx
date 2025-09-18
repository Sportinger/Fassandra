import React from 'react';
import type { WorkspaceMode } from './types';

interface WorkspaceTabsProps {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
}

const TAB_CONFIG: Array<{ mode: WorkspaceMode; label: string; description: string }> = [
  { mode: 'editor', label: 'Editor', description: 'Write & collaborate' },
  { mode: 'calendar', label: 'Calendar', description: 'Schedule & rehearsals' },
  { mode: 'scenes', label: 'Scenes', description: 'Cast & cue overview' },
];

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({ mode, onChange }) => {
  return (
    <div className="workspace-mode-tabs" role="tablist" aria-label="Workspace modes">
      {TAB_CONFIG.map((tab) => (
        <button
          key={tab.mode}
          type="button"
          role="tab"
          aria-selected={mode === tab.mode}
          className={`workspace-mode-tab ${mode === tab.mode ? 'active' : ''}`}
          onClick={() => onChange(tab.mode)}
        >
          <span className="workspace-mode-tab-label">{tab.label}</span>
          <span className="workspace-mode-tab-description">{tab.description}</span>
        </button>
      ))}
    </div>
  );
};

export default WorkspaceTabs;
