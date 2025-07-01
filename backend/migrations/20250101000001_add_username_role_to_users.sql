-- Add username column to the users table
ALTER TABLE users
ADD COLUMN username VARCHAR(255) UNIQUE NOT NULL DEFAULT ''; -- Add default temporarily if needed, or handle nulls

-- Note: The 'role' column is created in the initial migration (0001_create_tables.sql)

-- Update existing rows if necessary (e.g., set a default username)
-- UPDATE users SET username = 'user_' || substr(id::text, 1, 8) WHERE username = '';

-- It's often better to make the column NOT NULL without a default initially,
-- then populate existing rows, then add the NOT NULL constraint if possible.
-- However, for simplicity here, adding with a default. 