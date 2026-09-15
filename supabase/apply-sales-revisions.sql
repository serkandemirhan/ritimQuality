-- Ritim Quality satış revizyonları / Supabase SQL Editor
-- 009, 010 ve 011 değişikliklerini mevcut kısmi kurulumlarda güvenle tamamlar.
BEGIN;

CREATE TABLE IF NOT EXISTS stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  department_id uuid NOT NULL,
  name text NOT NULL,
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,department_id,name),
  FOREIGN KEY(tenant_id,department_id) REFERENCES departments(tenant_id,id)
);
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON stations;
CREATE POLICY tenant_scope ON stations
  USING(tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);

ALTER TABLE quality_tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
ALTER TABLE quality_tasks ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE quality_tasks ADD COLUMN IF NOT EXISTS case_id uuid;
ALTER TABLE quality_tasks ADD COLUMN IF NOT EXISTS inspection_id text;
ALTER TABLE quality_cases ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'major';

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='quality_tasks'::regclass AND conname='quality_tasks_priority_check') THEN
    ALTER TABLE quality_tasks ADD CONSTRAINT quality_tasks_priority_check CHECK(priority IN('low','normal','high','critical'));
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='quality_tasks'::regclass AND conname='task_case') THEN
    ALTER TABLE quality_tasks ADD CONSTRAINT task_case FOREIGN KEY(tenant_id,case_id) REFERENCES quality_cases(tenant_id,id);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='quality_tasks'::regclass AND conname='task_inspection') THEN
    ALTER TABLE quality_tasks ADD CONSTRAINT task_inspection FOREIGN KEY(tenant_id,inspection_id) REFERENCES inspection_logs(tenant_id,id);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='quality_cases'::regclass AND conname='quality_cases_severity_check') THEN
    ALTER TABLE quality_cases ADD CONSTRAINT quality_cases_severity_check CHECK(severity IN('minor','major','critical'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS inspection_drafts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by text NOT NULL,
  claimed_by text,
  product_id text NOT NULL,
  control_plan_id text NOT NULL,
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id),
  FOREIGN KEY(tenant_id,claimed_by) REFERENCES users(tenant_id,id),
  FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),
  FOREIGN KEY(tenant_id,control_plan_id) REFERENCES control_plans(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS inspection_drafts_queue ON inspection_drafts(tenant_id,updated_at DESC);
ALTER TABLE inspection_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_drafts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON inspection_drafts;
CREATE POLICY tenant_scope ON inspection_drafts
  USING(tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);

ALTER TABLE media_evidence ADD COLUMN IF NOT EXISTS draft_id uuid;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='media_evidence'::regclass AND conname='media_evidence_draft_id_fkey') THEN
    ALTER TABLE media_evidence ADD CONSTRAINT media_evidence_draft_id_fkey FOREIGN KEY(draft_id) REFERENCES inspection_drafts(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS media_evidence_draft ON media_evidence(tenant_id,draft_id) WHERE draft_id IS NOT NULL;

ALTER TABLE measurement_results DROP CONSTRAINT IF EXISTS measurement_results_characteristic_type_check;
ALTER TABLE measurement_results ADD CONSTRAINT measurement_results_characteristic_type_check
  CHECK(characteristic_type IN('numeric','ok_nok','visual','single_select','multi_select'));

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON stations,inspection_drafts TO qualitrack_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO schema_migrations(version) VALUES
  ('009_sales_workflow'),
  ('010_inspection_drafts'),
  ('011_visual_measurements')
ON CONFLICT(version) DO NOTHING;

COMMIT;

-- Üç satırın da true dönmesi gerekir.
SELECT
  to_regclass('public.stations') IS NOT NULL AS stations_ready,
  to_regclass('public.inspection_drafts') IS NOT NULL AS drafts_ready,
  EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conrelid='measurement_results'::regclass
      AND conname='measurement_results_characteristic_type_check'
      AND pg_get_constraintdef(oid) LIKE '%visual%'
  ) AS visual_measurements_ready;
