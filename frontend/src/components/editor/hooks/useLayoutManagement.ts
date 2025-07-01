import { useEffect, useCallback } from 'react';
import { Editor as EditorInstance } from '@tiptap/react';
import { ScriptLayout, CreateScriptLayoutRequest } from '../../../types';
import { 
  getScriptLayouts, 
  getDefaultScriptLayout, 
  createScriptLayout, 
  updateScriptLayout 
} from '../../../api';

interface UseLayoutManagementProps {
  token: string;
  scriptId: string;
  editor: EditorInstance | null;
  layouts: ScriptLayout[];
  setLayouts: (layouts: ScriptLayout[]) => void;
  currentLayout: ScriptLayout | null;
  setCurrentLayout: (layout: ScriptLayout | null) => void;
}

export const useLayoutManagement = ({
  token,
  scriptId,
  editor,
  layouts,
  setLayouts,
  currentLayout,
  setCurrentLayout,
}: UseLayoutManagementProps) => {
  
  // Load available layouts when component mounts
  useEffect(() => {
    const loadLayouts = async () => {
      if (!token || !scriptId) return;
      
      try {
        console.log('[Layout] Loading layouts for script:', scriptId);
        const [layoutsData, defaultLayout] = await Promise.all([
          getScriptLayouts(token, scriptId),
          getDefaultScriptLayout(token, scriptId)
        ]);
        
        setLayouts(layoutsData);
        setCurrentLayout(defaultLayout || layoutsData[0] || null);
        console.log('[Layout] Loaded layouts:', layoutsData.length, 'Default:', defaultLayout?.name);
      } catch (error) {
        console.error('[Layout] Failed to load layouts:', error);
      }
    };
    
    loadLayouts();
  }, [token, scriptId, setLayouts, setCurrentLayout]);

  // Apply layout styles to the editor
  const applyLayoutStyles = useCallback((layout: ScriptLayout) => {
    if (!layout.layout_config || !editor) return;

    try {
      const config = typeof layout.layout_config === 'string' 
        ? JSON.parse(layout.layout_config) 
        : layout.layout_config;

      console.log('[Layout] Applying config:', config);

      // Remove existing layout styles
      const existingStyle = document.getElementById('layout-styles');
      if (existingStyle) {
        existingStyle.remove();
      }

      // Create new style element
      const styleElement = document.createElement('style');
      styleElement.id = 'layout-styles';
      
      let css = '';

      // Apply speaker styles
      if (config.speakers) {
        const speakerRules = Object.entries(config.speakers)
          .map(([property, value]) => `${property}: ${value}`)
          .join('; ');
        css += `.ProseMirror .speaker-name { ${speakerRules} }\n`;
      }

      // Apply dialogue styles
      if (config.dialogue) {
        const dialogueRules = Object.entries(config.dialogue)
          .map(([property, value]) => `${property.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
          .join('; ');
        css += `.ProseMirror p { ${dialogueRules} }\n`;
      }

      // Apply stage direction styles
      if (config.stageDirections) {
        const stageRules = Object.entries(config.stageDirections)
          .map(([property, value]) => `${property.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
          .join('; ');
        css += `.ProseMirror .stage-direction { ${stageRules} }\n`;
      }

      // Apply heading styles
      if (config.headings) {
        Object.entries(config.headings).forEach(([heading, styles]) => {
          const headingRules = Object.entries(styles as any)
            .map(([property, value]) => `${property.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
            .join('; ');
          css += `.ProseMirror ${heading} { ${headingRules} }\n`;
        });
      }

      styleElement.textContent = css;
      document.head.appendChild(styleElement);

      console.log('[Layout] Applied CSS:', css);
    } catch (error) {
      console.error('[Layout] Failed to apply layout:', error);
    }
  }, [editor]);

  // Apply current layout configuration to the editor
  useEffect(() => {
    if (!currentLayout || !editor) return;
    
    console.log('[Layout] Applying layout:', currentLayout.name);
    applyLayoutStyles(currentLayout);
  }, [currentLayout, editor, applyLayoutStyles]);

  // Handle layout change
  const handleLayoutChange = useCallback((layout: ScriptLayout) => {
    setCurrentLayout(layout);
    console.log('[Layout] Changed to:', layout.name);
  }, [setCurrentLayout]);

  // Save current layout with current editor styles
  const handleSaveCurrentLayout = useCallback(async () => {
    if (!currentLayout || !token || !scriptId) return;

    try {
      // Get the current styling state from the editor and update the layout
      const updatedConfig = { ...currentLayout.layout_config };
      
      await updateScriptLayout(token, scriptId, currentLayout.id, {
        layout_config: updatedConfig
      });
      
      console.log('[Layout] Saved current layout successfully');
    } catch (error) {
      console.error('[Layout] Failed to save layout:', error);
    }
  }, [currentLayout, token, scriptId]);

  // Create new layout
  const handleCreateNewLayout = useCallback(async () => {
    if (!token || !scriptId) return;

    const name = prompt('Enter layout name:');
    if (!name) return;

    try {
      const newLayoutData: CreateScriptLayoutRequest = {
        name,
        description: `Custom layout: ${name}`,
        layout_config: {
          speakers: { fontWeight: 'bold', color: '#2563eb' },
          dialogue: { fontSize: '16px', lineHeight: '1.5' },
          stageDirections: { fontStyle: 'italic', color: '#6b7280' }
        }
      };

      const newLayout = await createScriptLayout(token, scriptId, newLayoutData);
      setLayouts([...layouts, newLayout]);
      setCurrentLayout(newLayout);
      
      console.log('[Layout] Created new layout:', newLayout.name);
    } catch (error) {
      console.error('[Layout] Failed to create layout:', error);
    }
  }, [token, scriptId, layouts, setLayouts, setCurrentLayout]);

  return {
    handleLayoutChange,
    handleSaveCurrentLayout,
    handleCreateNewLayout,
    applyLayoutStyles,
  };
}; 