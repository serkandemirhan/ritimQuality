CREATE TABLE measurement_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inspection_id text NOT NULL,
  sample_index integer NOT NULL CHECK(sample_index > 0),
  characteristic_id text NOT NULL,
  point_no integer NOT NULL,
  characteristic_name text NOT NULL,
  characteristic_type text NOT NULL CHECK(characteristic_type IN('numeric','ok_nok','single_select','multi_select')),
  value jsonb NOT NULL,
  numeric_value double precision,
  nominal double precision,
  lsl double precision,
  usl double precision,
  unit text,
  status text NOT NULL CHECK(status IN('pass','warning','fail')),
  source text NOT NULL CHECK(source IN('manual','gauge','import','cmm')),
  product_id text NOT NULL,
  product_revision text,
  lot_number text,
  serial_number text,
  work_order text,
  equipment_id text,
  operator_name text,
  measured_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,inspection_id,sample_index,characteristic_id),
  FOREIGN KEY(tenant_id,inspection_id) REFERENCES inspection_logs(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX measurement_results_trace ON measurement_results(tenant_id,product_id,characteristic_id,measured_at DESC);
CREATE INDEX measurement_results_serial ON measurement_results(tenant_id,serial_number) WHERE serial_number IS NOT NULL;

CREATE TABLE media_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inspection_id text,
  sample_index integer,
  characteristic_id text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  kind text NOT NULL CHECK(kind IN('photo','video','file')),
  storage_path text NOT NULL,
  size_bytes integer NOT NULL CHECK(size_bytes > 0),
  uploaded_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,inspection_id) REFERENCES inspection_logs(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX media_evidence_inspection ON media_evidence(tenant_id,inspection_id,sample_index,characteristic_id);

ALTER TABLE measurement_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_measurement_results ON measurement_results USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY organization_media_evidence ON media_evidence USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='qualitrack_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON measurement_results,media_evidence TO qualitrack_app;
    GRANT USAGE,SELECT ON SEQUENCE measurement_results_id_seq TO qualitrack_app;
  END IF;
END $$;
