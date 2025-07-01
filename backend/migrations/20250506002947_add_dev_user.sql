-- Add development user admin@pessoa.de
-- Note: The password hash is a placeholder and will be updated on first run.

INSERT INTO users (email, username, password_hash, role)
VALUES (
    'admin@pessoa.de',
    'admin',
    '$argon2id$v=19$m=65536,t=3,p=4$PLACEHOLDERSALT$PLACEHOLDERHASH',
    'admin'
)
ON CONFLICT (email) DO NOTHING; 