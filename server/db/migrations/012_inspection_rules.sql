ALTER TABLE tenants ADD COLUMN IF NOT EXISTS inspection_rules jsonb NOT NULL DEFAULT '{"requireActivePlan":false,"requireLotNumber":false,"requireOrderNumber":false}'::jsonb;
