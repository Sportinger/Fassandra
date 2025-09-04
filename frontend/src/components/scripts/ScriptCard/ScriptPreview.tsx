import React, { useEffect, useState, useCallback } from 'react';
import { getScriptWithYjs, getYjsState } from '../../../api';
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
    // Only show loading state on initial load
    if (isInitial || !hasInitialLoad) {
      setLoading(true);
    }
    setError(null);

    const doc = new Y.Doc();
    let applied = false;
    // Try JSON endpoint first, but don't abort if it fails
    try {
      const scriptData = await getScriptWithYjs(scriptId);
      if (scriptData?.yjs_state) {
        const stateBuffer = Uint8Array.from(atob(scriptData.yjs_state), c => c.charCodeAt(0));
        Y.applyUpdate(doc, stateBuffer);
        applied = true;
      }
    } catch (e) {
      logger.warn('ScriptPreview', 'getScriptWithYjs failed, will try binary endpoint', e);
    }

    // Fallback to binary endpoint
    if (!applied) {
      try {
        const bin = await getYjsState(scriptId);
        if (bin && (bin as ArrayBuffer).byteLength > 0) {
          Y.applyUpdate(doc, new Uint8Array(bin));
          applied = true;
        }
      } catch (e) {
        logger.error('ScriptPreview', 'getYjsState failed', e);
      }
    }

    // If still not applied, show error
    if (!applied) {
      setError('Failed to load preview');
      setLoading(false);
      return;
    }

    // Extract content robustly
    let content = '';
    try {
      const xmlDefault = doc.getXmlFragment('default');
      if (xmlDefault && xmlDefault.length > 0) {
        content = extractContentFromYXml(xmlDefault);
      }
    } catch {}
    try {
      if (!content) {
        const xmlPm = doc.getXmlFragment('prosemirror');
        // If the prosemirror fragment exists (even if empty), do NOT
        // try to read it as a text type to avoid Yjs type conflicts.
        if (xmlPm && xmlPm.length > 0) {
          content = extractContentFromYXml(xmlPm);
        }
      }
    } catch {}

    // Fallback order for text fields. Try 'prosemirror' as Text first
    // (guarded) and then a generic 'content' Text field.
    if (!content) {
      // Try legacy text storage under 'prosemirror'
      try {
        const t = doc.getText('prosemirror');
        if (t && t.length > 0) content = t.toString();
      } catch {}
    }
    if (!content) {
      try {
        const t = doc.getText('content');
        if (t && t.length > 0) content = t.toString();
      } catch {}
    }
    setPreviewContent(content || '');

    if (!hasInitialLoad) setHasInitialLoad(true);
    setLoading(false);
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
