/**
 * TrailingNode Extension
 * Ensures there's always an editable paragraph at the end of the document
 * This allows users to click below the last element and continue writing
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';

export const TrailingNode = Extension.create({
  name: 'trailingNode',

  addOptions() {
    return {
      node: 'paragraph', // The type of node to create
      notAfter: ['paragraph'], // Don't add if the last node is already a paragraph
    };
  },

  addProseMirrorPlugins() {
    const plugin = new Plugin({
      key: new PluginKey(this.name),
      appendTransaction: (transactions, _oldState, newState) => {
        // Don't do anything if there's no change
        const docChanged = transactions.some(transaction => transaction.docChanged);
        if (!docChanged) {
          return null;
        }

        const { doc, tr, schema } = newState;
        const shouldInsertNodeAtEnd = this.options.node;
        const types = Array.isArray(this.options.notAfter) 
          ? this.options.notAfter 
          : [this.options.notAfter];

        if (!shouldInsertNodeAtEnd) {
          return null;
        }

        // Get the last node
        const lastNode = doc.lastChild;

        if (!lastNode) {
          // Document is empty, add a paragraph
          const type = schema.nodes[shouldInsertNodeAtEnd];
          if (!type) {
            return null;
          }
          return tr.insert(doc.content.size, type.create());
        }

        const lastNodeType = lastNode.type.name;
        const isDisabledNode = types.includes(lastNodeType);

        // If the last node is not a paragraph (or other allowed types), add one
        if (!isDisabledNode) {
          const type = schema.nodes[shouldInsertNodeAtEnd];
          if (!type) {
            return null;
          }

          const transaction = tr.insert(doc.content.size, type.create());
          return transaction;
        }

        return null;
      },
    });

    return [plugin];
  },
});