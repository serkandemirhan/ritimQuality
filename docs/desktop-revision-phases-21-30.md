# Desktop arayüz revizyonu — Phase 21–30

Önceki 0–20 fazlarının üzerine devam edildi. Bu aşama 21–30 kapsamını tamamlar; tüm master prompt henüz tamamlanmış değildir.

| Faz | Uygulanan değişiklik |
| --- | --- |
| 21 | Overview ve SPC için ortak eksen, tooltip ve semantik grafik renkleri; alt grup tarih biçimi |
| 22 | Kontrol detayında ürün, plan, iş emri, parti/seri, istasyon, operatör ve kontrol ilişkileri; aynı ölçüm kimliğine bağlı uygunsuzluk/onay bilgileri |
| 23 | Kullanıcı metrikleri, filtreler, ortak tablo ve bölümlü erişilebilir ekleme/düzenleme modalı |
| 24 | Mevcut sunucu yetkilerine dayanan salt okunur rol matrisi |
| 25 | Ortak ayar sekmeleri, kartlar, form alanları ve cihaz/çalışma alanı eylemleri |
| 26 | Mevcut üç ölçüm iş kuralını açıklayan tablo, zorunlu/isteğe bağlı durumu ve ortak anahtarlar |
| 27 | Salt okunur denetim tablosu; zaman, kullanıcı, işlem, kayıt ve IP; önce/sonra detay çekmecesi |
| 28 | Ortak veri yönetimi modalı; JSON kapsamı ve mevcut geliştirme ortamı koşuluyla görünür veri değiştirme alanı |
| 29 | Açık abonelik çalışma alanı, gerçek kota kullanımı, plan karşılaştırması ve ortak firma/fatura formu |
| 30 | Ortak bildirim listesi, okunma durumu ve klavyeyle kullanılabilen bildirim çekmecesi |

## Kapsam ve korunan davranış

- Backend, API şeması, yetki kuralları ve SPC hesaplama motoru değiştirilmedi.
- İzlenebilirlik ilişkileri `inspection_id === log.id` eşleşmesine dayanır. Kimlik ilişkileri olay tarihçesi gibi sunulmaz; olmayan zamanlar/ilişkiler üretilmez.
- Rol matrisi bilgilendirme amaçlıdır; yetkilendirme kaynağı değildir. Yeni tesis bazlı izin sistemi eklenmedi.
- İş kurallarına yeni öncelik, tetikleyici veya kopyalama işlevi eklenmedi; mevcut üç boolean alan korunur.
- Audit API'nin son 500 kayıt kapsamı korunur. Mevcut olmayan filtre, export ve değişiklik işlemleri eklenmedi.
- Veri içe aktarma/sıfırlama, önceki `DEV && !company.id` koşulunda kalır ve mevcut onaylarını kullanır. Cloud üzerinde bu eylemler gösterilmez.
- Abonelikte mevcut plan, fiyat gizleme koşulu, ödeme portalı ve checkout callback'leri korunur. Sınırsız kotalarda yapay yüzde çubukları kaldırıldı; sınırlı kotalar gerçek oranı gösterir.
- Bildirimler mevcut okundu API'sini ve kategori yönlendirmelerini kullanır. Yeni bildirim türü veya filtre eklenmedi.
- Mobil yeniden tasarım başlamadı. Ortak tablonun görünmez erişilebilirlik başlıklarının dar ekranda taşması düzeltildi.

## Doğrulama

- 21–30 ekranları: 1920, 1440, 1366, 1280 ve 390 px; JS hatası ve belge taşması kontrolü.
- Test aracına aktif ekran kontrolü eklendi: ilk veri yüklemesiyle yanlışlıkla Genel Bakış'a dönülmesi artık başarılı sonuç üretmez. Taşma kontrolü istenen viewport genişliğini esas alır.
- Yönetim akışında 16 kontrol: kullanıcı ekleme/düzenleme/arama, Escape ve odak dönüşü, rol kısıtları, kalıcı el tercihi, iş kuralı kaydetme, audit önce/sonra, JSON indirme, Cloud veri kontrolleri, faturalandırma dönemi, şirket kaydı, izlenebilirlik, bildirim okuma/yönlendirme.
- Önceki 11–20 regresyon paketi: görev atama/tamamlama, uygunsuzluk düzenleme, onay/red, ölçüm/spec, rapor/PDF, filtreli CSV/Excel, SPC filtresi ve terminal OK/NOK dahil 20 kontrol başarılı.
- TypeScript ve üretim derlemesi kontrol edildi. Mevcut büyük paket uyarısı devam ediyor; performans fazı 44 henüz uygulanmadı.
- Testler 127.0.0.1 üzerinde bellek içi fixture kullanır. Canlı veritabanı, gerçek ödeme ve fiziksel cihaz bildirimi testi yapılmadı.

## Tekrarlama ve artefaktlar

Sunucu: `node --import tsx tests/desktop-review-server.mjs`

Yönetim akışları: `node tests/desktop-workflows-21-30.mjs`

Önceki kalite akışları: `node tests/desktop-workflows-11-20.mjs`

Ekran kontrolü örneği: `node tests/desktop-phase-browser.mjs 23 users`

Sonuçlar: `output/desktop-revision/phase-workflow-21-30/checks.json`

Galeri: `output/desktop-revision/phases-21-30.html`

Testler aynı Edge portunu/profilini kullanır; tarayıcı testlerini sırayla çalıştırın. Fixture reset endpoint'i yalnızca yerel test sunucusundadır.

## Devam noktası

**Güncel karar: 31 — Dil sistemi ertelendi; uygulama Türkçe kalır.** 32–45 çalışmasının devamı ve doğrulama sınırları [son ilerleme kaydında](desktop-revision-phases-32-45.md) tutulur.

Değişiklikler yereldir; commit, yayın veya veritabanı migrasyonu yapılmadı.
