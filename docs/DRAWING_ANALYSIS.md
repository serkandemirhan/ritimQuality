# PDF’den kontrol planı oluşturma

Kontrol planları → ürünün planını aç / Plan hazırla → **PDF’den plan oluştur**.
Türkçe inceleme ekranı PDF'nin ilk sayfasını gösterir. Harici işleme izninden sonra gerçek OpenAI Responses API çağrısı yapılır. Sonuçlar otomatik onaylanmaz; her satır kullanıcı tarafından doğrulanır. Oluşturulan plan taslaktır; üretimde kullanmak için mevcut etkinleştirme işlemi gerekir.

## Yapılandırma

- `OPENAI_API_KEY`: yalnızca sunucu ortamında geçerli API anahtarı.
- `OPENAI_MODEL`: varsayılan `gpt-4.1`; PDF görsel girdisini ve yapılandırılmış JSON çıktısını desteklemelidir.
- Anahtarlar `VITE_` önekiyle tanımlanmaz. Ortam değiştiğinde sunucu yeniden başlatılır.

Kimlik doğrulamalı `POST /api/drawing-analysis`, `application/pdf` gövdesi ve `X-AI-Consent: accepted` ister. Yalnızca yönetici ve kalite uzmanı erişebilir. En büyük dosya 4 MB; sağlayıcı zaman aşımı 45 saniyedir. İşlem başına aynı kullanıcıdan tek eşzamanlı analiz kabul edilir. Bu bellek içi kontrol dağıtık bir kota sistemi değildir; anonim erişim açılmamıştır.

## Veri akışı

1. Tarayıcı PDF.js ile ilk sayfayı önizler.
2. Sunucu pdf-lib ile yalnızca ilk sayfayı yeni belgeye kopyalar; diğer sayfaları sağlayıcıya göndermez.
3. Sunucu PDF.js ile gömülü metinleri ve sayfaya göre yüzde koordinatlarını çıkarır.
4. İlk sayfa ve kaynak metin kimlikleri modele gönderilir; Zod yanıtı doğrular.
5. İşaretli tolerans sapmalarından sınırlar kodla hesaplanır. Eksik değerler boş bırakılır.
6. Kullanıcı ölçüleri, birimleri, sınırları, aletleri ve notları düzeltir, satırları doğrular.
7. Orijinal PDF ve ilk sayfanın görseli mevcut özel medya deposuna kaydedilir. Ürün görselleri ve kontrol planı mevcut API ile kaydedilir.

Mevcut JSON plan yükü `drawingAnalysis` alanında kaynak dosya, sayfa sayısı, notlar, model ve kullanım bilgisini; karakteristik `extraction` alanında kaynak metni, koordinatları ve ilk doğrulama kaydını saklar. Mevcut tablo yapısı kullanılır; migration yoktur. Bu kaynak doğrulama kaydı sonraki manuel değişiklikler için yeniden AI doğrulaması anlamına gelmez.

## Doğrulama

```powershell
npm run lint
npm run build:api
npm run build
node --import tsx --test tests/drawing-analysis.test.ts
node tests/drawing-analysis-browser.mjs
```

Canlı test yalnızca araç tarafından oluşturulan sentetik çizimi gönderir:

```powershell
node --env-file=.env.cloud tools/test-drawing-live.mjs
```

Tarayıcı testi açıkça tanımlanmış çevrimdışı API örneklerini kullanır; üretim AI doğruluğunun kanıtı değildir. Ekran görüntüleri `.runtime/drawing-browser/` altında üretilir.

## Sınırlar

- Şimdilik sayısal kontrol noktaları aktarılır; GD&T, diş, yüzey ve diğer sayısal olmayan gereksinimler notlarda incelenir. Tam GD&T/ISO tolerans standardı desteği yoktur.
- Taranmış PDF görsel modelle yorumlanır; ayrı OCR konumlandırması yoktur. Kaynak konumu bulunmayan ölçüler için satır seçilip çizimde ilgili ölçüye tıklanmalıdır. Konum tamamlanmadan doğrulama ve plan aktarımı açılmaz.
- Kaynak konumları gömülü PDF metnine bağlıdır; gelişmiş balon yerleşimi ve vektör geometri analizi henüz yoktur.
- Genel toleransın uygulanabilirliği AI yorumundan gelir ve kullanıcı kontrolü gerektirir. Sayısal sınır hesabı deterministiktir.
- Medya, ürün ve plan kaydı ayrı isteklerdir; son adım başarısız olursa önce yüklenen dosyalar depoda kalabilir.
- Henüz genel demo, dağıtık oran sınırı, analiz önbelleği veya abonelik değişikliği yoktur.
- Gerçek PM-01_A1.pdf sağlanmadığı için 9/9 gerçek çıkarım doğrulanmadı. Dokuz ölçünün yalnızca tolerans aritmetiği test edildi.
- Canlı denemede mevcut anahtar HTTP 401 ile reddedildi; başarılı analiz süresi, doğruluk ve maliyet henüz ölçülemedi.
- 15 birim/regresyon testi ve çevrimdışı masaüstü/mobil tarayıcı akışı geçti. Gerçek müşteri veritabanına test planı yazılmadı; kalıcılık testi mevcut şema ve tarayıcı API test verileriyle yapıldı.

API biçimi: [PDF girdileri](https://developers.openai.com/api/docs/guides/file-inputs), [Yapılandırılmış çıktılar](https://developers.openai.com/api/docs/guides/structured-outputs).
