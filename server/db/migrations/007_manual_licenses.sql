ALTER TABLE tenants ADD COLUMN billing_source text NOT NULL DEFAULT 'stripe' CHECK(billing_source IN('stripe','manual'));
ALTER TABLE tenants ADD COLUMN manual_license_ends_at timestamptz;
