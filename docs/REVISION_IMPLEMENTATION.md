# Satış öncesi revizyonlar

Kaynak: `revizyonlar.md`. Bu değişiklikler ana Cloud uygulamasına uygulanır; `on-premise/` ayrı dağıtım olarak korunur.

## Uygulanan akışlar

| Maddeler | Sonuç |
|---|---|
| Q-001–010, Q-013–017 | Role göre açılış, yalnız Genel Bakış üzerinde onboarding, beş KPI, 30 günlük trend/önceki dönem farkı, son kontroller, dikkat gerektirenler; Aksiyonlar üç sekme; otomatik yenileme. |
| Q-012 | Organizasyon altında tesis → bölüm → istasyon. Tenant kapsamlı yeni `stations` tablosu. |
| Q-018–019, Q-026–030 | Ortak boş durum bileşeni, ilk ürün/plan çağrısı, teknik resim önizlemesi, gerçek aktif plan bilgisi, Türkçe durumlar, arşivleme ve üründen doğru plana geçiş. |
| Q-020–025, Q-046 | Ayrı demo oluşturma komutu: üç ürün, üç aktif plan, 48 kontrol, otomatik uygunsuzluk/onaylar, üç görev, üç anonim rol. Mevcut müşteri veya mevcut demo üzerine yazmaz. |
| Q-031–039 | Aktif plan otomatik seçilir; operatör planı değiştiremez. Atanmış istasyon kullanılır. Ürün seçilmeden ayrıntılar gizlenir. Özel numune alanı etiketlenir. QR tarama ve etiket oluşturma ayrılır. Teknik resim, pinler ve anlık tolerans rengi korunur. |
| Q-040 | Başarılı NOK kaydı, mevcut sunucu işlemi içinde otomatik uygunsuzluk açar. Operatöre kayıt sonrası bildirilir; kalite yöneticisi aksiyon ekranına geçebilir. Eksik ölçümle ayrı uygunsuzluk açılarak kayıt bütünlüğü atlanmaz. |
| Q-041–045 | Gelişmiş filtre grubu, normal arama alanı, CSV/Excel dışa aktarma. Veri yoksa yüzde yerine çizgi. Tolerans içindeki uyarılar uygunluk oranına dahildir. |
| Q-047–058 | Operatör ölçümle, yönetici/kalite Genel Bakış ile başlar. Yönetim menüsü rol bazlıdır. Abonelik Ayarlar altındadır. Starter/Professional/Enterprise; `VITE_HIDE_PRICES=true` fiyatları gizler. Cloud metinleri düzeltilir. |
| Q-059–064 | Veri Yönetimi Ayarlar altında; Cloud üzerinde çalışmayan tarayıcı restore/reset arayüzü gizlenir. Yerel geri yükleme onayı eklenir. Silme/geçersiz kılma ve iş akışı audit mekanizmaları korunur. |
| Q-065–074 | Gruplanmış menü, header zil paneli ve okunmamış sayısı, kullanıcı/profil menüsü, sade footer, ortak rol/plan/kaynak terimleri. |
| Q-075–086 | Ortak kart/buton/boş durum bileşenleri, tek aktif sekme görünümü ve ayrı klavye odağı, kaydetme kilitleri, başarı bildirimi, responsive düzen ve menüsüz odak modu. |
| Q-087–089 | Çalışan SPC ve rapor fonksiyonları korunur; hazır olmayan CMM seçeneği gizlenir. Mevcut yazdırılabilir kontrol raporu kaldırılmaz. |
| Q-090–096 | Öncelik, ürün/ölçüm/uygunsuzluk bağlantısı, görev başlatma ve durumları; önem seviyesi, onay rolü açıklaması, mevcut önce/sonra denetim izi. |
| Q-097–100 | Ürün → ilgili plan → ölçüm; uygunsuzluk/görev → kaynak ölçüm; kayıtlar → plan/SPC bağlantıları. Sabit sayfa yerleşimi ve responsive kontroller. |

## Korunan iş kuralları

