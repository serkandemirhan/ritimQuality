# Vercel + Supabase kurulumu

Bu yapı ana SaaS uygulamasını yayınlar. `on-premise/` ayrı yerel kurulum olarak kalır.

- Vercel: Vite arayüzü ve `/api/*` Express fonksiyonu.
- Supabase PostgreSQL: mevcut tenant, rol, kalite ve audit tabloları.
- Supabase Storage: özel `quality-evidence` bucket; fotoğraf, video, PDF ve teknik resimler.
- Kimlik doğrulama: mevcut çalışma alanı + e-posta + şifre akışı. Bu sürüm Supabase Auth kullanmaz.

## 1. Projeler

GitHub'da boş bir **private** depo ve Supabase'de yeni bir proje oluşturun. Yereldeki `.env`, `.runtime`, `.data`, `node_modules` ve derlenmiş API dosyaları Git'e eklenmez. GitHub depo adresi paylaşıldıktan sonra kaynak kod bu depoya bağlanabilir.

## 2. Supabase ilk kurulum

Supabase **Connect** ekranından iki bağlantı hazırlayın:

1. `MIGRATION_DATABASE_URL`: `postgres` kullanıcısıyla direct bağlantı veya **Session pooler / 5432**. Yalnızca kurulum bilgisayarında kullanılır.
2. `DATABASE_URL`: `qualitrack_app` kullanıcısıyla **Transaction pooler / 6543**. Vercel API bu bağlantıyı kullanır. Kullanıcı adı genellikle `qualitrack_app.PROJECT_REF` biçimindedir; Connect ekranındaki proje ve bölge adresini koruyun.

`DATABASE_SSL=true` kullanın. Projenin sertifika zinciri ayrıca CA gerektiriyorsa Supabase Database Settings içindeki CA sertifikasını `DATABASE_CA_CERT` değişkenine girin. TLS doğrulamasını kapatmayın; URL'ye doğrulamayı devre dışı bırakan SSL parametreleri eklemeyin.

Yerel ve Git tarafından dışlanan `.env.cloud` dosyasında `.env.cloud.example` alanlarını doldurun. Yönetici bağlantısı, özel anahtarlar ve parolalar sohbet mesajına veya GitHub'a yazılmaz.

```powershell
npm ci
npm run supabase:setup
```

Komut sıralı migration'ları uygular, RLS'i atlayamayan `qualitrack_app` rolünü oluşturur, şifresini `QUALITY_DB_PASSWORD` ile ayarlar ve private bucket oluşturur. Mevcut tablo verilerini silmez. `anon`, `authenticated` ve `service_role` rollerinin uygulama tablolarına Data API üzerinden erişimini kaldırır; storage tablolarını değiştirmez. Supabase'in Data API özelliği başka kullanım için gerekmiyorsa ayrıca kapatılabilir.

Uygulama `public` şemasını kullandığı için ilk kurulum için yeni Supabase projesi tercih edin. Mevcut, başka uygulamaya ait bir projede çalıştırmadan önce tablo isimlerini kontrol edin.

## 3. Vercel

GitHub deposunu Vercel'e import edin:

- Root Directory: depo kökü (`on-premise` değil).
- Framework: Vite (vercel.json içinde tanımlı).
- Node.js: 22.x.
- Build: `npm run build`; Output: `dist`.

Vercel Environment Variables:

| Değişken | Değer |
| --- | --- |
| `APP_URL` | Gerçek HTTPS uygulama adresi |
| `VITE_API_URL` | `/api` |
| `DATABASE_URL` | `qualitrack_app` transaction-pooler bağlantısı |
| `DATABASE_SSL` | `true` |
| `DATABASE_POOL_MAX` | `3` |
| `DATABASE_CA_CERT` | Gerekiyorsa Supabase CA sertifikası |
| `JWT_SECRET` | En az 32 karakter, rastgele ve kalıcı gizli değer |
| `JWT_EXPIRES_IN` | `8h` |
| `MEDIA_STORAGE` | `supabase` |
| `SUPABASE_URL` | Supabase proje URL'si |
| `SUPABASE_SECRET_KEY` | Supabase sunucu secret key; legacy `SUPABASE_SERVICE_ROLE_KEY` de desteklenir |
| `SUPABASE_STORAGE_BUCKET` | `quality-evidence` |
| `CRON_SECRET` | En az 32 karakter rastgele değer |

