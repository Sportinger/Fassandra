/**
 * SearchBox Component
 * Provides search functionality within the script editor
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { SearchIcon } from './icons/SearchIcon';

interface SearchBoxProps {
  editor: Editor | null;
  isVisible: boolean;
  transitionDelay?: string;
}

interface SearchResult {
  from: number;
  to: number;
}

// Plugin key for search decorations
const searchPluginKey = new PluginKey('search');

// Helper to create search plugin
const createSearchPlugin = (searchTerm: string, currentIndex: number) => {
  return new Plugin({
    key: searchPluginKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr) {
        if (!searchTerm) {
          return DecorationSet.empty;
        }

        const doc = tr.doc;
        const decorations: Decoration[] = [];
        const searchLower = searchTerm.toLowerCase();
        let resultIndex = 0;

        // Search through the document
        doc.descendants((node, pos) => {
          if (node.isText && node.text) {
            const text = node.text.toLowerCase();
            let index = text.indexOf(searchLower);
            
            while (index !== -1) {
              const from = pos + index;
              const to = pos + index + searchTerm.length;
              
              // Create decoration with appropriate class
              const className = resultIndex === currentIndex 
                ? 'search-highlight-active' 
                : 'search-highlight';
              
              decorations.push(
                Decoration.inline(from, to, { class: className })
              );
              
              resultIndex++;
              index = text.indexOf(searchLower, index + 1);
            }
          }
        });

        return DecorationSet.create(doc, decorations);
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      }
    }
  });
};

export const SearchBox: React.FC<SearchBoxProps> = ({ 
  editor, 
  isVisible,
  transitionDelay = '0ms'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchPluginRef = useRef<Plugin | null>(null);

  // Remove search plugin - defined early to avoid dependency issues
  const removeSearchPlugin = useCallback(() => {
    if (editor && searchPluginRef.current) {
      const state = editor.state;
      const plugins = state.plugins.filter(p => p !== searchPluginRef.current);
      editor.view.updateState(state.reconfigure({ plugins }));
      searchPluginRef.current = null;
    }
  }, [editor]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Clear search when closing
        setSearchTerm('');
        setSearchResults([]);
        setCurrentResultIndex(-1);
        removeSearchPlugin();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, removeSearchPlugin]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removeSearchPlugin();
    };
  }, [removeSearchPlugin]);

  // Update search plugin
  const updateSearchPlugin = useCallback(() => {
    if (!editor) return;

    // Remove old plugin
    removeSearchPlugin();

    // Add new plugin if there's a search term
    if (searchTerm) {
      searchPluginRef.current = createSearchPlugin(searchTerm, currentResultIndex);
      const state = editor.state;
      const plugins = [...state.plugins, searchPluginRef.current];
      editor.view.updateState(state.reconfigure({ plugins }));
    }
  }, [editor, searchTerm, currentResultIndex, removeSearchPlugin]);

  // Perform search when term changes
  const performSearch = useCallback(() => {
    if (!editor || !searchTerm) {
      setSearchResults([]);
      setCurrentResultIndex(-1);
      updateSearchPlugin();
      return;
    }

    const doc = editor.state.doc;
    const results: SearchResult[] = [];
    const searchLower = searchTerm.toLowerCase();

    // Search through the document
    doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const text = node.text.toLowerCase();
        let index = text.indexOf(searchLower);
        
        while (index !== -1) {
          results.push({
            from: pos + index,
            to: pos + index + searchTerm.length
          });
          index = text.indexOf(searchLower, index + 1);
        }
      }
    });

    setSearchResults(results);
    
    if (results.length > 0) {
      setCurrentResultIndex(0);
    } else {
      setCurrentResultIndex(-1);
    }
    
    updateSearchPlugin();
  }, [editor, searchTerm, updateSearchPlugin]);

  // Jump to a specific search result
  const jumpToResult = useCallback((index: number) => {
    if (!editor || searchResults.length === 0 || index < 0 || index >= searchResults.length) {
      return;
    }

    const result = searchResults[index];
    
    // Update the plugin to highlight the active result
    updateSearchPlugin();
    
    // Scroll to result without changing focus
    const coords = editor.view.coordsAtPos(result.from);
    const editorElement = editor.view.dom.parentElement;
    if (editorElement) {
      editorElement.scrollTo({
        top: coords.top - editorElement.offsetTop - 100,
        behavior: 'smooth'
      });
    }
  }, [editor, searchResults, updateSearchPlugin]);

  // Handle search input changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, performSearch]);

  // Update decorations when current index changes
  useEffect(() => {
    if (currentResultIndex >= 0) {
      updateSearchPlugin();
      jumpToResult(currentResultIndex);
    }
  }, [currentResultIndex, updateSearchPlugin, jumpToResult]);

  // Navigate to next result
  const goToNextResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(nextIndex);
  };

  // Navigate to previous result
  const goToPreviousResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = currentResultIndex === 0 ? searchResults.length - 1 : currentResultIndex - 1;
    setCurrentResultIndex(prevIndex);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPreviousResult();
      } else {
        goToNextResult();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
      removeSearchPlugin();
    }
  };

  // Clear search and close
  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setCurrentResultIndex(-1);
    setIsOpen(false);
    removeSearchPlugin();
  };

  if (!editor) return null;

  return (
    <div 
      ref={containerRef}
      className="search-box-container"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(-20px) scale(0.8)',
        transition: `all var(--transition-normal)`,
        transitionDelay,
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`toolbarButton morphingButton ${isOpen ? 'active' : ''} ${isVisible ? 'visible' : 'hidden'}`}
        title="Search in document (Ctrl/Cmd + F)"
        type="button"
      >
        <SearchIcon />
      </button>
      
      {isOpen && (
        <div className="search-dropdown">
          <div className="search-input-container">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search..."
              className="search-input"
            />
            {searchTerm && (
              <button 
                onClick={clearSearch}
                className="search-clear-button"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          
          {searchTerm && (
            <div className="search-results-info">
              {searchResults.length > 0 ? (
                <>
                  <span className="search-results-count">
                    {currentResultIndex + 1} of {searchResults.length}
                  </span>
                  <div className="search-navigation">
                    <button 
                      onClick={goToPreviousResult}
                      className="search-nav-button"
                      title="Previous result (Shift+Enter)"
                      disabled={searchResults.length === 0}
                    >
                      ▲
                    </button>
                    <button 
                      onClick={goToNextResult}
                      className="search-nav-button"
                      title="Next result (Enter)"
                      disabled={searchResults.length === 0}
                    >
                      ▼
                    </button>
                  </div>
                </>
              ) : (
                <span className="search-no-results">No results found</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};