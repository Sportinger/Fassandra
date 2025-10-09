-- Create table for storing script rehearsal and production events
CREATE TABLE script_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT,
    location TEXT,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ensure events have positive duration
ALTER TABLE script_events
    ADD CONSTRAINT chk_script_events_duration CHECK (ends_at > starts_at);

-- Indexes for efficient querying by script and time range
CREATE INDEX idx_script_events_script_id ON script_events(script_id);
CREATE INDEX idx_script_events_script_id_starts_at ON script_events(script_id, starts_at);
