-- Defaults affect only future registrations; paid and pilot customers are preserved.
ALTER TABLE tenants ALTER COLUMN plan_id SET DEFAULT 'free';
ALTER TABLE tenants ALTER COLUMN subscription_status SET DEFAULT 'active';
ALTER TABLE tenants ALTER COLUMN trial_ends_at DROP NOT NULL;
ALTER TABLE tenants ALTER COLUMN trial_ends_at DROP DEFAULT;
