-- backend/migrations/20250514161500_add_user_id_to_yjs_document_updates.sql
ALTER TABLE yjs_document_updates
ADD COLUMN user_id UUID NULL,
ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Optional: Consider if you need to backfill user_id for existing updates if possible,
-- or if NULL is acceptable for historical data where user_id was not tracked.
-- Since this is for tracking who made an update, NULL might be fine for old updates
-- if that data wasn't captured before. 