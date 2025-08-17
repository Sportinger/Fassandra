import React, { useEffect, useState } from 'react';
import { getScriptWithBlocks } from '../../../api';
import { Block } from '../../../types';
import styles from './ScriptPreview.module.css';
import logger from '../../../services/LoggingService';

interface ScriptPreviewProps {
  scriptId: string;
}

export const ScriptPreview: React.FC<ScriptPreviewProps> = ({ scriptId }) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScriptContent = async () => {
      try {
        setLoading(true);
        setError(null);
        const scriptData = await getScriptWithBlocks(scriptId);
        if (scriptData && scriptData.blocks) {
          // Sort blocks by page_number to show all content
          const sortedBlocks = scriptData.blocks
            .sort((a, b) => a.page_number - b.page_number);
          setBlocks(sortedBlocks);
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
      }
    };

    fetchScriptContent();
  }, [scriptId]);

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