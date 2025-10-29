import React, { useState, useEffect } from 'react';
import styles from './Header.module.css';
import { useAuth } from '../AuthContext';
import { regenerateAllThumbnails, exportAccountData, deleteMyAccount } from '../api';
import { ScriptLayout, CreateScriptLayoutRequest } from '../types';
import { StatusIndicator } from './editor/components/ui/StatusIndicator';
import type { ConnectionStatus } from './editor/types';

import logger from '../services/LoggingService';
interface HeaderProps {
  currentView?: 'scripts' | 'editor';
  scriptTitle?: string;
  onNavigateToScripts?: () => void;
  onThumbnailsRefreshed?: () => void;
  activeUserCount?: number;
  connectionStatus?: ConnectionStatus; // Add connection status
  savingIndicator?: React.ReactNode; // Saving indicator component
  // Layout management props (only for editor view)
  layouts?: ScriptLayout[];
  currentLayout?: ScriptLayout | null;
  onLayoutChange?: (layout: ScriptLayout) => void;
  onCreateNewLayout?: () => void;
  onSaveLayout?: () => void;
  // Demo mode props
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
}

const useTypewriter = (targetText: string, speed: number = 400) => {
  const [displayText, setDisplayText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  // Ease-in-ease-out function
  const easeInOutQuad = (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  };

  // Find common prefix between two strings
  const findCommonPrefix = (str1: string, str2: string): string => {
    let i = 0;
    while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
      i++;
    }
    return str1.slice(0, i);
  };

  useEffect(() => {
    if (targetText === displayText || isAnimating) return;

    setIsAnimating(true);
    const startText = displayText;
    const commonPrefix = findCommonPrefix(startText, targetText);
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / speed, 1);
      const easedProgress = easeInOutQuad(progress);

      // Calculate what to show
      const charsToDelete = startText.length - commonPrefix.length;
      const charsToAdd = targetText.length - commonPrefix.length;

      let newText = '';

      if (charsToDelete > 0) {
        // Two-phase animation: delete then add
        if (easedProgress <= 0.5) {
          // Deletion phase (first half)
          const deleteProgress = easedProgress * 2;
          const charsDeleted = Math.floor(deleteProgress * charsToDelete);
          newText = startText.slice(0, startText.length - charsDeleted);
        } else {
          // Addition phase (second half)
          const addProgress = (easedProgress - 0.5) * 2;
          const charsToShow = Math.floor(addProgress * charsToAdd);
          newText = commonPrefix + targetText.slice(commonPrefix.length, commonPrefix.length + charsToShow);
        }
      } else {
        // Only addition needed
        const charsToShow = Math.floor(easedProgress * charsToAdd);
        newText = commonPrefix + targetText.slice(commonPrefix.length, commonPrefix.length + charsToShow);
      }

      setDisplayText(newText);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayText(targetText);
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [targetText, displayText, isAnimating, speed]);

  return displayText;
};

// Custom hook for animating number counts
const useAnimatedNumber = (targetNumber: number, duration: number = 300) => {
  const [displayNumber, setDisplayNumber] = useState(targetNumber);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (targetNumber === displayNumber || isAnimating) return;

    setIsAnimating(true);
    const startNumber = displayNumber;
    const difference = targetNumber - startNumber;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentNumber = Math.round(startNumber + difference * easeOut);
      setDisplayNumber(currentNumber);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayNumber(targetNumber);
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [targetNumber, displayNumber, isAnimating, duration]);

  return displayNumber;
};

