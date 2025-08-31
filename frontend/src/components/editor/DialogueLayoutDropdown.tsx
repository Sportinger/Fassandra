import React, { useState, useRef, useEffect } from 'react';
import { Editor as EditorInstance } from '@tiptap/react';
import './styles/toolbar.css';
import { LayoutListIcon } from './icons';
import logger from '../../services/LoggingService';

interface DialogueLayoutDropdownProps {
  editor: EditorInstance | null;
  isVisible: boolean;
  editAllSpeakers?: boolean;
  currentSpeakerName?: string | null;
}

type LayoutType = 'default' | 'side-by-side' | 'centered';

interface LayoutOption {
  id: LayoutType;
  icon: string;
  label: string;
  description: string;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'default',
    icon: '≡',
    label: 'Stacked',
    description: 'Text below speaker'
  },
  {
    id: 'side-by-side',
    icon: '⇥',
    label: 'Side by Side',
    description: 'Text right of speaker'
  },
  {
    id: 'centered',
    icon: '≈',
    label: 'Centered',
    description: 'Speaker and text centered'
  }
];

export const DialogueLayoutDropdown: React.FC<DialogueLayoutDropdownProps> = ({ 
  editor, 
  isVisible,
  editAllSpeakers = false,
  currentSpeakerName = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLayout, setCurrentLayout] = useState<LayoutType>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current layout from editor
  useEffect(() => {
    if (!editor) return;

    const updateLayout = () => {
      try {
        if (editor.isActive('dialogueBlock', { layout: 'side-by-side' })) {
          setCurrentLayout('side-by-side');
        } else if (editor.isActive('dialogueBlock', { layout: 'centered' })) {
          setCurrentLayout('centered');
        } else {
          setCurrentLayout('default');
        }
      } catch (error) {
        logger.warn('DialogueLayoutDropdown', 'Failed to get current layout:', error);
      }
    };

    editor.on('selectionUpdate', updateLayout);
    updateLayout();

    return () => {
      editor.off('selectionUpdate', updateLayout);
    };
  }, [editor]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLayoutSelect = (layout: LayoutType) => {
    if (!editor) return;
    
    logger.debug('DialogueLayoutDropdown', `Setting layout to ${layout} for ALL dialogue blocks`);
    
    // Update ALL dialogue blocks in the entire script
    const { state, view } = editor;
    const { tr } = state;
    let hasChanges = false;
    let blocksUpdated = 0;
    
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'dialogueBlock') {
        if (node.attrs.layout !== layout) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, layout });
          hasChanges = true;
          blocksUpdated++;
        }
      }
    });
    
    if (hasChanges) {
      view.dispatch(tr);
      logger.debug('DialogueLayoutDropdown', `Updated ${blocksUpdated} dialogue blocks to ${layout} layout`);
    }
    
    setCurrentLayout(layout);
    setIsOpen(false);
  };

  if (!isVisible) return null;

  const currentOption = LAYOUT_OPTIONS.find(opt => opt.id === currentLayout);

  return (
    <div ref={dropdownRef} className="dropdownContainer">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`toolbarButton dropdownButton ${isOpen ? 'open' : ''}`}
        type="button"
      >
        <span className="label"><LayoutListIcon /></span>
        <span className="arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="dropdownMenu" style={{ background: '#1a1a1a' }}>
          {LAYOUT_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleLayoutSelect(option.id)}
              className={`dropdownItem ${currentLayout === option.id ? 'active' : ''}`}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '12px',
                padding: '8px 12px'
              }}
            >
              <span style={{ fontSize: '1.2em' }}>{option.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>{option.label}</div>
                <div style={{ 
                  fontSize: '0.85em', 
                  opacity: 0.7,
                  marginTop: '2px'
                }}>
                  {option.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
