ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN username text;
ALTER TABLE users ADD CONSTRAINT users_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9][a-z0-9._-]{2,39}$');
ALTER TABLE users ADD CONSTRAINT users_login_identity CHECK ((role = 'admin' AND email IS NOT NULL) OR (role <> 'admin' AND (email IS NOT NULL OR username IS NOT NULL)));
CREATE UNIQUE INDEX users_tenant_username_unique ON users (tenant_id, username) WHERE username IS NOT NULL;
