ALTER TABLE media_evidence ADD COLUMN storage_provider text NOT NULL DEFAULT 'local' CHECK(storage_provider IN('local','supabase'));
ALTER TABLE media_evidence ADD COLUMN upload_status text NOT NULL DEFAULT 'ready' CHECK(upload_status IN('pending','ready'));
ALTER TABLE media_evidence ADD COLUMN upload_expires_at timestamptz;
ALTER TABLE tenants ADD COLUMN notifications_checked_at timestamptz;
CREATE INDEX media_pending_uploads ON media_evidence(tenant_id,uploaded_by,created_at) WHERE upload_status='pending';
