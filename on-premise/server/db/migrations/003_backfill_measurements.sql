INSERT INTO measurement_results(
  tenant_id,inspection_id,sample_index,characteristic_id,point_no,characteristic_name,characteristic_type,
  value,numeric_value,nominal,lsl,usl,unit,status,source,product_id,product_revision,lot_number,serial_number,
  work_order,equipment_id,operator_name,measured_at
)
SELECT l.tenant_id,l.id,(sample->>'sampleIndex')::integer,value.key,
  COALESCE((characteristic->>'pointNo')::integer,0),COALESCE(characteristic->>'name',value.key),COALESCE(characteristic->>'type','numeric'),
  value.value,CASE WHEN jsonb_typeof(value.value)='number' THEN (value.value#>>'{}')::double precision END,
  CASE WHEN COALESCE(characteristic->>'type','numeric')='numeric' THEN (characteristic->>'nominal')::double precision END,
  CASE WHEN COALESCE(characteristic->>'type','numeric')='numeric' THEN (characteristic->>'lsl')::double precision END,
  CASE WHEN COALESCE(characteristic->>'type','numeric')='numeric' THEN (characteristic->>'usl')::double precision END,
  characteristic->>'unit',sample->'statuses'->>value.key,COALESCE(l.payload->>'source','manual'),l.product_id,
  COALESCE(l.payload->>'productRevision',product.payload->>'revision',''),l.payload->>'lotNumber',l.payload->>'serialNumber',
  l.payload->>'orderNumber',COALESCE(l.payload->>'equipmentId',l.payload->>'machineNo'),l.payload->>'operatorName',l.occurred_at
FROM inspection_logs l
JOIN control_plans plan ON plan.tenant_id=l.tenant_id AND plan.id=l.control_plan_id
JOIN products product ON product.tenant_id=l.tenant_id AND product.id=l.product_id
CROSS JOIN LATERAL jsonb_array_elements(l.payload->'samples') sample
CROSS JOIN LATERAL jsonb_each(sample->'values') value
LEFT JOIN LATERAL (
  SELECT item characteristic FROM jsonb_array_elements(plan.payload->'characteristics') item WHERE item->>'id'=value.key LIMIT 1
) characteristic_match ON true
WHERE value.value<>'null'::jsonb AND sample->'statuses'->>value.key IN('pass','warning','fail')
ON CONFLICT(tenant_id,inspection_id,sample_index,characteristic_id) DO NOTHING;
