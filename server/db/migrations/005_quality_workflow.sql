CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_identity ON users(tenant_id,id);
CREATE TABLE plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL,
  UNIQUE(tenant_id,id), UNIQUE(tenant_id,name)
);
CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), plant_id uuid NOT NULL, name text NOT NULL,
  UNIQUE(tenant_id,id), UNIQUE(tenant_id,plant_id,name), FOREIGN KEY(tenant_id,plant_id) REFERENCES plants(tenant_id,id)
);
ALTER TABLE users ADD COLUMN plant_id uuid;
ALTER TABLE users ADD COLUMN department_id uuid;
ALTER TABLE users ADD CONSTRAINT users_plant FOREIGN KEY(tenant_id,plant_id) REFERENCES plants(tenant_id,id);
ALTER TABLE users ADD CONSTRAINT users_department FOREIGN KEY(tenant_id,department_id) REFERENCES departments(tenant_id,id);
CREATE TABLE quality_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), inspection_id text NOT NULL,
  title text NOT NULL, owner_id text, due_at timestamptz, state text NOT NULL DEFAULT 'open' CHECK(state IN('open','action','verification','closed')),
  containment text NOT NULL DEFAULT '', root_cause text NOT NULL DEFAULT '', action text NOT NULL DEFAULT '', verification text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), closed_by text,
  UNIQUE(tenant_id,id), UNIQUE(tenant_id,inspection_id),
  FOREIGN KEY(tenant_id,inspection_id) REFERENCES inspection_logs(tenant_id,id), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,closed_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE inspection_approvals (
  tenant_id uuid NOT NULL REFERENCES tenants(id), inspection_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')), reason text NOT NULL DEFAULT '', reviewed_by text, reviewed_at timestamptz,
  PRIMARY KEY(tenant_id,inspection_id), FOREIGN KEY(tenant_id,inspection_id) REFERENCES inspection_logs(tenant_id,id), FOREIGN KEY(tenant_id,reviewed_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE quality_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), title text NOT NULL,
  owner_id text NOT NULL, product_id text, due_at timestamptz NOT NULL, completed_at timestamptz,
  completion_note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
CREATE TABLE quality_notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), user_id text NOT NULL,
  title text NOT NULL, kind text NOT NULL, entity_id text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id)
);
CREATE INDEX quality_notifications_inbox ON quality_notifications(tenant_id,user_id,created_at DESC);
CREATE INDEX quality_tasks_due ON quality_tasks(tenant_id,due_at) WHERE completed_at IS NULL;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['plants','departments','quality_cases','inspection_approvals','quality_tasks','quality_notifications'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',table_name);
    EXECUTE format('CREATE POLICY tenant_scope ON %I USING(tenant_id=current_setting(''app.tenant_id'',true)::uuid) WITH CHECK(tenant_id=current_setting(''app.tenant_id'',true)::uuid)',table_name);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO qualitrack_app',table_name); END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN GRANT USAGE,SELECT ON SEQUENCE quality_notifications_id_seq TO qualitrack_app; END IF;
END $$;
