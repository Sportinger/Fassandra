import React from 'react';

interface EditorShellProps {
  header: React.ReactNode;
  children: React.ReactNode;
}

export const EditorShell: React.FC<EditorShellProps> = ({ header, children }) => (
  <div className="editorContainer">
    {header}
    {children}
  </div>
);

