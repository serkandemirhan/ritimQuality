CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE user_role AS ENUM ('admin','quality_engineer','operator','auditor');

-- tenant_id burada SaaS kiracılığı değil, tek kurum verisini ilişkisel olarak bağlayan sabit anahtardır.
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text NOT NULL,
  tax_number text,
  tax_office text,
  industry text,
  facility_location text,
  contact_email text NOT NULL,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tenants(name,legal_name,contact_email) VALUES('Kurum Adı','Kurum Adı','admin@example.local');

CREATE TABLE users (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'operator',
  department text NOT NULL DEFAULT '',
  station_or_machine text,
  status text NOT NULL DEFAULT 'active' CHECK(status IN('active','suspended')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,email)
);

CREATE TABLE products (
  id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,code)
);

CREATE TABLE control_plans (
  id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  version text NOT NULL,
  status text NOT NULL CHECK(status IN('active','draft','archived')),
  is_active boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id) ON DELETE CASCADE,
  UNIQUE(tenant_id,product_id,version)
);
CREATE UNIQUE INDEX one_active_control_plan_per_product ON control_plans(tenant_id,product_id) WHERE is_active;

CREATE TABLE inspection_logs (
  id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  control_plan_id text NOT NULL,
  session_code text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  voided_at timestamptz,
  voided_by text REFERENCES users(id) ON DELETE SET NULL,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,session_code),
  FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),
  FOREIGN KEY(tenant_id,control_plan_id) REFERENCES control_plans(tenant_id,id)
);
CREATE INDEX inspection_logs_tenant_date ON inspection_logs(tenant_id,occurred_at DESC);
CREATE INDEX inspection_logs_product ON inspection_logs(tenant_id,product_id,occurred_at DESC);

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_tenant_date ON audit_logs(tenant_id,created_at DESC);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_users ON users USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY organization_products ON products USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY organization_control_plans ON control_plans USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY organization_inspection_logs ON inspection_logs USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY organization_audit_logs ON audit_logs USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
