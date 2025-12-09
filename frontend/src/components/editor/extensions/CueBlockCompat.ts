import { Node, mergeAttributes } from '@tiptap/core';

// Minimal compatibility node so old documents with cueBlock can be parsed and migrated,
// without activating any of the interactive plugins from the legacy CueBlock.
export const CueBlockCompat = Node.create({
  name: 'cueBlockLegacy',
  group: 'block',
  content: 'inline*',
  draggable: false,

  addAttributes() {
    return {
      cueType: { default: 'light', parseHTML: el => el.getAttribute('data-cue-type') },
      cueNumber: { default: '', parseHTML: el => el.getAttribute('data-cue-number') },
      sceneNumber: { default: 1, parseHTML: el => el.getAttribute('data-scene-number') },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="cue-block"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Render a minimal hidden block to be removed by migration.
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'cue-block', style: 'display:none' }),
      0,
    ];
  },
});

export default CueBlockCompat;

