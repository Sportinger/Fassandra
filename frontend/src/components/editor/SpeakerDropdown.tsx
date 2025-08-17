import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Editor as EditorInstance } from '@tiptap/react';
import './styles/toolbar.css';

import logger from '../../services/LoggingService';
interface SpeakerDropdownProps {
  editor: EditorInstance | null;
  speakerNames: Set<string>;
  isVisible: boolean;
  onSpeakerChange?: (newSpeaker: string, oldSpeaker: string) => boolean;
}

export const SpeakerDropdown: React.FC<SpeakerDropdownProps> = ({
  editor,
  speakerNames,
  isVisible,
  onSpeakerChange
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
      const { $from } = selection;
      
      // Find the dialogue block first, then the speaker within it
      let speakerPos = null;
      let speakerNode = null;
      
      // Walk up to find the dialogue block
      for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === 'dialogueBlock') {
          // Found dialogue block, now find the speaker node within it
          const blockStart = depth === 0 ? 0 : $from.start(depth);
          
          node.forEach((child, offset) => {
            if (child.type.name === 'speaker') {
              speakerPos = blockStart + offset + 1; // +1 to get inside the node
              speakerNode = child;
            }
          });
          break;
        } else if (node.type.name === 'speaker') {
          // Directly in a speaker node
          speakerPos = $from.start(depth);
          speakerNode = node;
          break;
        }
      }
      
      if (speakerPos !== null && speakerNode) {
        // Calculate the exact position to replace text
        const from = speakerPos;
        const to = from + speakerNode.content.size;
        
        // Replace the speaker content
        editor.chain()
          .focus()
          .setTextSelection({ from, to })
          .insertContent(speakerName)
          .run();
        
        setCurrentSpeaker(speakerName);
        setIsOpen(false);
        
        // Notify parent component about speaker change
        if (onSpeakerChange) {
          onSpeakerChange(speakerName, currentSpeaker);
        }
      } else {
        logger.warn('SpeakerDropdown', 'Could not find speaker node to update');
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

  // Memoize speaker list calculation to avoid re-sorting on every render
  const allSpeakers = useMemo(() => {
    // Convert Set to sorted array for display
    const speakerList = Array.from(speakerNames).sort();
    
    // Add "New Speaker" option and current speaker if not in list
    return [
      ...speakerList,
      ...(speakerList.includes(currentSpeaker) ? [] : [currentSpeaker]),
      '+ New Speaker'
    ];
  }, [speakerNames, currentSpeaker]);

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
        <div className="dropdownMenu">
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
          
          {allSpeakers.length === 0 && (
            <div className="dropdownItem">
              No speakers found in script
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 