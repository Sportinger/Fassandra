-- Add sharing-related columns to scripts table
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Create script_shares table for user-to-user sharing
CREATE TABLE IF NOT EXISTS script_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    UNIQUE(script_id, shared_with_user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_script_shares_script_id ON script_shares(script_id);
CREATE INDEX IF NOT EXISTS idx_script_shares_shared_with_user_id ON script_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_is_public ON scripts(is_public); 