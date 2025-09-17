import React, { useEffect, useMemo, useRef, useState } from 'react';

const RulerIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ruler-icon lucide-ruler">
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
    <path d="m14.5 12.5 2-2" />
    <path d="m11.5 9.5 2-2" />
    <path d="m8.5 6.5 2-2" />
    <path d="m17.5 15.5 2-2" />
  </svg>
);

export const RulerAdjustDropdown: React.FC = () => {
  return (
    <div className="dropdownContainer">
      <button
        onClick={() => {
          // Toggle overlay via custom event
          const evt = new Event('fassandra:toggle-ruler-overlay');
          window.dispatchEvent(evt);
        }}
        className={`toolbarButton dropdownButton`}
        type="button"
        title="Adjust page margins"
      >
        <span className="label"><RulerIcon size={20} /></span>
      </button>
    </div>
  );
};

export default RulerAdjustDropdown;
