-- Run after application migrations, with the Supabase project's postgres role.
-- The password is assigned by server/db/setupSupabase.ts from QUALITY_DB_PASSWORD.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN
    CREATE ROLE qualitrack_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app' AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)) THEN
    RAISE EXCEPTION 'qualitrack_app must be an unprivileged application role';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO qualitrack_app;
DO $$ DECLARE table_name text; api_role text; sequence_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tenants','users','products','control_plans','inspection_logs','audit_logs','stripe_events',
    'measurement_results','media_evidence','plants','departments','quality_cases','inspection_approvals',
    'quality_tasks','quality_notifications','push_subscriptions'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',table_name);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',table_name,api_role);
      END IF;
    END LOOP;
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.%I TO qualitrack_app',table_name);
  END LOOP;
  FOREACH sequence_name IN ARRAY ARRAY['audit_logs_id_seq','measurement_results_id_seq','quality_notifications_id_seq'] LOOP
    EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE public.%I TO qualitrack_app',sequence_name);
  END LOOP;
END $$;
REVOKE UPDATE,DELETE ON public.audit_logs FROM qualitrack_app;
REVOKE DELETE ON public.inspection_logs FROM qualitrack_app;
-- No grants to the migration history, storage schema, or other applications' tables.
