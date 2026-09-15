CREATE TABLE stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  department_id uuid NOT NULL,
  name text NOT NULL,
  UNIQUE(tenant_id,id), UNIQUE(tenant_id,department_id,name),
  FOREIGN KEY(tenant_id,department_id) REFERENCES departments(tenant_id,id)
);
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON stations USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON stations TO qualitrack_app;
  END IF;
END $$;
ALTER TABLE quality_tasks ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK(priority IN('low','normal','high','critical'));
ALTER TABLE quality_tasks ADD COLUMN started_at timestamptz;
ALTER TABLE quality_tasks ADD COLUMN case_id uuid;
ALTER TABLE quality_tasks ADD COLUMN inspection_id text;
ALTER TABLE quality_tasks ADD CONSTRAINT task_case FOREIGN KEY(tenant_id,case_id) REFERENCES quality_cases(tenant_id,id);
ALTER TABLE quality_tasks ADD CONSTRAINT task_inspection FOREIGN KEY(tenant_id,inspection_id) REFERENCES inspection_logs(tenant_id,id);
ALTER TABLE quality_cases ADD COLUMN severity text NOT NULL DEFAULT 'major' CHECK(severity IN('minor','major','critical'));
