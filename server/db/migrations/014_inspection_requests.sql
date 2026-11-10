ALTER TABLE quality_tasks ADD COLUMN IF NOT EXISTS request_context jsonb;
ALTER TABLE quality_tasks ADD COLUMN IF NOT EXISTS result_inspection_id text;
ALTER TABLE quality_tasks ADD CONSTRAINT quality_tasks_result_fk FOREIGN KEY (tenant_id,result_inspection_id) REFERENCES inspection_logs(tenant_id,id);
