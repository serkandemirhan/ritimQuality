ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE TABLE account_tokens (
  token_hash text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_version integer NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('reset','verify')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_tokens_user ON account_tokens(tenant_id,user_id,purpose);
ALTER TABLE account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_account_tokens ON account_tokens
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Shared across serverless instances; keys contain only hashed request identifiers.
CREATE TABLE request_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX request_limits_expiry ON request_limits(expires_at);
REVOKE ALL ON account_tokens,request_limits FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON account_tokens,request_limits FROM %I',r);
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON account_tokens,request_limits TO qualitrack_app;
  END IF;
END $$;

CREATE FUNCTION invalidate_changed_account() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash OR NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.session_version := OLD.session_version + 1;
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN NEW.email_verified_at := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_account_change BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION invalidate_changed_account();
