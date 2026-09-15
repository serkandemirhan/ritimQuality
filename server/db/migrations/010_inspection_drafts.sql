CREATE TABLE inspection_drafts (
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
CREATE INDEX inspection_drafts_queue ON inspection_drafts(tenant_id,updated_at DESC);
ALTER TABLE inspection_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON inspection_drafts USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN GRANT SELECT,INSERT,UPDATE,DELETE ON inspection_drafts TO qualitrack_app; END IF; END $$;
ALTER TABLE media_evidence ADD COLUMN draft_id uuid REFERENCES inspection_drafts(id) ON DELETE SET NULL;
CREATE INDEX media_evidence_draft ON media_evidence(tenant_id,draft_id) WHERE draft_id IS NOT NULL;
