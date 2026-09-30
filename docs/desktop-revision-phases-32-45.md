# Arayüz revizyonu — Faz 32–45

31 (çoklu dil) kullanıcı kararıyla ertelendi; arayüz Türkçe kalır. Önceki yerel değişiklikler korunarak 32–35'te kalan modal/klavye doğrulamasından devam edildi.

## Uygulama

| Faz | Sonuç |
| --- | --- |
| 32 | İçeriğe geç bağlantısı, alan yardım metni bağlantıları, sekmelerde ok/Home/End tuşları, modal odak döngüsü ve Escape; yarım kalan TypeScript hatası düzeltildi. |
| 33 | Ortak modal, seçim ve sonuç geçişleri kısa tutulur; azaltılmış hareket tercihi korunur. |
| 34 | Mevcut grafik, seçili gezinme, durum ve ilerleme vurguları korunur; dekoratif pulse eklenmez. |
| 35 | 13 masaüstü ekranı 1920/1440/1366/1280 genişliklerinde, klavye ve azaltılmış hareketle doğrulandı. |
| 36–37 | Mevcut mobil menü erişilebilir modal oldu; Escape/odak dönüşü ve masaüstüne geçişte kapanma eklendi. Alt menü görev, ölçüm ve kayıtları rol izinlerine göre gösterir. |
| 38 | Telefon terminali kimlik/numune bilgisi, teknik resim ve büyük ölçüm girişiyle tek sütun oldu. Mevcut tuş takımı, önceki/sonraki ve kayıt eylemleri korunur; eylemler yapışkan alandadır. |
| 39 | Aktif telefon taraması tam ekran; mevcut kod/URL biçimi ve elle giriş korunur. Kamera desteği/izin hataları açıklanır; destekleyen cihazlarda fener kontrolü bulunur. Geçersiz QR sonrası kamera durur. |
| 40–41 | Görev/onay tabloları telefonda aynı veri ve işlemlerle etiketli kartlara dönüşür; karar formları alt panel olur. |
| 42 | Uygunsuzluk kartları ve mevcut düzenleme çekmecesi mobil alt panele uyarlanır. Bağımsız NC oluşturma API'si bulunmadığından yeni oluşturma akışı eklenmedi; mevcut ölçüm kaynaklı davranış korunur. |
| 43 | Ortak kontrollerde 44px hedefler, okunabilir alanlar, daha kompakt özetler ve güvenli ekran kenarı boşlukları. |
| 44 | Overview ve SPC ayrı dinamik modüllere taşındı; yükleme sırasında sabit boyutlu iskeletler gösterilir. Yeni animasyon kütüphanesi eklenmedi. |
| 45 | Yerel fixture ile regresyon testleri ve üretim derlemesi; fiziksel cihaz/canlı servis sınırları aşağıdadır. |

## Tekrarlama

Son çalıştırmada **155 tarayıcı kontrolü geçti**:

- Masaüstü/klavye/azaltılmış hareket: 74.
- Kalite akışları, rapor, CSV/Excel, SPC ve OK/NOK: 20.
- Kullanıcılar, roller, ayarlar, audit, abonelik ve bildirimler: 16.
- Mobil görünüm, menü odağı, görev/onay/uygunsuzluk, QR fallback ve terminal: 28.
- Ürün/plan düzenleme, iptal/kaydetme, tolerans ve QR iş emri aktarımı: 13.
- İkinci kontrolde eklenen mobil menü, gecikmiş QR ve fixture reset regresyonları: 4.

`npm run lint` başarılı. Üretim derlemesinde Overview (~6.6 kB), SPC (~51.1 kB) ve ortak grafik kodu (~359.2 kB) ayrı dosyalardır; ana JS ~494.2 kB (gzip ~146.4 kB). Önceki 500 kB paket uyarısı çıkmadı. Bunlar paket boyutlarıdır; gerçek cihaz performans ölçümü değildir.

Derlemeyle eşzamanlı ilk kalite testinde görev oluşturma sonrası sabit bekleme süresi yetersiz kaldı; derleme bittikten sonra aynı 20 kontrolün tamamı geçti. Mobil kaydetme kontrolleri sabit süre yerine modal kapanışını/veri güncellemesini bekler.

Yerel fixture sunucusu: `node --import tsx tests/desktop-review-server.mjs`

Tarayıcı testlerini aynı anda değil, sırayla çalıştırın:

```text
node tests/desktop-validation-32-35.mjs
node tests/desktop-workflows-11-20.mjs
node tests/desktop-workflows-21-30.mjs
node tests/mobile-revision-36-43.mjs
node tests/desktop-revision-browser.mjs
node tests/revision-edge-cases.mjs
npm run test:revisions
npm run lint
npm run build
```

Yeni sonuçlar ve ekran görüntüleri: `output/desktop-revision/phases-32-35/` ve `output/desktop-revision/phases-36-43/`.

## Doğrulama sınırları

- Test sunucusu yalnızca 127.0.0.1 üzerinde bellek içi veriler kullanır; canlı veritabanına kayıt, ödeme, fiziksel yazıcı veya push gönderimi yapılmaz.
- Telefon görünümü Edge emülasyonunda 360/390/768px ile kontrol edilir; gerçek iOS/PWA kamera izni, fiziksel QR taraması ve fener donanımı ayrıca cihaz üzerinde denenmelidir.
- UI regresyonu gerçek backend yayınlama/yetkilendirme uçlarının uçtan uca sertifikasyonu değildir. Backend/domain mantığı değiştirilmedi.
- Dil sistemi ertelendiği için İngilizce/Fransızca doğrulaması kapsam dışıdır.
- Değişiklikler yereldir; commit, deploy veya migrasyon yapılmadı.

## İkinci kontrol — 30 Eylül 2026

Tekrar incelemede önceki 151 kontrolün kapsamadığı üç arayüz sorunu bulundu ve düzeltildi:

- Mobil menü ve gizli masaüstü menüsü aynı DOM kimliklerini kullanıyordu; mobil öğeler artık ayrı kimlik kullanır.
- Ayarlar zaten açıkken mobil menüde Kişisel ayarlar seçimi menüyü kapatmıyordu; seçim artık menüyü her durumda kapatır.
- Kamera kapandıktan sonra bekleyen QR algılama sonucu ürün seçimini değiştirebiliyordu; iptal edilmiş algılama sonuçları artık işlenmez.

Test sunucusunun reset uç noktası ürün ve kontrol planlarını geri yüklemiyordu. Önceki ürün/plan testinden kalan tolerans değişikliği, sonraki çalıştırmada yanlış test hatası üretiyordu. Fixture reset'i artık ürün, plan ve ölçüm verilerini de geri yükler; canlı API değiştirilmedi.

Bu dört durum `tests/revision-edge-cases.mjs` ile doğrulandı. Kamera yarışı testi kontrollü bir tarayıcı taklidi kullanır; fiziksel kamera testi değildir. Mevcut dört hesaplama/CSV/Excel birim testi de geçti.

Tüm altı tarayıcı paketi düzeltmelerden sonra tek sırada yeniden geçti (155 kontrol). Ürün/plan düzenleme testi bu kez kalite akışlarından önce çalıştırılarak reset düzeltmesi testler arasında da doğrulandı. TypeScript kontrolü başarılı.