- Ölçüm sonucu, kullanıcı ve plan snapshot'ı sunucuda doğrulanır.
- Yalnız aktif revizyonla yeni ölçüm alınır. Kullanılmış revizyonun toleransları değiştirilemez.
- Aynı ölçümün tekrar gönderimi kayıt çoğaltmaz.
- Kullanıcı kendi ölçümünü onaylayamaz. Uygunsuzluk kapanışında farklı kalite yetkilisi gerekir.
- Tenant izolasyonu, abonelik kontrolleri, rol yetkileri ve değiştirilemez ölçüm/denetim geçmişi korunur.
- Yeni istasyon ve görev ilişkileri bileşik tenant foreign key ve RLS ile sınırlandırılır.

## Yayın sırası

Önce migration `009_sales_workflow.sql` ve ardından `010_inspection_drafts.sql`, sonra uygulama yayını. Yeni görev alanları, organizasyon ekranı ve operatörler arası ölçüm taslağı devri bu migration'lara bağlıdır. Standart migration komutu, dolu `.env.cloud` ile:

```powershell
node --env-file=.env.cloud --import tsx server/db/migrate.ts
```

Satış demo kurulumu ayrı bir işlem olarak hazırlanmıştır. `DEMO_WORKSPACE` (`-demo` son ekli yeni bir çalışma alanı) ve en az 10 karakterli `DEMO_PASSWORD` ortam değişkenleri tanımlandıktan sonra:

```powershell
node --env-file=.env.cloud --import tsx tools/sales-demo.ts
```

Hesaplar: `admin@example.com`, `quality@example.com`, `operator01@example.com`. Şifre komutta üretilmez/yazdırılmaz; verilen `DEMO_PASSWORD` kullanılır. Demo 14 günlük deneme olarak oluşturulur; kalıcı lisans mevcut yetkili lisans akışından yönetilir.

Excel seçeneği Excel'in açabildiği SpreadsheetML (`.xml`) üretir; dosya uzantısı değiştirilmiş CSV değildir. `.xlsx` paket biçimi bu sürümde yoktur.

## Bekleyen veri işlemi

Q-011: Canlı test verisi silinmedi. Çalışma alanı ve kesin kayıt kapsamı kullanıcıdan bekleniyor. `REVIEW_WORKSPACE` ile `tools/review-test-records.ts` salt okunur `tt`/`tty` envanteri ve ölçüm bağımlılıklarını çıkarır. Ölçüm geçmişi veya müşteriye ait kayıtlar adlarına bakılarak silinmez.

Canlı Supabase migration/demo kurulumu ve Vercel yayını bu çalışma sırasında yapılmadı. İzole test veritabanında migration ve demo kurulumu doğrulandı.

## Kontrol noktası ve vardiya devri iyileştirmeleri

- Kontrol planı düzenleyicisi varsayılan olarak tek karakteristiği açar; 1–50 numara şeridi, önceki/sonraki gezinme ve birden fazla satırı açık tutabilen kompakt toplu görünüm sunar.
- Ürün seviyesinde birden fazla görsel saklanır. Karakteristik–görsel bağlantıları aynı fiziksel dosyayı çoğaltmadan pin, ölçüm çizgisi, alan ve not anotasyonlarını yüzde koordinatlarıyla korur.
- Eski tek teknik resim ve pin verileri uyumluluk bağlantılarıyla açılır. Görsel kullanımı isteğe bağlıdır.
- Devam eden ölçüm sunucu taslağı olarak kaydedilebilir veya serbest bırakılarak başka operatöre devredilebilir. Kilit, tenant ve aktif plan kontrolleri sunucuda uygulanır; tamamlayan operatör kayıt üzerinde sunucu tarafından belirlenir.
- Son ölçüm noktasında Sonraki düğmesi kapanır ve tamamlanan ölçümü kaydetme/PDF eylemi vurgulanır.

## Kontroller

`npm run lint`, `npm run build:api`, `npm run build`, `npm run test:cloud`, `npm run test:revisions`, `node tests/api-integration.mjs`, `node tests/mobile-browser.mjs`.

API testleri yalnız localhost:55439 test PostgreSQL kümesini kullanır. Tarayıcı testleri localhost:3300 üzerindeki izole uygulamayı kullanır; canlı ortama bağlı çalıştırılmamalıdır.
