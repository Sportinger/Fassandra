import React from 'react';
import styles from './Editor.module.css';

interface RulerProps {
  showRuler: boolean;
}

export const Ruler: React.FC<RulerProps> = ({ showRuler }) => {
  if (!showRuler) return null;

  // Generate ruler marks for horizontal ruler (top)
  const generateHorizontalMarks = () => {
    const marks = [];
    const maxWidth = 21; // 21cm for A4 width
    
    for (let i = 0; i <= maxWidth; i++) {
      const isMajor = i % 5 === 0; // Major marks every 5cm
      const isMinor = i % 1 === 0; // Minor marks every 1cm
      
      marks.push(
        <div
          key={i}
          className={`${styles.rulerMark} ${isMajor ? styles.rulerMarkMajor : styles.rulerMarkMinor}`}
          style={{ left: `${(i / maxWidth) * 100}%` }}
        >
          {isMajor && <span className={styles.rulerLabel}>{i}</span>}
        </div>
      );
    }
    
    return marks;
  };

  // Generate ruler marks for vertical ruler (left)
  const generateVerticalMarks = () => {
    const marks = [];
    const maxHeight = 29.7; // 29.7cm for A4 height
    
    for (let i = 0; i <= maxHeight; i++) {
      const isMajor = i % 5 === 0; // Major marks every 5cm
      const isMinor = i % 1 === 0; // Minor marks every 1cm
      
      marks.push(
        <div
          key={i}
          className={`${styles.rulerMark} ${styles.rulerMarkVertical} ${isMajor ? styles.rulerMarkMajor : styles.rulerMarkMinor}`}
          style={{ top: `${(i / maxHeight) * 100}%` }}
        >
          {isMajor && <span className={styles.rulerLabel}>{i}</span>}
        </div>
      );
    }
    
    return marks;
  };

  return (
    <>
      {/* Horizontal Ruler (Top) */}
      <div className={styles.horizontalRuler}>
        <div className={styles.rulerBackground}>
          {generateHorizontalMarks()}
        </div>
      </div>

      {/* Vertical Ruler (Left) */}
      <div className={styles.verticalRuler}>
        <div className={styles.rulerBackground}>
          {generateVerticalMarks()}
        </div>
      </div>

      {/* Corner square where rulers meet */}
      <div className={styles.rulerCorner} />
    </>
  );
}; 