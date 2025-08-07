import React, { useState, useRef, useEffect } from 'react';
import { useCssTilt } from '../../../hooks/useCssTilt';
import styles from './ScriptCreator.module.css';

interface ScriptCreatorProps {
  onCreate: (name: string) => Promise<void>;
  onUploadClick: () => void;
}

export const ScriptCreator: React.FC<ScriptCreatorProps> = ({ onCreate, onUploadClick }) => {
  const [state, setState] = useState<'plus' | 'options' | 'input'>('plus');
  const [scriptName, setScriptName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const tilt = useCssTilt();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setState('plus');
        setScriptName('');
      }
    };

    if (state !== 'plus') {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [state]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scriptName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await onCreate(scriptName.trim());
      setScriptName('');
      setState('plus');
    } catch (error) {
      console.error('Failed to create script:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePlusClick = () => {
    setState('options');
  };

  const handleCreateOption = () => {
    setState('input');
  };

  return (
    <div className={styles.cardWrapper}>
      <div 
        ref={(el) => {
          containerRef.current = el;
          tilt.ref.current = el;
        }}
        className={`${styles.scriptSlot} ${styles.addSlot} ${styles.tiltCard}`}
        onClick={state === 'plus' ? handlePlusClick : undefined}
        onMouseMove={tilt.onMouseMove}
        onMouseEnter={tilt.onMouseEnter}
        onMouseLeave={tilt.onMouseLeave}
      >
        {state === 'plus' && (
          <div className={styles.addIcon}>+</div>
        )}

        {state === 'options' && (
          <div className={styles.optionsContainer}>
            <button 
              onClick={handleCreateOption}
              className={styles.optionButton}
            >
              Create New Script
            </button>
            <button 
              onClick={onUploadClick}
              className={styles.optionButton}
            >
              Upload Script
            </button>
          </div>
        )}
        
        {state === 'input' && (
          <form onSubmit={handleCreate} className={styles.createForm}>
            <input
              type="text"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
              placeholder="New script name"
              autoFocus
              required
              disabled={isCreating}
              className={styles.nameInput}
            />
            <button 
              type="submit" 
              disabled={isCreating}
              className={styles.createButton}
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};