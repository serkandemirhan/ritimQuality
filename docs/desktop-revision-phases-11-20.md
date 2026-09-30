# Desktop arayüz revizyonu — Phase 11–20

Phase 0–10 ortak tasarım sistemi üzerinde, mevcut API ve iş akışları korunarak uygulandı.

| Faz | Sonuç |
| --- | --- |
| 11 | Ürün/iş emri alanları, QR etiket önizlemesi ve mevcut PNG indirme |
| 12 | Ayrı operatör çalışma alanı, ürün/iş emri/istasyon/operatör kimliği, ilerleme, büyük değer, açık OK/NOK durumu |
| 13 | Öncelik, termin, sorumlu ve ilişkileri gösteren görev tablosu; atama/başlatma ve gerekçeli tamamlama |
| 14 | Uygunsuzluk tablosu, sağ detay çekmecesi, mevcut önlem/kök neden/aksiyon/doğrulama alanları |
| 15 | Onay kuyruğu, kaynak ölçüme bağlantı, gerekçeli onay/red formu |
| 16 | Kontrol oturumu metrikleri, mevcut filtreler ve yoğun kayıt tablosu |
| 17 | Geniş kontrol detayı; numune, karakteristik, spesifikasyon, ölçülen değer, durum, not ve kanıt aynı satırda |
| 18 | Gerçek firma bilgili rapor, beş numunelik tablo grupları, yalnız raporu yazdıran PDF/print düzeni |
| 19 | Filtrelenmiş kapsamın görünür olduğu CSV / Excel XML indirme penceresi |
| 20 | Büyük ölçüm trendi, hedef/spec/kontrol sınırları, NOK çarpı işaretleri, Cp/Cpk/ortalama/s/N, dağılım ve mevcut alt grup analizleri |

## Kapsam kararları

- QR etiketinde mevcut özellik PNG indirmedir; yazıcı/kopya yönetimi eklenmedi. QR payload formatı aynı.
- Onay kuyruğundaki zaman ölçüm zamanıdır; API'de ayrı istek tarihi bulunmadığından istek tarihi gibi sunulmaz.
- Uygunsuzluk detayında mevcut süreç alanları gösterilir; yeni CAPA veya sahte olay geçmişi üretilmez.
- Rapordaki sabit firma, sertifikasyon iddiası ve onaylayıcı adı kaldırıldı. Firma profili kullanılır; imza alanları doldurulacak şekilde boş bırakılır.
- Excel çıktısı mevcut SpreadsheetML `.xml` biçimidir. Asenkron dışa aktarma veya indirme geçmişi eklenmedi.
- SPC hesaplama motoru değiştirilmedi. Ana analiz parti/operatör filtresini uygular; plan matrisi önceki gibi tüm plan kayıtlarını kullanır ve bu kapsam görünür biçimde belirtilir.
- Mobil yeniden tasarım yapılmadı; mevcut sayısal tuş takımı ve yan yana çizim/değer akışı korundu.

## Doğrulama

- Her fazda 1920 / 1440 / 1366 / 1280 / 390 px: belge taşması ve JavaScript istisnası yok.
- Tarayıcı iş akışları: görev atama/tamamlama, uygunsuzluk kaydetme, onay/red, detay/spec eşleşmesi, PDF yazdırma, filtreli CSV ve Excel, SPC operatör filtresi, terminal OK/NOK.
- Mevcut terminal testi: yedi cihaz boyutu; ondalık, silme, negatif sayı, salt okunur alan, nokta geçişi ve değer geri yükleme.
- Mevcut CSV/Excel doğruluk testleri başarılı.
- TypeScript ve üretim derlemesi başarılı. Vite'ın büyük paket uyarısı devam ediyor.
- Yerel fixture kullanıldı. Canlı veritabanı, fiziksel kamera ve fiziksel yazıcı testi yapılmadı.

## Artefaktlar ve tekrarlama

Galeri: `output/desktop-revision/phases-11-20.html`

PDF: `output/desktop-revision/phase-workflow-11-20/quality-report.pdf`

İlk terminal: `node --import tsx tests/desktop-review-server.mjs`

İkinci terminal: `node tests/desktop-workflows-11-20.mjs`

Ekran kontrolü örneği: `node tests/desktop-phase-browser.mjs 20 spc`

Sunucu 127.0.0.1:3350 üzerinde bellek içi test verisi kullanır. İş akışı testi bu test sunucusunun görev/onay verisini başlangıca döndürür; canlı API çağrısı yapmaz. Tarayıcı Edge, Windows'ta görünmez çalıştırılır.

Değişiklikler yereldedir. Yayın veya veritabanı migrasyonu yapılmadı.
