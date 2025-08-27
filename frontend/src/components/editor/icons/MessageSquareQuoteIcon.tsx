import React from 'react';

interface MessageSquareQuoteIconProps {
  size?: number;
  className?: string;
}

export const MessageSquareQuoteIcon: React.FC<MessageSquareQuoteIconProps> = ({
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
      className={`lucide lucide-message-square-quote-icon lucide-message-square-quote ${className}`}
    >
      <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>
      <path d="M14 13a2 2 0 0 0 2-2V9h-2"/>
      <path d="M8 13a2 2 0 0 0 2-2V9H8"/>
    </svg>
  );
};
