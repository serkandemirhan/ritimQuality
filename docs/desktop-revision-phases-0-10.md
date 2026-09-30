# Desktop arayüz revizyonu — Phase 0–10

Master prompt bütünü incelendi. Bu uygulama turu tasarım temeli Phase 0 ve Phase 1–10 ile sınırlıdır.

| Phase | Uygulanan değişiklik |
| --- | --- |
| 0 | Tasarım tokenları, ortak form, tablo, buton, durum, modal, sekme ve sayfa bileşenleri |
| 1 | Lacivert uygulama kabuğu, 240/72 px daraltılabilir menü, açık çalışma alanı |
| 2 | Ortak başlık, sayfa yolu, özet ve eylem düzeni |
| 3 | Gerçek metrikler, kalite trendi, dikkat gerektiren işler ve son kontroller |
| 4 | Aranabilir ürün tablosu ve teknik kimlikler |
| 5 | Ürün kimliği, teknik resim, planlar ve mevcut kontrol geçmişi sekmeleri |
| 6 | Bölümlü ürün formu, klavye ile kapanan ve odağı geri veren modal |
| 7 | Revizyon bazında kontrol planı tablosu |
| 8 | Plan yapısı / çizim / karakteristik özellikleri; tolerans sınırları ve kayıt durumu |
| 9 | Ölçüm hazırlık formu ve başlatılacak kontrol özeti |
| 10 | Kamera çerçevesi, elle kod girişi, QR başarı/hata ve iş emri teyidi |

## Doğrulama

- Her fazda 1920, 1440, 1366, 1280 ve 390 px tarayıcı kontrolleri: belge taşması ve JavaScript istisnası yok.
- Ekran görüntüleri: `output/desktop-revision/index.html`.
- TypeScript kontrolü ve üretim derlemesi başarılı. Vite büyük paket uyarısı devam ediyor.
- Yerel bellek içi API ile ürün kaydetme/iptal, modal Escape, tolerans hesaplama/kaydetme, geçersiz ve geçerli QR kodu, iş emrinin QR URL ile aktarımı ve ölçüm başlangıcı test edildi.
- Fiziksel kamera taraması ve gerçek veritabanına yazma bu yerel testin kapsamına dahil değildir.

## İş akışı testini tekrarlama (Windows / Edge)

İlk terminal: `node --import tsx tests/desktop-review-server.mjs`

İkinci terminal: `node tests/desktop-revision-browser.mjs`

Sunucu yalnızca 127.0.0.1:3350 üzerinde test verisi sunar; kayıtlar bellektedir. Yeniden başlatmak test verisini sıfırlar. Test Edge'i görünmez çalıştırır. Sonuç: `output/desktop-revision/phase-workflow/checks.json`.

Backend şeması, QR payload formatı ve yetki kuralları değiştirilmedi. Desteklenmeyen ithalat/ihracat veya yeni iş akışı durumları eklenmedi. Phase 11 ve sonrası bu turda uygulanmadı.
