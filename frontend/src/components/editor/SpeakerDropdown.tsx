import React, { useState, useRef, useEffect } from 'react';
import { Editor as EditorInstance } from '@tiptap/react';
import styles from './Editor.module.css';

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
        console.warn('Failed to get current speaker:', error);
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

    console.log(`[SpeakerDropdown] Setting speaker to: ${speakerName}`);
    
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
      console.error('Failed to set speaker:', error);
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
    <div className={styles.speakerDropdownContainer} ref={dropdownRef}>
      <button
        ref={buttonRef}
        className={`${styles.toolbarButton} ${isOpen ? styles.active : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Select Speaker"
      >
        🗣️ {currentSpeaker}
      </button>
      
      {isOpen && (
        <div className={styles.speakerDropdown}>
          <div className={styles.speakerDropdownHeader}>
            Select Speaker:
          </div>
          
          {allSpeakers.map((speaker, index) => (
            <button
              key={index}
              className={`${styles.speakerDropdownItem} ${
                speaker === currentSpeaker ? styles.active : ''
              } ${speaker === '+ New Speaker' ? styles.newSpeaker : ''}`}
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
            <div className={styles.speakerDropdownEmpty}>
              No speakers found in script
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 