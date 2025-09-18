import React from 'react';
import type { Editor as EditorInstance } from '@tiptap/react';
import { FontSizeDropdown } from '../../FontSizeDropdown';
import { CueDropdown } from '../../CueDropdown';
import { SearchBox } from '../../SearchBox';
import { CueTypeDropdown } from '../../CueTypeDropdown';
import { SpeakerDropdown } from '../../SpeakerDropdown';
import { SpeakerColorPicker } from '../../SpeakerColorPicker';
import { FontStyleDropdown } from '../../FontStyleDropdown';
import { DialogueLayoutDropdown } from '../../DialogueLayoutDropdown';
import { ViewModeDropdown } from '../../ViewModeDropdown';
import { RulerAdjustDropdown } from '../../RulerAdjustDropdown';
import type { ToolbarButton } from './toolbarButtons';
import type { CueType } from '../../../../types/cue';
import type { ViewMode } from '../../types';

export interface RenderToolbarButtonArgs {
  button: ToolbarButton;
  editor: EditorInstance | null;
  isVisible: boolean;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  currentCueType: CueType;
  speakerNames: Set<string>;
}

export const renderToolbarButton = ({
  button,
  editor,
  isVisible,
  viewMode,
  onSetViewMode,
  currentCueType,
  speakerNames,
}: RenderToolbarButtonArgs): React.ReactNode => {
  const editorInstance = editor as EditorInstance | null;

  if (!button.isSpecial) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={button.action}
          className={['toolbarButton', button.isActive ? 'active' : '']
            .filter(Boolean)
            .join(' ')}
          title={button.title}
          type="button"
        >
          <span className="icon">
            {typeof button.icon === 'string' ? button.icon : button.icon}
          </span>
        </button>
      </div>
    );
  }

  switch (button.id) {
    case 'font-size':
      return <FontSizeDropdown editor={editorInstance as any} isVisible={isVisible} />;
    case 'cue-dropdown':
      return <CueDropdown editor={editorInstance as any} isVisible={isVisible} />;
    case 'search-box':
      return <SearchBox editor={editorInstance as any} isVisible={isVisible} />;
    case 'cue-type-dropdown':
      return <CueTypeDropdown editor={editorInstance as any} isVisible={isVisible} currentCueType={currentCueType} />;
    case 'speaker-dropdown':
      return <SpeakerDropdown editor={editorInstance as any} isVisible={isVisible} speakerNames={speakerNames} />;
    case 'speaker-color-picker':
      return <SpeakerColorPicker editor={editorInstance as any} isVisible={isVisible} />;
    case 'font-style':
      return <FontStyleDropdown editor={editorInstance as any} isVisible={isVisible} />;
    case 'dialogue-layout-dropdown':
      return <DialogueLayoutDropdown editor={editorInstance as any} isVisible={isVisible} />;
    case 'view-mode-dropdown':
      return <ViewModeDropdown viewMode={viewMode} onSetViewMode={onSetViewMode} />;
    case 'ruler-adjust':
      return <RulerAdjustDropdown />;
    default:
      return null;
  }
};
