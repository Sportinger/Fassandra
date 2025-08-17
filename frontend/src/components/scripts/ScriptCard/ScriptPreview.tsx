import React, { useEffect, useState, useCallback } from 'react';
import { getScriptWithBlocks, getContentSnapshot } from '../../../api';
import { Block } from '../../../types';
import styles from './ScriptPreview.module.css';
import logger from '../../../services/LoggingService';
import { scriptEventBus } from '../../../services/ScriptEventBus';

interface ScriptPreviewProps {
  scriptId: string;
}

export const ScriptPreview: React.FC<ScriptPreviewProps> = ({ scriptId }) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  const fetchScriptContent = useCallback(async (isInitial = false) => {
    try {
      // Only show loading state on initial load
      if (isInitial || !hasInitialLoad) {
        setLoading(true);
      }
      setError(null);
      const scriptData = await getScriptWithBlocks(scriptId);
      if (scriptData && scriptData.blocks && scriptData.blocks.length > 0) {
        // Sort blocks by page_number to show all content
        const sortedBlocks = scriptData.blocks
          .sort((a, b) => a.page_number - b.page_number);
        setBlocks(sortedBlocks);
      } else {
        // No blocks yet, try to get content snapshot
        try {
          const snapshot = await getContentSnapshot(scriptId);
          if (snapshot && snapshot.content) {
            // Parse HTML content and create preview blocks
            const parser = new DOMParser();
            const doc = parser.parseFromString(snapshot.content, 'text/html');
            const previewBlocks: Block[] = [];
            
            // Extract dialogue blocks
            const dialogueElements = doc.querySelectorAll('[data-dialogue-block]');
            dialogueElements.forEach((el, index) => {
              const speaker = el.querySelector('[data-speaker]')?.textContent || '';
              const text = el.querySelector('[data-dialogue-text]')?.textContent || el.textContent || '';
              if (speaker || text) {
                previewBlocks.push({
                  id: `snapshot-dialogue-${index}`,
                  script_id: scriptId,
                  block_type: 'dialogue',
                  content: JSON.stringify({ speaker: speaker || 'Speaker', line: text }),
                  created_at: snapshot.created_at || new Date().toISOString(),
                  page_number: 1
                });
              }
            });
            
            // If no structured content found, use plain text
            if (previewBlocks.length === 0) {
              const textContent = doc.body.textContent || '';
              if (textContent.trim()) {
                // Split into lines and create blocks
                const lines = textContent.split('\n').filter(line => line.trim());
                lines.slice(0, 10).forEach((line, index) => {
                  previewBlocks.push({
                    id: `snapshot-text-${index}`,
                    script_id: scriptId,
                    block_type: 'paragraph',
                    content: line.trim(),
                    created_at: snapshot.created_at || new Date().toISOString(),
                    page_number: 1
                  });
                });
              }
            }
            
            setBlocks(previewBlocks);
          } else {
            setBlocks([]);
          }
        } catch (snapshotErr) {
          // No snapshot either, keep empty
          setBlocks([]);
        }
      }
    } catch (err) {
      logger.error('ScriptPreview', 'Failed to fetch script content:', err);
      // For demo purposes, show mock data when API fails
      if (process.env.NODE_ENV === 'development') {
        setBlocks([
          {
            id: '1',
            script_id: scriptId,
            block_type: 'dialogue',
            content: '{"speaker":"HAMLET","line":"To be or not to be, that is the question"}',
            created_at: new Date().toISOString(),
            page_number: 1
          },
          {
            id: '2',
            script_id: scriptId,
            block_type: 'stage_direction',
            content: '{"description":"Enter OPHELIA"}',
            created_at: new Date().toISOString(),
            page_number: 1
          },
          {
            id: '3',
            script_id: scriptId,
            block_type: 'dialogue',
            content: '{"speaker":"OPHELIA","line":"My lord, I have remembrances of yours that I have longed long to re-deliver"}',
            created_at: new Date().toISOString(),
            page_number: 1
          },
          {
            id: '4',
            script_id: scriptId,
            block_type: 'monologue',
            content: '{"speaker":"HAMLET","lines":["Whether tis nobler in the mind to suffer","The slings and arrows of outrageous fortune","Or to take arms against a sea of troubles"]}',
            created_at: new Date().toISOString(),
            page_number: 1
          }
        ]);
        setError(null);
      } else {
        setError('Failed to load preview');
      }
    } finally {
      setLoading(false);
      setHasInitialLoad(true);
    }
  }, [scriptId, hasInitialLoad]);

  useEffect(() => {
    // Initial fetch
    fetchScriptContent(true);
  }, [scriptId]); // Only re-fetch when scriptId changes
  
  useEffect(() => {
    // Set up periodic refresh for empty scripts
    if (blocks.length === 0 && hasInitialLoad) {
      const intervalId = setInterval(() => {
        fetchScriptContent(false);
      }, 3000);
      
      return () => clearInterval(intervalId);
    }
  }, [blocks.length, hasInitialLoad, fetchScriptContent]);

  // Subscribe to script updates
  useEffect(() => {
    const unsubscribe = scriptEventBus.subscribe(scriptId, () => {
      // Refresh the preview when the script is updated (without loading state)
      fetchScriptContent(false);
    });

    return unsubscribe;
  }, [scriptId, fetchScriptContent]);

  const formatBlockContent = (block: Block): React.ReactNode => {
    try {
      // Try to parse JSON content if it looks like structured data
      if (block.content.startsWith('{') || block.content.startsWith('"')) {
        const json = JSON.parse(block.content);
        
        switch (block.block_type) {
          case 'dialogue':
            return (
              <div className={styles.dialogueBlock}>
                <strong className={styles.speaker}>{json.speaker || 'Speaker'}:</strong>
                <span className={styles.line}> {json.line || ''}</span>
              </div>
            );
          
          case 'monologue':
            const lines = Array.isArray(json.lines) ? json.lines : [json.lines];
            return (
              <div className={styles.monologueBlock}>
                <strong className={styles.speaker}>{json.speaker || 'Speaker'}:</strong>
                <div className={styles.lines}>
                  {lines.map((line: string, idx: number) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>
            );
          
          case 'stage_direction':
            return (
              <div className={styles.stageDirection}>
                <em>({json.description || json.text || block.content})</em>
              </div>
            );
          
          case 'joint_dialogue':
            const speakers = Array.isArray(json.speakers) ? json.speakers.join('/') : json.speakers;
            return (
              <div className={styles.dialogueBlock}>
                <strong className={styles.speaker}>{speakers}:</strong>
                <span className={styles.line}> {json.line || ''}</span>
              </div>
            );
          
          case 'reading':
            return (
              <div className={styles.readingBlock}>
                <strong className={styles.speaker}>{json.speaker || 'Reader'}:</strong>
                <em className={styles.readingLabel}> (Reading)</em>
                <span className={styles.line}> {json.reading_text || ''}</span>
              </div>
            );
          
          case 'paragraph':
            const text = typeof json === 'string' ? json : json.text || block.content;
            return <div className={styles.paragraph}>{text}</div>;
          
          default:
            return <div className={styles.defaultBlock}>{block.content}</div>;
        }
      }
    } catch (e) {
      // If JSON parsing fails, display as plain text
      if (block.block_type === 'stage_direction') {
        return <div className={styles.stageDirection}><em>({block.content})</em></div>;
      }
      return <div className={styles.defaultBlock}>{block.content}</div>;
    }
    
    // Plain text content
    if (block.block_type === 'stage_direction') {
      return <div className={styles.stageDirection}><em>({block.content})</em></div>;
    }
    return <div className={styles.defaultBlock}>{block.content}</div>;
  };

  if (loading) {
    return (
      <div className={styles.previewContainer}>
        <div className={styles.loadingState}>
          <span className={styles.loadingIcon}>⏳</span>
          <span className={styles.loadingText}>Loading preview...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.previewContainer}>
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <span className={styles.errorText}>{error}</span>
        </div>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className={styles.previewContainer}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📄</span>
          <span className={styles.emptyText}>No content yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.previewContainer}>
      <div className={styles.contentPreview}>
        {blocks.map((block) => (
          <div key={block.id} className={styles.blockWrapper}>
            {formatBlockContent(block)}
          </div>
        ))}
      </div>
    </div>
  );
};