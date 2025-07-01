-- Create script layouts table for storing visual formatting templates
CREATE TABLE script_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_default BOOLEAN DEFAULT FALSE,
    layout_config JSONB NOT NULL,
    CONSTRAINT unique_script_layout_name UNIQUE(script_id, name)
);

-- Create index for faster lookups
CREATE INDEX idx_script_layouts_script_id ON script_layouts(script_id);
CREATE INDEX idx_script_layouts_default ON script_layouts(script_id, is_default) WHERE is_default = true;

-- Insert a default layout for existing scripts
INSERT INTO script_layouts (script_id, name, description, created_by, is_default, layout_config)
SELECT 
    s.id,
    'Default Layout',
    'Basic formatting for script content',
    s.created_by,
    true,
    '{
        "speakers": {
            "fontWeight": "bold",
            "color": "#2563eb",
            "alignment": "left"
        },
        "dialogue": {
            "alignment": "left",
            "marginLeft": "20px"
        },
        "stageDirections": {
            "fontStyle": "italic",
            "color": "#6b7280",
            "alignment": "center"
        },
        "paragraphs": {
            "alignment": "left"
        },
        "headings": {
            "h1": { "fontSize": "2rem", "fontWeight": "bold", "marginBottom": "1rem" },
            "h2": { "fontSize": "1.5rem", "fontWeight": "bold", "marginBottom": "0.75rem" },
            "h3": { "fontSize": "1.25rem", "fontWeight": "bold", "marginBottom": "0.5rem" }
        }
    }'::jsonb
FROM scripts s; 