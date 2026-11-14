-- Central owner operations remain separate from customer admin roles.
ALTER TABLE tenants ADD COLUMN pilot_unlimited boolean;
ALTER TABLE tenants ADD COLUMN platform_suspended boolean NOT NULL DEFAULT false;
CREATE TABLE platform_audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_user_id text NOT NULL REFERENCES users(id),
 tenant_id uuid REFERENCES tenants(id), action text NOT NULL, reason text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_packages (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
 actor_user_id text NOT NULL REFERENCES users(id), kind text NOT NULL CHECK(kind IN('backup','restore')),
 manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'staging' CHECK(status IN('staging','ready','applied')),
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
CREATE TABLE platform_package_rows (
 package_id uuid NOT NULL REFERENCES platform_packages(id) ON DELETE CASCADE,
 table_name text NOT NULL, ordinal integer NOT NULL CHECK(ordinal>=0), row_data jsonb NOT NULL,
 PRIMARY KEY(package_id,table_name,ordinal)
);
CREATE TABLE platform_package_files (
 package_id uuid NOT NULL REFERENCES platform_packages(id) ON DELETE CASCADE,
 media_id uuid NOT NULL, storage_provider text NOT NULL, storage_path text NOT NULL,
 sha256 text NOT NULL, size_bytes integer NOT NULL, mime_type text NOT NULL, ready boolean NOT NULL DEFAULT false,
 PRIMARY KEY(package_id,media_id)
);
CREATE INDEX platform_audit_tenant_date ON platform_audit_events(tenant_id,created_at DESC);
DO $$ DECLARE tab text; rol text; BEGIN
 FOREACH tab IN ARRAY ARRAY['platform_audit_events','platform_packages','platform_package_rows','platform_package_files'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY platform_owner ON %I USING(current_setting(''app.platform_owner'',true)=''on'') WITH CHECK(current_setting(''app.platform_owner'',true)=''on'')',tab);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',tab);
  FOREACH rol IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=rol) THEN EXECUTE format('REVOKE ALL ON %I FROM %I',tab,rol); END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO qualitrack_app',tab); END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN
  GRANT USAGE,SELECT ON SEQUENCE platform_audit_events_id_seq TO qualitrack_app;
  REVOKE UPDATE,DELETE ON platform_audit_events FROM qualitrack_app;
 END IF;
END $$;
CREATE TRIGGER protect_platform_audit BEFORE UPDATE OR DELETE ON platform_audit_events FOR EACH ROW EXECUTE FUNCTION protect_quality_history();
