// frontend/src/types.ts

/**
 * Represents a user in the system.
 * @property {string} id - Unique user identifier (UUID).
 * @property {string} email - User's email address.
 * @property {string} username - User's username.
 * @property {string} role - User's role (e.g., 'user', 'admin').
 * @property {string} created_at - ISO timestamp of user creation.
 */
export interface User {
  id: string; // UUIDs are strings in TS/JS
  email: string;
  username: string;
  role: string;
  created_at: string; // Dates are often strings in JSON
}

/**
 * Represents a script, which is a collection of blocks.
 * @property {string} id - Unique script identifier (UUID).
 * @property {string} title - Title of the script.
 * @property {string|null} created_by - User ID of the creator, or null.
 * @property {string} created_at - ISO timestamp of script creation.
 * @property {boolean} is_public - Whether the script is publicly accessible.
 * @property {string|null} thumbnail - Base64-encoded thumbnail image for preview.
 * @property {boolean} isPlaceholder - Whether this is a placeholder for an uploading script.
 * @property {UploadStatus} uploadStatus - Status of the upload process for placeholder scripts.
 * @property {string|null} uploadError - Error message if upload failed.
 * @property {number} uploadProgress - Upload progress percentage (0-100).
 * @property {string} uploadSubStage - Detailed sub-stage message for upload progress.
 */
export interface Script {
  id: string;
  title: string;
  created_by: string | null;
  created_at: string;
  is_public: boolean;
  thumbnail: string | null;
  isPlaceholder?: boolean;
  uploadStatus?: UploadStatus;
  uploadError?: string | null;
  uploadProgress?: number;
  uploadSubStage?: string;
}

/**
 * Upload status for placeholder scripts.
 */
export type UploadStatus = 'uploading' | 'analyzing' | 'creating' | 'completed' | 'failed';

/**
 * Represents a single block of content within a script.
 * @property {string} id - Unique block identifier (UUID).
 * @property {string} script_id - ID of the script this block belongs to.
 * @property {string} block_type - Type of block (e.g., 'text', 'dialogue').
 * @property {string} content - Content of the block (may be JSON for TipTap).
 * @property {string} created_at - ISO timestamp of block creation.
 */
export interface Block {
  id: string;
  script_id: string;
  block_type: string;
  content: string; // This might be structured JSON for TipTap
  created_at: string;
}

/**
 * Represents an edit made to a block's content.
 * @property {string} id - Unique edit identifier (UUID).
 * @property {string} block_id - ID of the block that was edited.
 * @property {string|null} user_id - User ID of the editor, or null.
 * @property {string} content - The new content after the edit.
 * @property {string} created_at - ISO timestamp of the edit.
 */
export interface Edit {
  id: string;
  block_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
}

/**
 * Represents a script and its associated blocks (API response).
 * @property {Script} script - The script object.
 * @property {Block[]} blocks - Array of blocks belonging to the script.
 */
export interface ScriptWithBlocks {
  script: Script;
  blocks: Block[];
}

/**
 * Authentication state for the frontend application.
 * @property {string|null} token - The authentication token, or null if not logged in.
 * @property {User|null} user - The authenticated user, or null.
 * @property {(token: string|null, user?: User|null) => void} setToken - Function to update the token and user.
 * @property {'light'|'dark'} theme - Current theme setting.
 * @property {(theme: 'light'|'dark') => void} setTheme - Function to update the theme.
 */
export interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string | null, user?: User | null) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

/**
 * Represents a script share entry.
 * @property {string} id - Unique share identifier (UUID).
 * @property {string} script_id - The script being shared.
 * @property {string} shared_with_user_id - The user the script is shared with.
 * @property {'read'|'write'} permission - Permission level.
 * @property {string} created_at - ISO timestamp of share creation.
 * @property {string|null} created_by - User ID who created the share.
 */
export interface ScriptShare {
  id: string;
  script_id: string;
  shared_with_user_id: string;
  permission: 'read' | 'write';
  created_at: string;
  created_by: string | null;
}

/**
 * Script share with username for display.
 */
export interface ScriptShareWithUser extends ScriptShare {
  username: string;
}

/**
 * Request payload for sharing a script.
 * @property {string} username - Username to share with.
 * @property {'read'|'write'} permission - Permission level to grant.
 */
export interface ShareScriptRequest {
  username: string;
  permission: 'read' | 'write';
}

/**
 * Represents a visual layout/theme for a script.
 * @property {string} id - Unique layout identifier (UUID).
 * @property {string} script_id - The script this layout belongs to.
 * @property {string} name - Name of the layout (e.g., "Director's View").
 * @property {string|null} description - Optional description.
 * @property {string|null} created_by - User who created this layout.
 * @property {string} created_at - ISO timestamp of creation.
 * @property {string} updated_at - ISO timestamp of last update.
 * @property {boolean} is_default - Whether this is the default layout.
 * @property {object} layout_config - JSON configuration with styling rules.
 */
export interface ScriptLayout {
  id: string;
  script_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_default: boolean;
  layout_config: {
    speakers?: {
      fontWeight?: string;
      color?: string;
      alignment?: string;
      fontSize?: string;
    };
    dialogue?: {
      alignment?: string;
      marginLeft?: string;
      fontSize?: string;
      lineHeight?: string;
    };
    stageDirections?: {
      fontStyle?: string;
      color?: string;
      alignment?: string;
      fontSize?: string;
    };
    paragraphs?: {
      alignment?: string;
    };
    headings?: {
      h1?: { fontSize?: string; fontWeight?: string; marginBottom?: string };
      h2?: { fontSize?: string; fontWeight?: string; marginBottom?: string };
      h3?: { fontSize?: string; fontWeight?: string; marginBottom?: string };
    };
  };
}

/**
 * Request payload for creating a new script layout.
 */
export interface CreateScriptLayoutRequest {
  name: string;
  description?: string;
  layout_config: ScriptLayout['layout_config'];
  is_default?: boolean;
}

/**
 * Request payload for updating an existing script layout.
 */
export interface UpdateScriptLayoutRequest {
  name?: string;
  description?: string;
  layout_config?: ScriptLayout['layout_config'];
  is_default?: boolean;
} 