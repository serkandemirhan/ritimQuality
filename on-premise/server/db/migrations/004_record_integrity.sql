CREATE OR REPLACE FUNCTION protect_quality_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM inspection_logs WHERE tenant_id=OLD.tenant_id AND control_plan_id=OLD.id)
    AND ((OLD.payload - ARRAY['isActive','status','updatedAt']) IS DISTINCT FROM (NEW.payload - ARRAY['isActive','status','updatedAt'])
      OR OLD.product_id IS DISTINCT FROM NEW.product_id OR OLD.version IS DISTINCT FROM NEW.version) THEN
    RAISE EXCEPTION 'Used control plan revisions are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_quality_revision BEFORE UPDATE ON control_plans FOR EACH ROW EXECUTE FUNCTION protect_quality_revision();

CREATE OR REPLACE FUNCTION protect_quality_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Quality history is append-only' USING ERRCODE='23514';
END $$;
CREATE TRIGGER protect_audit_history BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION protect_quality_history();

CREATE OR REPLACE FUNCTION protect_inspection_payload() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payload IS DISTINCT FROM OLD.payload OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.control_plan_id IS DISTINCT FROM OLD.control_plan_id
    OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at OR NEW.session_code IS DISTINCT FROM OLD.session_code THEN
    RAISE EXCEPTION 'Inspection content is immutable; void with reason and create a replacement' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_inspection_payload BEFORE UPDATE ON inspection_logs FOR EACH ROW EXECUTE FUNCTION protect_inspection_payload();

ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE control_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE inspection_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE media_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE measurement_results FORCE ROW LEVEL SECURITY;
