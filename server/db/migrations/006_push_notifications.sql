CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),user_id text NOT NULL,
  endpoint text NOT NULL,keys jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,user_id,endpoint),FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_push ON push_subscriptions USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
ALTER TABLE quality_notifications ADD COLUMN push_sent_at timestamptz;
ALTER TABLE quality_notifications ADD COLUMN push_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE quality_notifications ADD COLUMN push_retry_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX quality_notification_event ON quality_notifications(tenant_id,user_id,kind,entity_id) WHERE kind IN('due_soon','overdue');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN GRANT SELECT,INSERT,UPDATE,DELETE ON push_subscriptions TO qualitrack_app; END IF; END $$;
