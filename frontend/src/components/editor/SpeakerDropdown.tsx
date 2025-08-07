import React, { useState, useRef, useEffect } from 'react';
import { Editor as EditorInstance } from '@tiptap/react';
import './styles/toolbar.css';

import logger from '../../services/LoggingService';
interface SpeakerDropdownProps {
  editor: EditorInstance | null;
  speakerNames: Set<string>;
  isVisible: boolean;
}

export const SpeakerDropdown: React.FC<SpeakerDropdownProps> = ({
  editor,
  speakerNames,
  isVisible
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState('Speaker');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get current speaker name from selection
  useEffect(() => {
    if (!editor || !isVisible) return;

    const updateCurrentSpeaker = () => {
      try {
        const { selection } = editor.state;
        const { $from } = selection;
        
        // Find the speaker node
        for (let depth = $from.depth; depth > 0; depth--) {
          const node = $from.node(depth);
          if (node.type.name === 'speaker') {
            const speakerText = node.textContent.trim();
            setCurrentSpeaker(speakerText || 'Speaker');
            return;
          }
        }
      } catch (error) {
        logger.warn('SpeakerDropdown', 'Failed to get current speaker:', error);
      }
    };

    updateCurrentSpeaker();
    editor.on('selectionUpdate', updateCurrentSpeaker);
    
    return () => {
      editor.off('selectionUpdate', updateCurrentSpeaker);
    };
  }, [editor, isVisible]);

  // Handle speaker selection
  const handleSpeakerSelect = (speakerName: string) => {
    if (!editor) return;

    logger.debug('SpeakerDropdown', `[SpeakerDropdown] Setting speaker to: ${speakerName}`);
    
    try {
      const { selection } = editor.state;
      const { $from, $to } = selection;
      
      // Find the speaker node and replace its content
      for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === 'speaker') {
          const speakerStart = $from.start(depth);
          const speakerEnd = $from.end(depth);
          
          // Replace the speaker content
          editor.chain()
            .focus()
            .setTextSelection({ from: speakerStart, to: speakerEnd })
            .insertContent(speakerName)
            .run();
          
          setCurrentSpeaker(speakerName);
          setIsOpen(false);
          return;
        }
      }
    } catch (error) {
      logger.error('SpeakerDropdown', 'Failed to set speaker:', error);
    }
  };

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

  // Close dropdown when component becomes invisible
  useEffect(() => {
    if (!isVisible) {
      setIsOpen(false);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  // Convert Set to sorted array for display
  const speakerList = Array.from(speakerNames).sort();
  
  // Add "New Speaker" option and current speaker if not in list
  const allSpeakers = [
    ...speakerList,
    ...(speakerList.includes(currentSpeaker) ? [] : [currentSpeaker]),
    '+ New Speaker'
  ];

  return (
    <div className="dropdownContainer" ref={dropdownRef}>
      <button
        ref={buttonRef}
        className={`toolbarButton dropdownButton ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Select Speaker"
      >
        <span className="label">🗣️ {currentSpeaker}</span>
        <span className="arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="dropdownMenu dropdownMenuLeft">
          <div className="dropdownHeader">
            Select Speaker:
          </div>
          
          {allSpeakers.map((speaker, index) => (
            <button
              key={index}
              className={`dropdownItem ${
                speaker === currentSpeaker ? 'active' : ''
              } ${speaker === '+ New Speaker' ? 'special' : ''}`}
              onClick={() => {
                if (speaker === '+ New Speaker') {
                  const newSpeaker = prompt('Enter new speaker name:');
                  if (newSpeaker && newSpeaker.trim()) {
                    handleSpeakerSelect(newSpeaker.trim());
                  }
                } else {
                  handleSpeakerSelect(speaker);
                }
              }}
            >
              {speaker === '+ New Speaker' ? '➕ New Speaker' : speaker}
            </button>
          ))}
          
          {speakerList.length === 0 && (
            <div className="dropdownItem">
              No speakers found in script
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 