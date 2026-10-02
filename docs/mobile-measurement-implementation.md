# Mobil ölçüm uygulaması

30 Eylül 2026. Ana SaaS uygulamasının mobil ölçüm akışı yenilendi. `on-premise/` içindeki ayrı uygulama bu değişikliğe dahil değildir.

## Ekrana erişim

Ölçüm İstasyonu → ürün / revizyon seçimi → Ölçüme başla. Başlangıçta 767 CSS px veya daha dar ekranlarda yeni shell açılır. Masaüstü akışı korunur. Kaydedilen mobil denemeler Ölçüm Kayıtları → detay → İzlenebilirlik bölümünde de görülebilir.

## Uygulanan davranış

- Altı giriş tipi ve mevcut çoklu seçim desteği; açık kaydetme, virgül/nokta, hassasiyet kontrolü, dahil sınırlar, tek taraflı limitler, nominalden sapma ve plan izinliyse gerekçeli N/A.
- 1–5 numune × 1–50 karakteristik; iki gezinme sırası, arama, kalanlar, onlu gruplar, numune bitiş özeti, sağ/sol el tercihi.
- Revizyon snapshot'ı, referans resimleri, ortak marker kimliği, resim büyütme/kaydırma/sığdırma ve metin fallback. Zorunlu resim yüklenmediyse kayıt engeli.
- Plan bazlı kanıt kuralları; çoklu fotoğraf, önizleme, kaldırma/yeniden çekme, yorum ve sebep. Tekrar ölçüm yeni deneme oluşturur; ilk NOK, kanıt, operatör ve zaman korunur.
- IndexedDB işlemiyle kalıcı deneme, medya referansları ve gönderim durumu. Dosyalar Blob/File olarak saklanır. Başarısız yazmada ilerleme yoktur. Taslaklar tesis/kullanıcı kapsamına ayrılır.
- Çevrimdışı kayıt, oturum yenilemede kurtarma, medya ve ölçüm gönderiminin ayrı takibi. Oturum süresi dolunca yeni sonuç kaydı durur, taslak silinmez.
- Sunucu ham girişten sonucu tekrar hesaplar; deneme zincirini, kanıtları, operatörü ve plan snapshot'ını doğrular. İlk NOK sonradan uygun olsa da mevcut uygunsuzluk ve onay iş akışına bağlanır.
- Tamamlanmış kontrolün sunucuya gönderimi özetten açıkça başlatılır. Bu adım öncesinde son hücre de yeniden ölçülebilir. Gönderim kilitlendikten sonra aynı değişmez payload ve oturum ID'si tekrar denenir. Medya yüklemeleri de sabit ID kullanır.

## Doğrulama

- `npm run lint`, `npm run build:api`, `npm run build`.
- `npm run test:mobile-measurement`: sayısal sınırlar, format, iki sıra / 250 hücre, seçim anlamı, N/A, kanıt politikası, tekrar zinciri ve snapshot uyuşmazlığı.
- `npm run test:mobile-measurement:browser`: derlenmiş uygulama + yerel kontrollü HTTP fixture + gerçek sunucu doğrulayıcısı; 360/390/430 px, 48 px hedefler, açık kayıt, gezinme engeli, reload kurtarma, 250 çevrimdışı hücre, NOK tekrar ölçüm, revizyon hatası, eksik kanıt, IndexedDB quota rollback, medya hata/tekrar gönderim.
- Mevcut `test:cloud` ve `test:revisions` regresyon kontrolleri.
- Tarayıcı testinin ekran görüntüleri ve ölçümleri `.runtime/mobile-measurement/` altında üretilir. Test için önce frontend ve API derlemeleri gerekir.

## Gerçek servis / cihaz sınırları

- Mevcut API tamamlanmış kontrol oturumu kabul eder. Hücre bazlı sunucu kaydı yoktur: eksik oturumun denemeleri cihazda gönderim bekler; medya daha önce yüklenebilir. Başka cihazdan kısmi mobil oturum devralma uygulanmadı.
- Aynı oturum ID'sindeki farklı payload sunucuda reddedilir; aynı cihazdaki eski hücre sürümü sessizce üzerine yazılmaz. İki cihazın bağımsız başlattığı farklı oturumları aynı iş emrinin aynı hücresi sayan bir sunucu rezervasyon protokolü mevcut değildir.
- Çevrimdışı yeniden açma için uygulamanın PWA dosyalarının önceden yüklenmiş olması ve geçerli oturum gerekir. Authenticated teknik resim cihazda erişilebilir değilse zorunlu resim kuralı ilerlemeyi engeller.
- Mevcut onay API'si kullanılır; mobil özet hiçbir zaman kendiliğinden “kontrol kapatıldı” göstermez. İnceleme ve yetkili onay sunucuda aynı mevcut onay altyapısına bağlanır; ayrı iki aşamalı onay makinesi eklenmedi.
- Alet kimliği zorunluluğu desteklenir. Kalibrasyon/envanter doğrulaması ve doğrulanmış canlı çekim servisi mevcut değildir; canlı çekim zorunlu planlar engellenir. Dosya seçici kamera izninin neden reddedildiğini tarayıcı her zaman bildirmez.
- Canlı PostgreSQL/Supabase yükleme ve yetkilendirme entegrasyonu ile fiziksel iPhone/Samsung kamera, PDF görüntüleme ve sistem klavyesi bu ortamda doğrulanmadı. Browser fixture testleri bu kontrollerin yerine geçmez.
- Pazarlama referansına erişilemedi; spesifikasyondaki nötr/lacivert tokenlar kullanıldı. Bluetooth entegrasyonu kapsam dışında tutuldu.
- Üretim derlemesi mevcut büyük bundle uyarısını verebilir; bu bir derleme hatası değildir.
