ALTER TABLE tenants ADD COLUMN next_control_number bigint NOT NULL DEFAULT 1000;
ALTER TABLE inspection_logs ADD COLUMN control_number text;
WITH numbered AS (
  SELECT tenant_id,id,1000+row_number() OVER (PARTITION BY tenant_id ORDER BY occurred_at,id) AS number
  FROM inspection_logs
)
UPDATE inspection_logs l SET control_number='KNT-'||n.number
FROM numbered n WHERE l.tenant_id=n.tenant_id AND l.id=n.id;
UPDATE tenants t SET next_control_number=1000+(SELECT count(*) FROM inspection_logs l WHERE l.tenant_id=t.id);
CREATE UNIQUE INDEX inspection_control_number_unique ON inspection_logs(tenant_id,control_number);
