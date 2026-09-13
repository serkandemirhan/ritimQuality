BEGIN;

INSERT INTO tenants (
  id, slug, name, legal_name, tax_number, tax_office, industry, facility_location,
  contact_email, contact_phone, plan_id, subscription_status, billing_period,
  subscription_renews_at, trial_ends_at, created_at
) VALUES (
  '11111111-1111-4111-8111-111111111111', 'demirhan-demo',
  'Demirhan Hassas Makina & Kalıp A.Ş.',
  'Demirhan Hassas Makina Kalıp ve Otomotiv Yan San. Tic. A.Ş.',
  '2840591283', 'Bursa Nilüfer Vergi Dairesi',
  'Otomotiv Yan Sanayi & Hassas Talaşlı İmalat',
  'Bursa OSB 14. Cadde No: 28 Nilüfer / BURSA',
  'kalite@demirhanmakina.com', '+90 (224) 441 80 90',
  'pro', 'active', 'annual', '2027-04-15', '2027-04-15', '2025-04-15T09:00:00Z'
)
ON CONFLICT (id) DO UPDATE SET
  slug=EXCLUDED.slug, name=EXCLUDED.name, legal_name=EXCLUDED.legal_name,
  tax_number=EXCLUDED.tax_number, tax_office=EXCLUDED.tax_office,
  industry=EXCLUDED.industry, facility_location=EXCLUDED.facility_location,
  contact_email=EXCLUDED.contact_email, contact_phone=EXCLUDED.contact_phone,
  plan_id=EXCLUDED.plan_id, subscription_status=EXCLUDED.subscription_status,
  billing_period=EXCLUDED.billing_period, subscription_renews_at=EXCLUDED.subscription_renews_at,
  updated_at=now();

SELECT set_config('app.tenant_id', '11111111-1111-4111-8111-111111111111', true);

INSERT INTO users (id,tenant_id,name,email,password_hash,role,department,station_or_machine,status,last_login_at) VALUES
('usr-001','11111111-1111-4111-8111-111111111111','Ahmet Kurt','ahmet.kurt@demirhanmakina.com',crypt('1001',gen_salt('bf',12)),'operator','Talaşlı İmalat / Atölye','CNC Torna İstasyon #01','active',now()),
('usr-002','11111111-1111-4111-8111-111111111111','Zeynep Kaya','zeynep.kaya@demirhanmakina.com',crypt('2002',gen_salt('bf',12)),'quality_engineer','Kalite Güvence & Laboratuvar','CMM & Metroloji Odası','active',now()-interval '2 hours'),
('usr-003','11111111-1111-4111-8111-111111111111','Serkan Demirhan','serkan@demirhanmakina.com',crypt('9999',gen_salt('bf',12)),'admin','Genel Yönetim & Fabrika Müdürlüğü','Yönetim Merkezi','active',now()-interval '1 hour'),
('usr-004','11111111-1111-4111-8111-111111111111','Mehmet Ali Çetin','m.cetin@demirhanmakina.com',crypt('1004',gen_salt('bf',12)),'operator','Taşlama & Honlama Bölümü','Puntaşsız Taşlama #03','active',now()-interval '1 day'),
('usr-005','11111111-1111-4111-8111-111111111111','Ayşe Erdem','ayse.erdem@denetim-kalite.org',crypt('5005',gen_salt('bf',12)),'auditor','IATF 16949 / ISO 9001 Dış Denetçi','Denetim Portalı','active',now()-interval '3 days')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,
role=EXCLUDED.role,department=EXCLUDED.department,station_or_machine=EXCLUDED.station_or_machine,status=EXCLUDED.status,updated_at=now();

