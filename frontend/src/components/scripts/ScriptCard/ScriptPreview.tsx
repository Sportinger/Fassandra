import React, { useEffect, useState, useCallback } from 'react';
import { getScriptWithYjs } from '../../../api';
import * as Y from 'yjs';
import styles from './ScriptPreview.module.css';
import logger from '../../../services/LoggingService';
import { scriptEventBus } from '../../../services/ScriptEventBus';

interface ScriptPreviewProps {
  scriptId: string;
}

export const ScriptPreview: React.FC<ScriptPreviewProps> = ({ scriptId }) => {
  const [previewContent, setPreviewContent] = useState<string>('');
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
      
      const scriptData = await getScriptWithYjs(scriptId);
      
      if (scriptData && scriptData.yjs_state) {
        // Decode the YJS state
        const stateBuffer = Uint8Array.from(atob(scriptData.yjs_state), c => c.charCodeAt(0));
        
        // Create a temporary Y.Doc to extract content
        const doc = new Y.Doc();
        Y.applyUpdate(doc, stateBuffer);
        
        // Try to get content from different possible YJS structures
        let content = '';
        
        // Try prosemirror fragment first (TipTap uses this)
        const xmlFragment = doc.getXmlFragment('prosemirror');
        if (xmlFragment && xmlFragment.length > 0) {
          // Convert XML to HTML-like preview
          content = extractContentFromYXml(xmlFragment);
        }
        
        // Fallback to default fragment
        if (!content) {
          const defaultFragment = doc.getXmlFragment('default');
          if (defaultFragment && defaultFragment.length > 0) {
            content = extractContentFromYXml(defaultFragment);
          }
        }
        
        // Fallback to content text
        if (!content) {
          const contentText = doc.getText('content');
          if (contentText) {
            content = contentText.toString();
          }
        }

        // Fallback to prosemirror text (backend may store plain text here)
        if (!content) {
          const prosemirrorText = doc.getText('prosemirror');
          if (prosemirrorText) {
            content = prosemirrorText.toString();
          }
        }
        
        setPreviewContent(content || 'No content available');
      } else {
        setPreviewContent('');
      }
      
      if (!hasInitialLoad) {
        setHasInitialLoad(true);
      }
    } catch (err) {
      logger.error('ScriptPreview', 'Failed to fetch script content:', err);
      setError('Failed to load preview');
      
      // For demo purposes, show mock data when API fails in development
      if (process.env.NODE_ENV === 'development') {
        setPreviewContent(`
          <div><strong>HAMLET:</strong> To be or not to be, that is the question</div>
          <div><em>(Enter OPHELIA)</em></div>
          <div><strong>OPHELIA:</strong> My lord, I have remembrances of yours that I have longed long to re-deliver</div>
        `);
      }
    } finally {
      setLoading(false);
    }
  }, [scriptId, hasInitialLoad]);

  // Extract readable content from YJS XML structure
  const extractContentFromYXml = (xmlElement: Y.XmlFragment | Y.XmlElement): string => {
    let html = '';
    
    xmlElement.forEach((item) => {
      if (item instanceof Y.XmlElement) {
        const nodeName = item.nodeName;
        const attrs = item.getAttributes();
        
        // Handle different node types
        if (nodeName === 'paragraph' || nodeName === 'p') {
          html += '<div>';
          html += extractContentFromYXml(item);
          html += '</div>';
        } else if (nodeName === 'dialogue-block' || attrs['data-dialogue-block']) {
          html += '<div class="dialogue">';
          html += extractContentFromYXml(item);
          html += '</div>';
        } else if (nodeName === 'speaker' || attrs['data-speaker']) {
          html += '<strong>';
          html += extractContentFromYXml(item);
          html += ':</strong> ';
        } else if (nodeName === 'dialogue-text' || attrs['data-dialogue-text']) {
          html += '<span>';
          html += extractContentFromYXml(item);
          html += '</span>';
        } else if (nodeName === 'cue-block' || attrs['data-cue-block']) {
          html += '<div class="cue"><em>';
          html += extractContentFromYXml(item);
          html += '</em></div>';
        } else if (nodeName === 'scene-block' || attrs['data-scene-block']) {
          html += '<div class="scene"><strong>';
          html += extractContentFromYXml(item);
          html += '</strong></div>';
        } else {
          // Generic element
          html += extractContentFromYXml(item);
        }
      } else if (item instanceof Y.XmlText) {
        html += item.toString();
      }
    });
    
    return html;
  };

  // Initial load on mount
  useEffect(() => {
    fetchScriptContent(true);
  }, [scriptId, fetchScriptContent]);

  // Subscribe to script updates
  useEffect(() => {
    const unsubscribe = scriptEventBus.subscribe(scriptId, () => {
      // Refresh the preview when the script is updated (without loading state)
      fetchScriptContent(false);
    });

    return unsubscribe;
  }, [scriptId, fetchScriptContent]);

  const renderPreviewContent = () => {
    if (!previewContent) {
      return (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📄</span>
          <span className={styles.emptyText}>No content yet</span>
        </div>
      );
    }

    // Parse and render the HTML content
    const lines = previewContent.split('\n').filter(line => line.trim());
    
    return (
      <div className={styles.contentPreview}>
        {lines.slice(0, 10).map((line, index) => (
          <div 
            key={index} 
            className={styles.blockWrapper}
            dangerouslySetInnerHTML={{ __html: line }}
          />
        ))}
        {lines.length > 10 && (
          <div className={styles.moreContent}>
            ... and {lines.length - 10} more lines
          </div>
        )}
      </div>
    );
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

  return (
    <div className={styles.previewContainer}>
      {renderPreviewContent()}
    </div>
  );
};