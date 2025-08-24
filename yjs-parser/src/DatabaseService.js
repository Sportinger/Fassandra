import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

export class DatabaseService {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString: connectionString || 'postgres://pessoa_user:dev_password_123@localhost:5432/pessoa_db'
    });
  }

  /**
   * Get user ID from username or email
   */
  async getUserId(username) {
    const result = await this.pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`User not found: ${username}`);
    }
    
    return result.rows[0].id;
  }

  /**
   * Create or update script record
   */
  async createScript(scriptId, userId, metadata) {
    await this.pool.query(
      `INSERT INTO scripts (id, created_by, title, created_at, is_public)
       VALUES ($1, $2, $3, NOW(), false)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         created_at = NOW()`,
      [scriptId, userId, metadata.title || 'Untitled Script']
    );
    
    console.log(`Created script record: ${scriptId} - '${metadata.title}'`);
  }

  /**
   * Store YJS update directly (mimics WebSocket binary message storage)
   */
  async storeYjsUpdate(scriptId, userId, updateData) {
    // Store as recent update (same as WebSocket would)
    await this.pool.query(
      `INSERT INTO yjs_recent_updates 
       (script_id, user_id, update_data, created_at, expires_at, is_compacted)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '2 hours', false)`,
      [scriptId, userId, Buffer.from(updateData)]
    );
    
    console.log(`Stored YJS update for script ${scriptId}: ${updateData.length} bytes`);
  }

  /**
   * Store initial YJS state for full scripts
   */
  async storeInitialYjsState(scriptId, updateData, stateVector) {
    await this.pool.query(
      `INSERT INTO yjs_base_states 
       (script_id, base_state, state_vector, compacted_at, update_count, document_size)
       VALUES ($1, $2, $3, NOW(), 1, $4)
       ON CONFLICT (script_id) DO UPDATE SET
         base_state = EXCLUDED.base_state,
         state_vector = EXCLUDED.state_vector,
         compacted_at = NOW(),
         document_size = EXCLUDED.document_size`,
      [
        scriptId, 
        Buffer.from(updateData), 
        Buffer.from(stateVector || new Uint8Array(0)),
        updateData.length
      ]
    );
    
    console.log(`Stored initial YJS state for script ${scriptId}: ${updateData.length} bytes`);
  }

  /**
   * Check if script exists
   */
  async scriptExists(scriptId) {
    const result = await this.pool.query(
      'SELECT 1 FROM scripts WHERE id = $1',
      [scriptId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get existing YJS base state
   */
  async getBaseState(scriptId) {
    const result = await this.pool.query(
      'SELECT base_state, state_vector FROM yjs_base_states WHERE script_id = $1',
      [scriptId]
    );
    
    if (result.rows.length > 0) {
      return {
        baseState: result.rows[0].base_state,
        stateVector: result.rows[0].state_vector
      };
    }
    
    return null;
  }

  /**
   * Get recent updates for a script
   */
  async getRecentUpdates(scriptId) {
    const result = await this.pool.query(
      `SELECT update_data 
       FROM yjs_recent_updates 
       WHERE script_id = $1 AND NOT is_compacted
       ORDER BY id ASC`,
      [scriptId]
    );
    
    return result.rows.map(row => row.update_data);
  }

  async close() {
    await this.pool.end();
  }
}