WITH drawing_source(id,svg) AS (VALUES
  ('prod-001','<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520"><rect width="900" height="520" fill="white"/><text x="40" y="48" font-family="Arial" font-size="24" font-weight="bold" fill="#0f172a">TAHRİK ŞAFTI BURCU</text><text x="40" y="74" font-family="Arial" font-size="13" fill="#64748b">PRD-2026-AUT01 · KESİT GÖRÜNÜŞ</text><g stroke="#0f172a" fill="#e2e8f0" stroke-width="4"><path d="M145 210h105v-55h130v30h300v150H380v30H250v-55H145z"/><path d="M145 245h535v55H145z" fill="white"/></g><g stroke="#64748b" stroke-width="2" fill="none"><path d="M145 410h535M145 390v40M680 390v40"/><path d="M155 402h515"/><path d="M730 185v150M710 185h40M710 335h40"/></g><g font-family="Arial" font-size="17" fill="#334155"><text x="390" y="430">L = 75.00 ±0.08</text><text x="755" y="267" transform="rotate(90 755 267)">Ø32.00 ±0.02</text><text x="390" y="274">Ø20 H7</text></g><path d="M100 272h650" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="10 8"/></svg>'),
  ('prod-002','<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520"><rect width="900" height="520" fill="white"/><text x="40" y="48" font-family="Arial" font-size="24" font-weight="bold" fill="#0f172a">ALÜMİNYUM FLANŞ GÖVDESİ</text><text x="40" y="74" font-family="Arial" font-size="13" fill="#64748b">PRD-2026-FLN02 · ÜST GÖRÜNÜŞ</text><g transform="translate(450 275)" stroke="#0f172a" fill="#e2e8f0" stroke-width="4"><circle r="170"/><circle r="112" fill="white"/><circle r="68" fill="#f8fafc"/><g fill="white"><circle cx="0" cy="-132" r="16"/><circle cx="114" cy="-66" r="16"/><circle cx="114" cy="66" r="16"/><circle cx="0" cy="132" r="16"/><circle cx="-114" cy="66" r="16"/><circle cx="-114" cy="-66" r="16"/></g></g><g stroke="#64748b" stroke-width="2" fill="none"><path d="M280 470h340M280 450v35M620 450v35"/><path d="M290 462h320"/></g><g font-family="Arial" font-size="17" fill="#334155"><text x="390" y="495">Ø110 ±0.10</text><text x="420" y="280">Ø45 H7</text><text x="610" y="130">6x Ø10 / PCD Ø85</text></g><path d="M240 275h420M450 85v380" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="10 8"/></svg>'),
  ('prod-003','<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520"><rect width="900" height="520" fill="white"/><text x="40" y="48" font-family="Arial" font-size="24" font-weight="bold" fill="#0f172a">PLASTİK KONNEKTÖR GÖVDESİ</text><text x="40" y="74" font-family="Arial" font-size="13" fill="#64748b">PRD-2026-PLAS03 · ÖN GÖRÜNÜŞ</text><g stroke="#0f172a" fill="#dbeafe" stroke-width="4"><rect x="245" y="135" width="410" height="260" rx="24"/><path d="M245 205h-55v50h55M655 205h55v50h-55"/><rect x="315" y="195" width="270" height="140" rx="12" fill="white"/><path d="M335 135v-42h70v42M495 135v-42h70v42"/></g><g fill="#cbd5e1" stroke="#334155" stroke-width="3"><circle cx="370" cy="265" r="26"/><circle cx="450" cy="265" r="26"/><circle cx="530" cy="265" r="26"/></g><g stroke="#64748b" stroke-width="2" fill="none"><path d="M245 440h410M245 420v35M655 420v35"/><path d="M255 432h390"/></g><g font-family="Arial" font-size="17" fill="#334155"><text x="392" y="462">340.00 ±0.15</text><text x="680" y="290">3x Ø28 ±0.03</text><text x="340" y="120">Tırnak aralığı 160.00</text></g></svg>')
), drawings AS (
  SELECT id,'data:image/svg+xml;base64,' || encode(convert_to(svg,'UTF8'),'base64') drawing_url FROM drawing_source
)
INSERT INTO products (id,tenant_id,code,name,payload,created_at,updated_at)
SELECT p.id,'11111111-1111-4111-8111-111111111111',p.code,p.name,
  jsonb_build_object('id',p.id,'code',p.code,'name',p.name,'customer',p.customer,'material',p.material,
    'category',p.category,'description',p.description,'defaultDrawingUrl',drawings.drawing_url,
    'createdAt',p.created_at,'updatedAt',p.updated_at),p.created_at::timestamptz,p.updated_at::timestamptz
