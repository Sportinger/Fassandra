import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';

interface UseEditorPagesResult {
  pageCount: number;
  pageNumber: number;
}

export const useEditorPages = (editor: Editor | null): UseEditorPagesResult => {
  const [pageCount, setPageCount] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    if (!editor) return undefined;

    const recompute = () => {
      try {
        let count = 0;
        editor.state.doc.descendants((node: any) => {
          if (node.type && node.type.name === 'pageIndicator') count += 1;
          return true;
        });
        if (count === 0) count = 1;
        setPageCount(count);
      } catch {}
    };

    recompute();
    editor.on('update', recompute);

    return () => {
      editor.off('update', recompute);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;

    const recompute = () => {
      try {
        let current = 1;
        let passed = 0;
        const selPos = editor.state?.selection?.from ?? 0;
        editor.state.doc.descendants((node: any, pos: number) => {
          if (node.type && node.type.name === 'pageIndicator') {
            passed += 1;
            if (pos < selPos) current = passed;
          }
          return true;
        });
        setPageNumber(current);
      } catch {}
    };

    recompute();
    editor.on('update', recompute);

    return () => {
      editor.off('update', recompute);
    };
  }, [editor]);

  return { pageCount, pageNumber };
};
