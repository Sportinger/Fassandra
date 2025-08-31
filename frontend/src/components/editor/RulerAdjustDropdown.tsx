import React, { useEffect, useMemo, useRef, useState } from 'react';

interface RulerAdjustDropdownProps {
  isVisible: boolean;
}

const RulerIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ruler-icon lucide-ruler">
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
    <path d="m14.5 12.5 2-2" />
    <path d="m11.5 9.5 2-2" />
    <path d="m8.5 6.5 2-2" />
    <path d="m17.5 15.5 2-2" />
  </svg>
);

export const RulerAdjustDropdown: React.FC<RulerAdjustDropdownProps> = ({ isVisible }) => {
  const [open, setOpen] = useState(false);
  const [padX, setPadX] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);

  // Read current CSS variable
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const val = cs.getPropertyValue('--content-padding-x').trim();
    // Try to parse px; if cm or others, approximate to px via 37.8 px/cm fallback
    let px = 0;
    if (val.endsWith('px')) {
      px = parseFloat(val);
    } else if (val.endsWith('cm')) {
      const cm = parseFloat(val);
      px = Math.round(cm * 37.8);
    } else {
      // Attempt to measure by creating a temp element
      const el = document.createElement('div');
      el.style.width = val;
      document.body.appendChild(el);
      px = el.getBoundingClientRect().width;
      document.body.removeChild(el);
    }
    setPadX(Math.max(8, Math.min(150, Math.round(px))));
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const applyPadX = (value: number) => {
    document.documentElement.style.setProperty('--content-padding-x', `${value}px`);
  };

  return (
    <div className="dropdownContainer" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`toolbarButton dropdownButton ${open ? 'open' : ''}`}
        type="button"
        title="Adjust page margins"
      >
        <span className="label"><RulerIcon size={20} /></span>
      </button>
      {open && isVisible && (
        <div className="dropdownMenu" style={{ minWidth: 240 }}>
          <div style={{ padding: '8px 10px', display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Content padding (left & right)</div>
            <input
              type="range"
              min={8}
              max={200}
              step={1}
              value={padX}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPadX(v);
                applyPadX(v);
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{padX}px</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[16, 24, 32, 40, 48, 64, 80].map(v => (
                  <button key={v} type="button" className="toolbarButton" title={`${v}px`} onClick={() => { setPadX(v); applyPadX(v); }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RulerAdjustDropdown;