FROM (VALUES
('prod-001','PRD-2026-AUT01','Otomotiv Tahrik Şaftı Burcu','Bosch / Oyak Renault','16MnCr5 Sementasyon Çeliği','Talaşlı İmalat (CNC Torna & Taşlama)','Şanzıman tahrik mili yataklama burcu. Yüksek hassasiyetli taşlanmış dış çap ve honlanmış iç delik.','2026-08-01T08:00:00Z','2026-08-14T14:30:00Z'),
('prod-002','PRD-2026-FLN02','CNC Alüminyum Flanş Gövdesi','Arçelik / Hidrolik Sistemler','AlSi10Mg Alüminyum Döküm','CNC 5 Eksen İşleme','Yüksek basınç sızdırmazlık flanşı. Cıvata PCD daireleri ve H7 toleranslı merkezleme faturası.','2026-08-03T10:00:00Z','2026-08-12T09:15:00Z'),
('prod-003','PRD-2026-PLAS03','Plastik Konnektör Gövdesi','Schneider Electric','PA66-GF30 (%30 Cam Elyaf Takviyeli Poliamid)','Plastik Enjeksiyon','Elektrik klemens gövdesi. Geçmeli kilit tırnakları ve pin merkezleme yuvaları.','2026-08-05T11:20:00Z','2026-08-10T16:45:00Z')
) AS p(id,code,name,customer,material,category,description,created_at,updated_at)
JOIN drawings ON drawings.id=p.id
ON CONFLICT (tenant_id,id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at;

WITH plans AS (
SELECT * FROM (VALUES
('cp-001-v11','prod-001','v1.1','active',true,'2026-08-10','Müşteri talebiyle dış çap toleransı ±0.02 mm olarak daraltıldı.','Serkan Demirhan','Ahmet Yılmaz',
 jsonb_build_array(
  jsonb_build_object('id','char-101','pointNo',1,'name','Gövde Dış Çapı (ØA)','nominal',32.00,'tolUpper',0.02,'tolLower',-0.02,'usl',32.02,'lsl',31.98,'unit','mm','tool','Mikrometre 0.001','sampleSize','5 Adet / Şarj','frequency','Her 2 saatte bir','criticalClass','critical','pin',jsonb_build_object('x',76.5,'y',47.0),'description','CNC taşlama sonrası ana yataklama çapı.'),
  jsonb_build_object('id','char-102','pointNo',2,'name','İç Delik Çapı (ØB)','nominal',20.00,'tolUpper',0.03,'tolLower',-0.01,'usl',20.03,'lsl',19.99,'unit','mm','tool','CMM 3D Ölçüm Cihazı','sampleSize','3 Adet / Parti','frequency','Vardiya başı ve sonu','criticalClass','critical','pin',jsonb_build_object('x',47.5,'y',47.0)),
  jsonb_build_object('id','char-103','pointNo',3,'name','Toplam Parça Boyu (L)','nominal',75.00,'tolUpper',0.08,'tolLower',-0.08,'usl',75.08,'lsl',74.92,'unit','mm','tool','Dijital Kumpas 0.01','sampleSize','5 Adet / Kasa','frequency','Saat başı','criticalClass','major','pin',jsonb_build_object('x',47.5,'y',16.0)),
  jsonb_build_object('id','char-104','pointNo',4,'name','Flanş Baş Çapı (ØD)','nominal',48.00,'tolUpper',0.05,'tolLower',-0.05,'usl',48.05,'lsl',47.95,'unit','mm','tool','Dijital Kumpas 0.01','sampleSize','5 Adet / Şarj','frequency','Her saatte bir','criticalClass','major','pin',jsonb_build_object('x',19.0,'y',47.0)),
  jsonb_build_object('id','char-105','pointNo',5,'name','Pah Açısı & Boyutu','nominal',45.0,'tolUpper',1.0,'tolLower',-1.0,'usl',46.0,'lsl',44.0,'unit','°','tool','Profil Projeksiyon / Optik','sampleSize','2 Adet','frequency','Takım değişiminde','criticalClass','minor','pin',jsonb_build_object('x',72.5,'y',24.0)),
  jsonb_build_object('id','char-106','pointNo',6,'name','Yüzey Pürüzlülüğü (Ra)','nominal',0.80,'tolUpper',0.20,'tolLower',-0.20,'usl',1.00,'lsl',0.60,'unit','Ra','tool','Yüzey Pürüzlülük (Surftest)','sampleSize','3 Adet / Parti','frequency','Taş bileme sonrası','criticalClass','major','pin',jsonb_build_object('x',56.5,'y',24.5))
 )),
('cp-001-v10','prod-001','v1.0','archived',false,'2026-08-01','İlk seri üretim onaylı kontrol planı.','Serkan Demirhan','Ahmet Yılmaz',
 jsonb_build_array(jsonb_build_object('id','char-101-old','pointNo',1,'name','Gövde Dış Çapı (ØA)','nominal',32.00,'tolUpper',0.03,'tolLower',-0.03,'usl',32.03,'lsl',31.97,'unit','mm','tool','Mikrometre 0.001','sampleSize','5 Adet','frequency','Her 2 saatte bir','criticalClass','critical','pin',jsonb_build_object('x',76.5,'y',47.0)))),
('cp-002-v20','prod-002','v2.0','active',true,'2026-08-12','5-Eksen işleme fikstürü revizyonu sonrası PCD toleransı güncellendi.','Burak Demir','Mehmet Kaya',
 jsonb_build_array(
  jsonb_build_object('id','char-201','pointNo',1,'name','Flanş Dış Çapı (Ø110)','nominal',110.00,'tolUpper',0.10,'tolLower',-0.10,'usl',110.10,'lsl',109.90,'unit','mm','tool','Dijital Kumpas 0.01','sampleSize','5 Adet','frequency','Parti başı','criticalClass','major','pin',jsonb_build_object('x',28.5,'y',22.0)),
  jsonb_build_object('id','char-202','pointNo',2,'name','PCD Cıvata Dairesi (Ø85)','nominal',85.00,'tolUpper',0.05,'tolLower',-0.05,'usl',85.05,'lsl',84.95,'unit','mm','tool','CMM 3D Ölçüm Cihazı','sampleSize','3 Adet','frequency','Vardiya başı','criticalClass','critical','pin',jsonb_build_object('x',28.5,'y',82.0)),
  jsonb_build_object('id','char-203','pointNo',3,'name','Merkez Delik Çapı (Ø45 H7)','nominal',45.00,'tolUpper',0.025,'tolLower',0.00,'usl',45.025,'lsl',45.00,'unit','mm','tool','Geçer / Geçmez Tampon Mastar','sampleSize','100%','frequency','100% Operatör kontrolü','criticalClass','critical','pin',jsonb_build_object('x',28.5,'y',46.0)),
  jsonb_build_object('id','char-204','pointNo',4,'name','Flanş Et Kalınlığı','nominal',25.00,'tolUpper',0.08,'tolLower',-0.08,'usl',25.08,'lsl',24.92,'unit','mm','tool','Dijital Kumpas 0.01','sampleSize','5 Adet','frequency','Saat başı','criticalClass','major','pin',jsonb_build_object('x',57.0,'y',18.0))
 )),
('cp-003-v10','prod-003','v1.0','active',true,'2026-08-05','Kalıp deneme baskısı (T1) onaylı kontrol planı.','Caner Özkan','Murat Eren',
 jsonb_build_array(
  jsonb_build_object('id','char-301','pointNo',1,'name','Geçme Tırnak Aralığı','nominal',160.00,'tolUpper',0.05,'tolLower',-0.05,'usl',160.05,'lsl',159.95,'unit','mm','tool','Profil Projeksiyon / Optik','sampleSize','5 Adet / Koli','frequency','Her 4 saatte bir','criticalClass','critical','pin',jsonb_build_object('x',42.0,'y',16.0)),
  jsonb_build_object('id','char-302','pointNo',2,'name','Dış Gövde Genişliği','nominal',340.00,'tolUpper',0.15,'tolLower',-0.15,'usl',340.15,'lsl',339.85,'unit','mm','tool','Dijital Kumpas 0.01','sampleSize','3 Adet','frequency','Vardiya başı','criticalClass','major','pin',jsonb_build_object('x',42.0,'y',72.0)),
  jsonb_build_object('id','char-303','pointNo',3,'name','Pin Yuvası Çapı (Ø28)','nominal',28.00,'tolUpper',0.03,'tolLower',-0.03,'usl',28.03,'lsl',27.97,'unit','mm','tool','CMM 3D Ölçüm Cihazı','sampleSize','5 Adet','frequency','Hammadde şarj değişiminde','criticalClass','critical','pin',jsonb_build_object('x',42.0,'y',45.0))
 ))
) v(id,product_id,version,status,is_active,revision_date,revision_note,author,approved_by,characteristics))
INSERT INTO control_plans(id,tenant_id,product_id,version,status,is_active,payload,created_at,updated_at)
SELECT p.id,'11111111-1111-4111-8111-111111111111',p.product_id,p.version,p.status::text,p.is_active,
 jsonb_build_object('id',p.id,'productId',p.product_id,'version',p.version,'revisionDate',p.revision_date,
 'revisionNote',p.revision_note,'isActive',p.is_active,'status',p.status,'author',p.author,'approvedBy',p.approved_by,
 'drawingImageUrl',(SELECT payload->>'defaultDrawingUrl' FROM products WHERE tenant_id='11111111-1111-4111-8111-111111111111' AND id=p.product_id),
 'characteristics',p.characteristics,'createdAt',p.revision_date||'T09:00:00Z','updatedAt',p.revision_date||'T09:00:00Z'),
 (p.revision_date||'T09:00:00Z')::timestamptz,(p.revision_date||'T09:00:00Z')::timestamptz
FROM plans p
ON CONFLICT (tenant_id,id) DO UPDATE SET product_id=EXCLUDED.product_id,version=EXCLUDED.version,status=EXCLUDED.status,
is_active=EXCLUDED.is_active,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at;

DO $$
DECLARE
  i int; s int; samples jsonb; vals jsonb; stats jsonb; v101 numeric; v102 numeric; v103 numeric; v104 numeric; v105 numeric; v106 numeric;
  overall text; fail_count int; warn_count int; ts timestamptz; op text; machine text;
BEGIN
  FOR i IN 1..24 LOOP
    samples := '[]'::jsonb; fail_count := 0; warn_count := 0;
    FOR s IN 1..5 LOOP
      v101 := round((32.000 + sin(i*1.5+s)*0.012)::numeric,3);
      IF i % 8 = 0 AND s = 5 THEN v101 := 32.025; END IF;
      v102 := round((20.012 + cos(i*1.2+s)*0.009)::numeric,3);
      v103 := round((75.015 + sin(i*0.9+s)*0.035)::numeric,2);
      v104 := round((48.008 + cos(i*1.1+s)*0.022)::numeric,2);
      v105 := round((45.0 + sin(i+s)*0.3)::numeric,1);
      v106 := round((0.78 + cos(i+s)*0.07)::numeric,2);
      vals := jsonb_build_object('char-101',v101,'char-102',v102,'char-103',v103,'char-104',v104,'char-105',v105,'char-106',v106);
      stats := jsonb_build_object(
        'char-101',CASE WHEN v101<31.98 OR v101>32.02 THEN 'fail' WHEN v101<31.984 OR v101>32.016 THEN 'warning' ELSE 'pass' END,
        'char-102',CASE WHEN v102<19.99 OR v102>20.03 THEN 'fail' WHEN v102<19.995 OR v102>20.025 THEN 'warning' ELSE 'pass' END,
        'char-103',CASE WHEN v103<74.92 OR v103>75.08 THEN 'fail' ELSE 'pass' END,
        'char-104',CASE WHEN v104<47.95 OR v104>48.05 THEN 'fail' ELSE 'pass' END,
        'char-105',CASE WHEN v105<44 OR v105>46 THEN 'fail' ELSE 'pass' END,
        'char-106',CASE WHEN v106<0.60 OR v106>1.00 THEN 'fail' ELSE 'pass' END);
      fail_count := fail_count + (SELECT count(*) FROM jsonb_each_text(stats) e WHERE e.value='fail');
      warn_count := warn_count + (SELECT count(*) FROM jsonb_each_text(stats) e WHERE e.value='warning');
      samples := samples || jsonb_build_array(jsonb_build_object('sampleIndex',s,'values',vals,'statuses',stats));
    END LOOP;
    overall := CASE WHEN fail_count>0 THEN 'fail' WHEN warn_count>0 THEN 'warning' ELSE 'pass' END;
    ts := '2026-08-15T08:00:00Z'::timestamptz - (i*8||' hours')::interval;
    op := (ARRAY['Ahmet Kurt','Mehmet Ali Çetin','Zeynep Kaya','Ahmet Kurt','Mehmet Ali Çetin'])[(i%5)+1];
    machine := (ARRAY['CNC Torna #01 (Doosan)','CNC Torna #02 (Mazak)','Taşlama #04 (Studer)','5-Eksen Freze #02 (DMG Mori)'])[(i%4)+1];
    INSERT INTO inspection_logs(id,tenant_id,product_id,control_plan_id,session_code,occurred_at,payload)
    VALUES ('log-2026-0815-'||lpad(i::text,3,'0'),'11111111-1111-4111-8111-111111111111','prod-001','cp-001-v11',
      'INS-20260815-'||lpad(i::text,3,'0'),ts,
      jsonb_build_object('id','log-2026-0815-'||lpad(i::text,3,'0'),'sessionCode','INS-20260815-'||lpad(i::text,3,'0'),
      'productId','prod-001','productCode','PRD-2026-AUT01','productName','Otomotiv Tahrik Şaftı Burcu',
      'controlPlanId','cp-001-v11','controlPlanVersion','v1.1','operatorName',op,
      'lotNumber','LOT-2026-08'||lpad((15-(i/3))::text,2,'0')||'-A','orderNumber','IE-884'||(20+i),
      'machineNo',machine,'sampleCount',5,'overallStatus',overall,'totalPointsChecked',30,
      'failedPointsCount',fail_count,'warningPointsCount',warn_count,'timestamp',to_char(ts AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'notes',CASE WHEN fail_count>0 THEN 'Taşlama taşı ve soğutma sıvısı debisi kontrol edildi.' ELSE 'Seri üretim ölçümleri şartnameye uygundur.' END,
      'samples',samples))
    ON CONFLICT (tenant_id,id) DO UPDATE SET payload=EXCLUDED.payload,occurred_at=EXCLUDED.occurred_at;
  END LOOP;
END $$;

INSERT INTO audit_logs(tenant_id,actor_user_id,action,entity_type,entity_id,after_data)
SELECT '11111111-1111-4111-8111-111111111111','usr-003','demo.seeded','tenant','11111111-1111-4111-8111-111111111111',
 jsonb_build_object('users',5,'products',3,'controlPlans',4,'inspectionLogs',24)
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE tenant_id='11111111-1111-4111-8111-111111111111' AND action='demo.seeded');

COMMIT;
