# Ritim Quality SaaS

Vercel + Supabase yayını için [kurulum rehberi](docs/VERCEL_SUPABASE.md). Ortam şablonu: [.env.cloud.example](.env.cloud.example).

Kalite kontrol planı, operatör ölçümü, ölçüm geçmişi ve SPC yönetimi için çok kiracılı SaaS uygulaması.

## Bu sürümün kapsamı

- Firma çalışma alanı (tenant) ve güvenli kullanıcı girişi
- Admin, kalite mühendisi, operatör ve denetçi rolleri
- Ürün, revizyonlu kontrol planı ve ölçüm oturumları
- Firma bazında veri izolasyonu ve audit log
- Starter, Pro ve Enterprise paket kotaları
- Stripe Checkout, müşteri portalı ve webhook tabanlı abonelik senkronizasyonu
- SPC ve ölçüm sertifikaları

ERP/MES entegrasyonu, Bluetooth ölçüm cihazı aktarımı ve bildirim altyapısı bu sürümde bulunmaz.

## Yerel kurulum

Gereksinimler: Node.js 20+ ve PostgreSQL 15+.

1. `.env.example` dosyasını `.env` adıyla kopyalayın ve değerleri doldurun.
2. Bağımlılıkları kurun: `npm install`
3. Veritabanını oluşturun ve migration çalıştırın: `npm run db:migrate`
4. İsteğe bağlı demo kayıtlarını yükleyin: `npm run db:seed`
5. API ve web uygulamasını birlikte başlatın: `npm run dev:all`
6. `http://localhost:3000` adresinden giriş yapın veya yeni firma hesabı oluşturun.

## Stripe kurulumu

Stripe Dashboard içinde Starter, Pro ve Enterprise için aylık/yıllık toplam altı recurring Price oluşturun. Price kimliklerini `.env` içindeki karşılıklarına yazın.

Yerel webhook dinleme:

```bash
stripe listen --forward-to localhost:3001/api/billing/webhook
```

Komutun verdiği `whsec_...` değerini `STRIPE_WEBHOOK_SECRET` olarak ayarlayın. Canlı ortamda webhook adresi `https://alan-adiniz/api/billing/webhook` olmalı ve en az şu event'ler seçilmelidir:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Paket, ödeme butonuna basıldığında doğrudan aktif edilmez. Kaynak gerçekliği Stripe webhook'udur; abonelik ve kota durumu webhook işlendiğinde güncellenir.

## Güvenlik notları

- `JWT_SECRET` üretimde uzun ve rastgele olmalıdır.
- Stripe secret ve webhook anahtarlarını `VITE_` ile başlayan değişkenlere koymayın.
- Uygulama için migration sahibi olmayan ayrı bir PostgreSQL rolü kullanın; Row Level Security bu rolde ek tenant koruması sağlar.
- HTTPS, güvenli secret yönetimi, günlük veritabanı yedeği ve rate limiting canlıya geçiş kontrol listesinin parçasıdır.

## Komutlar

- `npm run dev`: React uygulaması
- `npm run dev:api`: Express API
- `npm run dev:all`: Web ve API birlikte
- `npm run db:migrate`: PostgreSQL migration
- `npm run db:seed`: Tekrar çalıştırılabilir demo firma ve kalite kayıtları
- `npm run lint`: Frontend TypeScript kontrolü
- `npm run build:api`: Backend TypeScript derlemesi
- `npm run build`: Üretim frontend paketi
