import * as Y from 'yjs';
import { prosemirrorToYXmlFragment } from 'y-prosemirror';
import { YjsDocumentBuilder } from './YjsDocumentBuilder.js';
import { DatabaseService } from './DatabaseService.js';
import { v4 as uuidv4 } from 'uuid';

export class ScriptImporter {
  constructor(databaseUrl) {
    this.builder = new YjsDocumentBuilder();
    this.db = new DatabaseService(databaseUrl);
  }

  /**
   * Import a script from JSON data
   * @param {string} jsonStr - JSON string containing script data
   * @param {string} username - Username or email of the user
   * @param {string} scriptId - Optional script ID (for chunked imports)
   */
  async importScript(jsonStr, username, scriptId = null) {
    try {
      // Parse JSON
      const scriptData = JSON.parse(jsonStr);
      
      // Get user ID
      const userId = await this.db.getUserId(username);
      
      // Generate script ID if not provided
      scriptId = scriptId || uuidv4();
      
      // Handle based on mode
      if (scriptData.mode === 'chunked') {
        return await this.processChunkedScript(scriptData, scriptId, userId);
      } else {
        return await this.processFullScript(scriptData, scriptId, userId);
      }
    } catch (error) {
      console.error('Error importing script:', error);
      throw error;
    }
  }

  /**
   * Process a full script (non-chunked)
   */
  async processFullScript(scriptData, scriptId, userId) {
    console.log(`Processing full script: ${scriptId}`);
    
    // Create script record
    if (scriptData.metadata) {
      await this.db.createScript(scriptId, userId, scriptData.metadata);
    }
    
    // Build YJS document
    const { update, stateVector } = this.builder.buildScriptDocument(scriptData);
    
    // Store as initial state (like a fresh document)
    await this.db.storeInitialYjsState(scriptId, update, stateVector);
    
    return {
      success: true,
      scriptId: scriptId,
      itemsProcessed: scriptData.content ? scriptData.content.length : 0,
      message: 'Script imported successfully'
    };
  }

  /**
   * Process a chunked script
   */
  async processChunkedScript(chunk, scriptId, userId) {
    const chunkInfo = chunk.chunk;
    console.log(`Processing chunk ${chunkInfo.number} of ${chunkInfo.total} for script ${scriptId}`);
    
    // If first chunk, create script record
    if (chunkInfo.number === 1 && chunk.metadata) {
      await this.db.createScript(scriptId, userId, chunk.metadata);
      
      // Initialize with empty YJS document
      const ydoc = new Y.Doc();
      ydoc.getXmlFragment('default');
      ydoc.getText('prosemirror');
      ydoc.getMap('metadata');
      
      const initialUpdate = Y.encodeStateAsUpdate(ydoc);
      const stateVector = Y.encodeStateVector(ydoc);
      await this.db.storeInitialYjsState(scriptId, initialUpdate, stateVector);
    }
    
    // Load existing document state
    const ydoc = await this.loadDocument(scriptId);
    
    // Apply chunk content
    this.applyChunkToDocument(ydoc, chunk);
    
    // Get the update (delta from previous state)
    const update = Y.encodeStateAsUpdate(ydoc);
    
    // Store update (like WebSocket would)
    await this.db.storeYjsUpdate(scriptId, userId, update);
    
    return {
      success: true,
      scriptId: scriptId,
      chunkNumber: chunkInfo.number,
      totalChunks: chunkInfo.total,
      itemsProcessed: chunk.content ? chunk.content.length : 0,
      message: `Chunk ${chunkInfo.number} of ${chunkInfo.total} processed successfully`
    };
  }

  /**
   * Load existing YJS document from database
   */
  async loadDocument(scriptId) {
    const ydoc = new Y.Doc();
    
    // Initialize structures
    ydoc.getXmlFragment('default');
    ydoc.getText('prosemirror');
    ydoc.getMap('metadata');
    
    // Load base state if exists
    const baseState = await this.db.getBaseState(scriptId);
    if (baseState && baseState.baseState) {
      Y.applyUpdate(ydoc, baseState.baseState);
    }
    
    // Apply recent updates
    const updates = await this.db.getRecentUpdates(scriptId);
    for (const update of updates) {
      Y.applyUpdate(ydoc, update);
    }
    
    return ydoc;
  }

  /**
   * Apply chunk content to existing document
   */
  applyChunkToDocument(ydoc, chunk) {
    // Build ProseMirror content for this chunk
    const chunkContent = this.builder.buildProseMirrorDoc(chunk);

    // CRITICAL FIX: Use XML Fragment to preserve structure and attributes
    // Get the existing XML fragment
    const xmlFragment = ydoc.getXmlFragment('default');

    // Create a temporary YDoc to convert this chunk
    const tempDoc = new Y.Doc();
    const tempFragment = tempDoc.getXmlFragment('temp');

    // Convert ProseMirror to YXmlFragment (preserves all attributes including page numbers)
    prosemirrorToYXmlFragment(chunkContent, tempFragment);

    // Append all nodes from temp fragment to main fragment
    // This preserves the ProseMirror structure with all attributes
    tempFragment.forEach((item) => {
      // Clone and append each node
      xmlFragment.push([item.clone()]);
    });

    // Update metadata if present
    if (chunk.metadata) {
      const metadata = ydoc.getMap('metadata');
      metadata.set('title', chunk.metadata.title);
      metadata.set('author', chunk.metadata.author || '');
      metadata.set('totalPages', chunk.metadata.total_pages);
    }
  }

  async close() {
    await this.db.close();
  }
}