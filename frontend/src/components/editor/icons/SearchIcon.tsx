import React from 'react';

interface SearchIconProps {
  size?: number;
  className?: string;
}

export const SearchIcon: React.FC<SearchIconProps> = ({
  size = 20,
  className = ''
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-search-icon lucide-search ${className}`}
    >
      <path d="m21 21-4.34-4.34"/>
      <circle cx="11" cy="11" r="8"/>
    </svg>
  );
};
