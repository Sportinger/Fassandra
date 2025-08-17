import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';

interface FontStyleDropdownProps {
  editor: Editor | null;
  isVisible?: boolean;
}

export const FontStyleDropdown: React.FC<FontStyleDropdownProps> = ({ 
  editor, 
  isVisible = true 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentFontStyle, setCurrentFontStyle] = useState('default');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Font style options - using beautiful Google Fonts
  const fontStyles = [
    { value: 'default', label: 'Default', fontFamily: 'inherit', className: '' },
    { value: 'typewriter', label: 'Typewriter', fontFamily: '"Courier Prime", monospace', className: 'font-typewriter' },
    { value: 'vintage', label: 'Vintage', fontFamily: '"Special Elite", cursive', className: 'font-vintage' }
  ];
  
  // Apply font style to entire editor by adding/removing CSS class
  const handleFontStyleChange = (style: string) => {
    if (!editor) return;
    
    // Find the editor's root element
    const editorElement = editor.view.dom.closest('.ProseMirror');
    if (!editorElement) return;
    
    // Remove all font classes
    fontStyles.forEach(fs => {
      if (fs.className) {
        editorElement.classList.remove(fs.className);
      }
    });
    
    // Add the selected font class
    const selectedStyle = fontStyles.find(fs => fs.value === style);
    if (selectedStyle && selectedStyle.className) {
      editorElement.classList.add(selectedStyle.className);
    }
    
    // Store the current style in local storage for persistence
    localStorage.setItem('editor-font-style', style);
    setCurrentFontStyle(style);
    setIsOpen(false);
  };
  
  // Load saved font style on mount
  useEffect(() => {
    if (!editor) return;
    
    const savedStyle = localStorage.getItem('editor-font-style') || 'default';
    setCurrentFontStyle(savedStyle);
    
    // Apply saved style
    setTimeout(() => {
      handleFontStyleChange(savedStyle);
    }, 100);
  }, [editor]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  if (!editor || !isVisible) return null;
  
  const currentStyleObj = fontStyles.find(s => s.value === currentFontStyle) || fontStyles[0];
  
  return (
    <div className="dropdownContainer" ref={dropdownRef}>
      <button
        className={`toolbarButton dropdownButton ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Font Style"
      >
        <span className="label" style={{ fontFamily: currentStyleObj.fontFamily }}>
          {currentStyleObj.value === 'typewriter' ? 'TT' : currentStyleObj.value === 'vintage' ? 'V' : 'Aa'}
        </span>
        <span className="arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="dropdownMenu">
          <div className="dropdownHeader">Font Style</div>
          {fontStyles.map((style) => (
            <button
              key={style.value}
              className={`dropdownItem ${currentFontStyle === style.value ? 'active' : ''}`}
              onClick={() => handleFontStyleChange(style.value)}
              style={{ fontFamily: style.fontFamily }}
            >
              {style.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};