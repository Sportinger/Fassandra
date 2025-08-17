import React, { useState, useRef, useEffect } from 'react';
import { Editor as EditorInstance } from '@tiptap/react';
import './styles/toolbar.css';

interface SpeakerColorPickerProps {
  editor: EditorInstance | null;
  isVisible: boolean;
}

const PRESET_COLORS = [
  '#000000', // Black
  '#FFFFFF', // White
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
  '#FFC0CB', // Pink
  '#A52A2A', // Brown
  '#808080', // Gray
  '#D3D3D3', // Light Gray
  '#4B0082', // Indigo
  '#008000', // Dark Green
];

export const SpeakerColorPicker: React.FC<SpeakerColorPickerProps> = ({ 
  editor, 
  isVisible 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleColorSelect = (color: string) => {
    if (!editor) return;
    
    setSelectedColor(color);
    
    // Apply color to the current speaker using TipTap's setColor command
    const { selection } = editor.state;
    const { $from } = selection;
    
    // Find the speaker node and select its content
    for (let depth = $from.depth; depth >= 0; depth--) {
      const node = $from.node(depth);
      
      if (node.type.name === 'speaker') {
        // Found speaker node directly
        const pos = $from.before(depth);
        const endPos = $from.after(depth);
        
        editor.chain()
          .focus()
          .setTextSelection({ from: pos + 1, to: endPos - 1 })
          .setColor(color)
          .run();
        break;
      } else if (node.type.name === 'dialogueBlock') {
        // Look for speaker within dialogue block
        const blockPos = $from.before(depth);
        let speakerFound = false;
        
        node.forEach((child, offset) => {
          if (child.type.name === 'speaker' && !speakerFound) {
            const speakerPos = blockPos + offset + 1;
            const speakerEnd = speakerPos + child.nodeSize;
            
            // Select the text content of the speaker node
            editor.chain()
              .focus()
              .setTextSelection({ from: speakerPos + 1, to: speakerEnd - 1 })
              .setColor(color)
              .run();
            speakerFound = true;
          }
        });
        
        if (speakerFound) break;
      }
    }
    
    setIsOpen(false);
  };

  if (!isVisible) return null;

  return (
    <div ref={dropdownRef} className="dropdownContainer">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`toolbarButton dropdownButton ${isOpen ? 'open' : ''}`}
        type="button"
      >
        <span className="label">🎨</span>
        <span className="arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="dropdownMenu" style={{ background: '#1a1a1a' }}>
          <div style={{ padding: '8px' }}>
            {/* Custom color input */}
            <div style={{ marginBottom: '12px' }}>
              <input
                ref={inputRef}
                type="color"
                value={selectedColor}
                onChange={(e) => handleColorSelect(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: '#2a2a2a'
                }}
              />
            </div>
            
            {/* Preset colors grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px'
            }}>
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: color,
                    border: '2px solid #444',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.border = '2px solid #fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.border = '2px solid #444';
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};