`MIGRATION_DATABASE_URL` ve `QUALITY_DB_PASSWORD` Vercel'e gerekmez; yönetici bağlantısını runtime'a vermeyin. Supabase anahtarları `VITE_` önekiyle tanımlanmaz. Önizleme ortamı için ayrı test Supabase projesi kullanın; preview deploy'larını canlı veritabanına bağlamayın.

## 4. Bildirim ve ödeme

Push için `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:GERCEK_EPOSTA` ekleyin. Anahtarları bir kez oluşturup kalıcı saklayın. Uygulama içi bildirimler push anahtarları olmadan çalışır.

`vercel.json` Hobby ile kurulabilmesi için cron'u **günde bir** çağırır (`0 6 * * *`, UTC). Bu bir dakikalık bildirim teslimi garantisi değildir. Sık push/gecikme kontrolü gerektiğinde Vercel Pro üzerinde `*/1 * * * *` kullanın veya Supabase Cron gibi harici bir zamanlayıcıdan `GET /api/cron/notifications` adresini `Authorization: Bearer CRON_SECRET` başlığıyla çağırın. Çağrı 45 saniyelik bütçeyle en fazla 10 firmayı sırayla işler; ölçek büyüdüğünde ayrı kuyruk/worker gerekir. Endpoint secretsiz çalışmaz.

Stripe isteğe bağlıdır. Otomatik ödeme kullanılacaksa `.env.example` içindeki Stripe değişkenlerini Vercel'e ekleyin ve webhook adresini `APP_URL/api/billing/webhook` yapın. Yeni firma ilk olarak trial hesabı oluşturur. Manuel lisans komutu yalnızca yetkili sunucu yöneticisi tarafından çalıştırılır.

## 5. Dosya akışı

API yetki kontrolünden sonra tek bir nesne için imzalı yükleme adresi verir. Dosya baytları Vercel'e uğramadan Supabase'e gider. Tamamlama API'si boyut ve MIME türünü depolamadan doğrulamadan kaydı kullanıma açmaz. İndirme adresleri yetki kontrolü sonrası 5 dakika için üretilir. Maksimum dosya boyutu 8 MB'dir. Teknik resim kaydı dosya URL'si yerine kalıcı `media:ID#MIME` referansı tutar.

Eski `.data/media` dosyaları otomatik taşınmaz. Canlı geçmiş aktarılacaksa önce veritabanı + dosya envanteri alınmalı ve ayrıca taşınmalıdır. İlk bulut kurulumu boş müşteri ortamı içindir; demo kayıtları otomatik yüklenmez.

## 6. Yayın sonrası kabul

1. `/api/health` JSON ve 200 döndürmeli; bilinmeyen `/api/...` JSON 404 döndürmeli.
2. Yeni firma oluşturma, giriş, ürün ve aktif plan oluşturma.
3. İki farklı firmayla veri izolasyonu; askıya alınmış kullanıcının reddedilmesi.
4. 5–8 MB dosyanın doğrudan yüklenmesi, görüntülenmesi ve farklı firmadan açılamaması.
5. NOK → uygunsuzluk; onay; audit geçmişi.
6. Yeniden gönderilen ölçümün çoğalmaması; tarayıcıda taslaktan devam.
7. Mobil gerçek cihazlar; QR, kamera ve push izni. Cron yetkisiz çağrı 401 döndürmeli.

Kaynaklar: [Vercel Node Functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel payload limitleri](https://vercel.com/docs/functions/limitations), [Vercel cron planları](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Supabase bağlantıları](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase imzalı yükleme](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl).