export const Header: React.FC<HeaderProps> = ({
  currentView = 'scripts',
  scriptTitle,
  onNavigateToScripts,
  onThumbnailsRefreshed,
  activeUserCount = 0,
  connectionStatus = 'connected',
  savingIndicator,
  layouts = [],
  currentLayout,
  onLayoutChange,
  onCreateNewLayout,
  onSaveLayout,
  isDemoMode = false,
  onToggleDemoMode
}) => {
  const { user, setToken, theme, setTheme, token, language = 'de', setLanguage } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLayoutSubmenu, setShowLayoutSubmenu] = useState(false);

  // Build target breadcrumb text
  const targetBreadcrumb = currentView === 'scripts' 
    ? '... / Scripts'
    : scriptTitle 
      ? `... / Scripts / ${scriptTitle}`
      : '... / Scripts';

  const animatedBreadcrumb = useTypewriter(targetBreadcrumb, 400);
  
  // Animate the user count for smooth transitions
  const animatedUserCount = useAnimatedNumber(activeUserCount, 300);
  
  // Build the user display text based on count
  const userDisplayText = animatedUserCount > 0 
    ? `${animatedUserCount} + ${user?.username || user?.email || 'User'}`
    : user?.username || user?.email || 'User';

  const handleLogout = () => {
    // 🔧 FIXED: Immediately clear URL on logout to prevent persistence
    window.history.replaceState({ view: 'auth' }, '', '/');
    setToken(null);
  };

  const handleExportData = async () => {
    try {
      const data = await exportAccountData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g, '-');
      a.download = `fassandra-export-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert((language === 'de' ? 'Export fehlgeschlagen: ' : 'Export failed: ') + (e?.message || 'Unknown error'));
    }
  };

  const handleDeleteAccount = async () => {
    const sure1 = confirm(language === 'de' ? 'Willst du dein Konto wirklich löschen? Dies kann nicht rückgängig gemacht werden.' : 'Are you sure you want to delete your account? This cannot be undone.');
    if (!sure1) return;
    const sure2 = confirm(language === 'de' ? 'Letzte Bestätigung: Alle deine Skripte werden gelöscht.' : 'Final confirmation: All your scripts will be deleted.');
    if (!sure2) return;
    try {
      await deleteMyAccount();
      // Clear session and go to auth
      window.history.replaceState({ view: 'auth' }, '', '/');
      setToken(null);
      alert(language === 'de' ? 'Konto gelöscht.' : 'Account deleted.');
    } catch (e: any) {
      alert((language === 'de' ? 'Löschen fehlgeschlagen: ' : 'Deletion failed: ') + (e?.message || 'Unknown error'));
    }
  };

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleRefreshThumbnails = async () => {
    if (!token || isRefreshing) return;
    
    setIsRefreshing(true);
    setIsMenuOpen(false);
    
    try {
      const generatedCount = await regenerateAllThumbnails();
      logger.debug('Header', `Generated ${generatedCount} thumbnails`);
      
      // Call the callback to refresh the script list if provided
      onThumbnailsRefreshed?.();
      
      // Show success feedback
      alert(`Successfully refreshed ${generatedCount} thumbnails!`);
    } catch (error: any) {
      logger.error('Header', 'Failed to refresh thumbnails:', error);
      alert(`Failed to refresh thumbnails: ${error.message || 'Unknown error'}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Parse the animated breadcrumb to render with proper styling
  const renderBreadcrumb = (): JSX.Element[] => {
    const parts = animatedBreadcrumb.split(' / ');
    const elements: JSX.Element[] = [];

    const isScriptsCurrent = currentView === 'scripts';
    const isEditorView = currentView === 'editor';

    parts.forEach((part, index) => {
      if (index > 0) {
        // Separator after ... is always large.
        // Separator before script title is always large.
        const isLarge = (index === 1) || (index === 2 && isEditorView);
        elements.push(
          <span
            key={`sep-${index}`}
            className={`${styles.separator} ${isLarge ? styles.largeSeparator : ''}`}
          >
            /
          </span>
        );
      }

      if (part === '...') {
        elements.push(
          <span key={part} className={`${styles.segment} ${styles.fassandraSegment}`}>...</span>
        );
      } else if (part === 'Scripts') {
        if (currentView === 'scripts') {
          elements.push(
            <span key={part} className={`${styles.segment} ${styles.current}`}>Scripts</span>
          );
        } else {
          elements.push(
            <button 
              key={part}
              className={`${styles.segment} ${styles.clickable}`}
              onClick={onNavigateToScripts}
            >
              Scripts
            </button>
          );
        }
      } else if (part && part.trim() && isEditorView) {
        // Script title
        elements.push(
          <span key={part} className={`${styles.segment} ${styles.current}`}>
            {part}
          </span>
        );
      }
    });

    return elements;
  };

  return (
    <header className={styles.header}>
      {/* Animated Breadcrumb on the left */}
      <nav className={styles.breadcrumb}>
        {renderBreadcrumb()}
      </nav>

      {/* Saving indicator - shown in editor view */}
      {savingIndicator && (
        <div style={{ marginLeft: 'auto', marginRight: '12px' }}>
          {savingIndicator}
        </div>
      )}

      {/* Connection status sphere - always visible */}
      <div style={{ marginRight: '16px' }}>
        <StatusIndicator
          status={connectionStatus}
          activeUserCount={activeUserCount}
          mode="sphere"
        />
      </div>

      {/* User menu on the right */}
      <div className={styles.menuContainer}>
        <span className={styles.username}>{userDisplayText}</span>
        <button className={styles.menuButton} onClick={() => setIsMenuOpen(!isMenuOpen)}>
          ☰
        </button>
        {isMenuOpen && (
          <div className={styles.dropdownMenu} onMouseLeave={() => {
            setIsMenuOpen(false);
            setShowLayoutSubmenu(false);
          }}>
            {/* Layout Menu Item (only show in editor view) */}
            {currentView === 'editor' && layouts.length > 0 && (
              <div className={styles.submenuContainer}>
                <button 
                  onClick={() => setShowLayoutSubmenu(!showLayoutSubmenu)}
                  className={styles.submenuTrigger}
                >
                  📑 Layout
                  <span className={styles.submenuArrow}>
                    {showLayoutSubmenu ? '▼' : '▶'}
                  </span>
                </button>
                {showLayoutSubmenu && (
                  <div 
                    className={styles.submenu}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={styles.currentLayoutDisplay}>
                      Current: {currentLayout?.name || 'None'}
                    </div>
                    {layouts.map(layout => (
                      <button
                        key={layout.id}
                        onClick={() => {
                          onLayoutChange?.(layout);
                          setIsMenuOpen(false);
                          setShowLayoutSubmenu(false);
                        }}
                        className={`${styles.submenuItem} ${
                          currentLayout?.id === layout.id ? styles.activeSubmenuItem : ''
                        }`}
                      >
                        {layout.name}
                      </button>
                    ))}
                    <div className={styles.submenuSeparator} />
                    <button 
                      onClick={() => {
                        onCreateNewLayout?.();
                        setIsMenuOpen(false);
                        setShowLayoutSubmenu(false);
                      }}
                      className={styles.submenuItem}
                    >
                      ➕ Create New
                    </button>
                    <button 
                      onClick={() => {
                        onSaveLayout?.();
                        setIsMenuOpen(false);
                        setShowLayoutSubmenu(false);
                      }}
                      className={styles.submenuItem}
                      disabled={!currentLayout}
                    >
                      💾 Save Current
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Demo Mode Toggle (only show in editor view) */}
            {currentView === 'editor' && onToggleDemoMode && (
              <button onClick={onToggleDemoMode}>
                {isDemoMode ? '🔴 Stop Demo' : '🤖 Demo Mode'}
              </button>
            )}
            
            {/* Regular Menu Options */}
            <button onClick={handleRefreshThumbnails} disabled={isRefreshing}>
              {isRefreshing ? (language === 'de' ? '🔄 Aktualisiere…' : '🔄 Refreshing...') : (language === 'de' ? '🖼️ Aktualisieren' : '🖼️ Refresh')}
            </button>
            <button onClick={handleThemeToggle}>
              {theme === 'dark' ? (language === 'de' ? '☀️ Helles Thema' : '☀️ Light Mode') : (language === 'de' ? '🌙 Dunkles Thema' : '🌙 Dark Mode')}
            </button>
            <button onClick={() => setLanguage && setLanguage(language === 'de' ? 'en' : 'de')}>
              {language === 'de' ? '🌐 Sprache: Deutsch' : '🌐 Language: English'}
            </button>
            <button onClick={() => alert('Details clicked!')}>Details</button>
            <div className={styles.submenuSeparator} />
            <button onClick={handleExportData}>
              {language === 'de' ? '📦 Daten exportieren' : '📦 Export Data'}
            </button>
            <button onClick={handleDeleteAccount}>
              {language === 'de' ? '🗑️ Konto löschen' : '🗑️ Delete Account'}
            </button>
            <button onClick={handleLogout}>{language === 'de' ? 'Abmelden' : 'Logout'}</button>
          </div>
        )}
      </div>
    </header>
  );
}; 
