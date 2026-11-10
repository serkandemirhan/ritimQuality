# Ritim Kalite — UI ve analitik inceleme

> **Düzeltme durumu:** Altı bulgu için yerel düzeltmeler uygulandı. Aşağıdaki inceleme ilk bulguları kaydeder; güncel uygulama ve test sonuçları belgenin sonundadır.

Tarih: 10 Kasım 2026. Proje: `D:/Projects/Quality/ritimQuality`.

## Kapsam ve yöntem

Gerçek React uygulaması, `tests/desktop-review-server.mjs` ile yalnız bellekte tutulan kurgusal veriler üzerinden incelendi. Canlı servise bağlanılmadı ve müşteri kayıtları değiştirilmedi. Bu rapor kaynak kod incelemesi, tarayıcı etkileşimi ve hesaplama tekrar üretimlerini ayırır. Uygulama kaynak koduna düzeltme yapılmadı.

Genel Bakış, Parçalar, Kontrol Planları, Ölçüm hazırlığı, Kontrol kayıtları, SPC Analizi, Aksiyonlar, Uygunsuzluklar, Onaylar ve Ayarlar gezildi. İlk ekran turu 1440×1000 ve 390×844 boyutlarında yapıldı. Sayfa düzeyinde yatay taşma ve yakalanan JavaScript istisnası görülmedi. Mobilde bazı tablolar kendi kaydırma alanında geniş kalıyor; bu durum tek başına hata olarak sayılmadı. Ekran görüntülerinin ilk turunda kısa bekleme kullanıldı; grafiklerin render edildiği ayrıca SVG ve boyut denetimiyle doğrulandı.

## 1. P1 — Seçili plan revizyonuna ait olmayan ölçümler SPC ana analizine karışıyor

Konum: `src/components/SPCReports.tsx:96`, `src/services/spcEngine.ts:14`, `src/services/spcEngine.ts:216`.

Ana analiz tüm `inspectionLogs` listesini motora gönderiyor; motor sadece karakteristik kimliğinde sayısal değer bulunmasını kontrol ediyor. Plan ve revizyon denetimi sadece alt özet tablosunda var. İki revizyonda aynı karakteristik kimliği kullanıldığında eski revizyonun ölçümleri yeni toleranslarla değerlendiriliyor. Ürün kimliği de ana analizde süzülmediği için çakışan karakteristik kimlikleri ayrıca risk oluşturuyor; ürünler arası durum bu turda tarayıcıda ayrıca sınanmadı.

Tekrar üretim: aktif v1.0 planına 9.9 ve 10.1, arşiv v0.9 planına 19.9 ve 20.1 ölçümleri bağlandı. Karakteristik kimliği aynı, aktif tolerans 9–11. Tarayıcıda v1.0 seçiliyken üstte N=4, ortalama=15.0000, Cpk=-9.43 ve %50 uygunsuz; v1.0 matrisinde N=2, ortalama=10.0000, Cpk=2.36 ve %0 uygunsuz görüldü.

Beklenen: ana analiz önce ürün, plan ve revizyona göre aynı kayıt kapsamını seçmeli; parti ve operatör süzmesi bunun üzerine uygulanmalı. Eski revizyonlar açık bir karşılaştırma tercihi olmadan karıştırılmamalı.

Not: alt matrise parti/operatör filtresi uygulanmaması ekranda açıkça açıklanmış; bu bilinçli kapsam farkı ayrı bir hata olarak raporlanmadı.

Kanıt: [Tarayıcı sonuçları](../.runtime/ui-analyst-review/focused.json), [ekran görüntüsü](../.runtime/ui-analyst-review/spc-revision-filter.png). Görüntü parti filtresi uygulandıktan sonraki durumu, JSON hem önceki hem sonraki durumu içerir.

## 2. P2 — Ölçülmedi durumundaki sıfır, numune ve uygun ölçüm olarak sayılıyor

Konum: `src/services/spcEngine.ts:43`, `src/services/spcEngine.ts:59`.

Tekrar üretim: aynı karakteristik için değer 0 / durum `empty` ve değer 10.1 / durum `pass` verildi. Motor N=2 döndürdü ve sıfırın geçmiş durumunu `pass` olarak çevirdi. Böylece sıfır ortalama, standart sapma ve uygunsuzluk oranına girerken grafik açıklaması onu uygun diye gösterebilir.

Beklenen: boş/ölçülmedi değerler analize girmemeli. Numune, geçmiş, alt grup ve histogram aynı geçerli ölçüm kümesinden üretilmeli.

Sınır: bu bir motor seviyesinde tekrar üretimdir. Sunucu kayıt doğrulama testleri geçiyor ve sunucu sonuçları yeniden hesaplıyor. Canlıda kaydedilmiş bir `empty` kayda rastlandığı iddia edilmez; eski/yerel/eksik veriye karşı analitik katman hatasıdır.

Kanıt: [Motor tekrar üretimi](../.runtime/ui-analyst-review/spc-repro.txt).

## 3. P2 — Tek numuneli gruplarda geçersiz X̄-R sınırları gösteriliyor

Konum: `src/services/spcEngine.ts:121`, `src/services/spcEngine.ts:123`, `src/components/SPCReports.tsx:153`.

Tekrar üretim: iki ayrı oturumda birer numune; 9.9 ve 10.1. Motor `subgroupSize=1`, R̄=0, X̄ UCL=LCL=10 ve R UCL=0 döndürüyor. Kod n=1 için n=2 sabitini seçiyor. Aralık, tek numuneli bir grupta süreç yayılımını ölçemez; ekranda geçerli bir X̄-R analizi gibi sunulması yanıltıcıdır. Ayrıca n>10 değerleri sabit tablosunda 10'a kırpılıyor; değişken grup boyutları ortalama bir n'ye indirgeniyor.

Beklenen: n=1 için X̄-R paneli gösterilmemeli; bireysel/MR analizi kullanılmalı. Desteklenmeyen veya değişken alt grup boyutları açıkça ele alınmalı.

Kanıt: [Motor tekrar üretimi](../.runtime/ui-analyst-review/spc-repro.txt).

## 4. P2 — Sabit ölçümlerde mevcut kayıtlar yokmuş gibi gösteriliyor

Konum: `src/services/spcEngine.ts:82`, `src/services/spcEngine.ts:93`, `src/components/SPCReports.tsx:159`.

Tekrar üretim: 10, 10, 10 ölçümleri motorun `null` dönmesine neden oluyor. Arayüz bunu “Analiz için yeterli ölçüm bulunamadı” olarak yorumlayıp numune sayısı, ortalama ve geçmişi de gizliyor. Sabit ölçüm verisi, yetersiz veriyle aynı durum değildir; ölçüm çözünürlüğü veya veri tekrarı ayrıca araştırılabilir.

Beklenen: N, min/max, ortalama ve geçmiş görünür kalmalı. Tanımsız Cp/Cpk alanları ayrı bir “yayılım sıfır; yetenek hesaplanamadı” açıklaması göstermeli.

Kanıt: [Motor tekrar üretimi](../.runtime/ui-analyst-review/spc-repro.txt).

## 5. P2 — Sabit yuvarlama küçük ölçümleri ve grafik sınırlarını bozuyor

Konum: `src/services/spcEngine.ts:142`, `src/services/spcEngine.ts:163`, `src/services/spcEngine.ts:179`, `src/components/SPCReports.tsx:146`.

Tekrar üretim: nominal 0.0005, sınırlar 0–0.001, ölçümler 0.000501 ve 0.000502. Motor Cp=235.70 üretirken dışarı verdiği standart sapma 0; UCL=LCL=CL=0.0005 oluyor. Histogram merkezleri de üç basamağa yuvarlanarak birleşebiliyor. Arayüz dört/üç basamakla biçimlendirdiği için gerçek farklar kayboluyor.

Beklenen: hesaplanan değerler motorda yuvarlanmamalı. Ekran basamakları birim ve karakteristik hassasiyetine göre seçilmeli; sıfırdan farklı küçük yayılım gerçek sıfırla karıştırılmamalı.

Kanıt: [Motor tekrar üretimi](../.runtime/ui-analyst-review/spc-repro.txt).

## 6. P2 — Yeni parça formu Escape ile değişiklikleri sessizce kaybediyor

Konum: `src/components/ProductManagement.tsx:65`, `src/components/ProductManagement.tsx:221`, `src/components/ui/index.tsx:72`.

Tarayıcı adımları: Parçalar → Yeni parça ekle → kodu `UNSAVED-REVIEW` yap → Escape → formu yeniden aç. Form onaysız kapanıyor; tekrar açılışta girilen kod yerine yeni rastgele parça kodu oluşuyor. Aynı kapatma yolu pencerenin kapat düğmesinden de çağrılıyor.

Beklenen: değiştirilmiş form için vazgeçme onayı veya taslağı koruma sunulmalı. Kaydetmeden kapatma ile açık İptal eylemi arasındaki davranış ürün kararıyla netleştirilmeli.

Kanıt: [UI kenar durum sonuçları](../.runtime/ui-analyst-review/ui-edge.json).

## Ek UX kararı — Teknik resim gelmezse rapor çıktısı engelleniyor

Teknik resme 404 döndürüldüğünde hata ve Tekrar dene düğmesi görünüyor; Yazdır / PDF Kaydet devre dışı kalıyor. Bu davranış bozuk teknik resimle eksik rapor üretmeyi engelleyen bilinçli bir kural olabilir; doğrulanmış hata olarak yukarıdaki sayıya dahil edilmedi. Teknik resim uzun süre ulaşılamadığında kullanıcının nasıl ilerleyeceği ürün kararı gerektiriyor. Eksik çizimle çıktı desteklenecekse rapor üzerinde bu durum açıkça belirtilmeli.

Kanıt: [UI kenar durum sonuçları](../.runtime/ui-analyst-review/ui-edge.json), [rapor hata ekranı](../.runtime/ui-analyst-review/drawing-failure-report.png).

## Doğrulama özeti

- TypeScript `tsc --noEmit`: başarılı.
- Üretim frontend build: başarılı; büyük parça boyutu uyarısı var. Gerçek cihaz performansı ölçülmedi.
- Plan sürüm testi: 1 geçti.
- Sunucu ölçüm doğrulama testleri: 8 geçti.
- Rapor analizi test betiği: geçti.
- Tarayıcı: masaüstü/mobil ekran turu, kontrollü SPC revizyon karışması, yeni parça formunda Escape ve hatalı çizimle rapor açma.
- Bu tur gerçek giriş, canlı veritabanı, rol güvenliği, fiziksel cihaz dokunma/klavye ve uçtan uca üretim kabulünü doğrulamaz.

Önerilen sıra: önce #1, ardından #2–#5 için SPC regresyonları ve hesaplama düzeltmeleri; sonra #6 form kayıp koruması. Kaynak kodda değişiklik yapılmadı; yalnız yerel inceleme betikleri/kanıtları ve bu rapor eklendi.


## Uygulama ve doğrulama güncellemesi

Altı bulgu düzeltildi. Canlı yayın veya veritabanı değişikliği yapılmadı.

- **Veri kapsamı:** Ana SPC analizi, alt matris ve filtre seçenekleri aynı ürün/plan/revizyon seçicisini kullanıyor. Revizyon değişiminde parti ve operatör seçimi sıfırlanıyor. Ana grafikte revizyon ve geçerli numune sayısı yazıyor.
- **Geçerli ölçümler:** Boş, eksik, sayısal olmayan ve sonlu olmayan değerler tek seçiciyle eleniyor. Gerçek sıfır korunuyor. Geçmiş, histogram, alt gruplar ve istatistikler aynı ölçümleri kullanıyor; sayısal uygunluk seçili toleranslara göre yeniden belirleniyor.
- **Grafik uygunluğu:** X̄-R sadece en az iki, eşit büyüklükte ve 2–10 geçerli numuneli alt grup için hesaplanıyor. Tek numuneli, değişken veya desteklenmeyen gruplarda neden açıklanıyor; I-MR paneli kullanılabiliyor.
- **Sabit / tek ölçüm:** Geçmiş, N, ortalama, min/max ve histogram korunuyor. Hesaplanamayan yetenekler null olarak dönüyor ve ekranda “— / Hesaplanamadı” ile açıklanıyor; başarısız süreç gibi sınıflandırılmıyor.
- **Hassasiyet:** Sayısal hesaplama sonuçları yuvarlanmıyor. Sunum katmanı karakteristik hassasiyeti ve tolerans genişliğine göre biçimlendiriyor; çok küçük sıfırdan farklı değerler bilimsel gösterim kullanıyor. Histogram merkezleri ham sayısal değer olarak korunuyor.
- **Form koruması:** Yeni/düzenlenen parçada değişiklik varsa Escape, kapat, İptal ve uygulama içi gezinme öncesinde vazgeçme onayı isteniyor. Reddedilen kapatma girdileri koruyor; sayfa yenilemede tarayıcı uyarısı tetikleniyor. Değişmemiş form ve başarılı kaydetme ek onay istemiyor. Kaydetme/yükleme sırasında kapanma engelleniyor.

### Kontroller

- Node 22.20.0 ile TypeScript kontrolü başarılı.
- Node 22.20.0 ile üretim build başarılı. Mevcut büyük bundle uyarısı sürüyor; bu değişiklikte paket bölme kapsam dışındadır.
- 26 regresyon testi geçti, sıfır hata/atlama: yeni 13 SPC testi; mevcut 8 ölçüm doğrulama, 1 plan sürümü, 4 satış revizyonu testi.
- Mevcut rapor analizi test betiği geçti.
- Node 22.20.0 ile 6 tarayıcı senaryosu geçti: revizyon/ürün izolasyonu, boş ölçüm, tek numuneli I-MR, sabit veri, küçük ölçüler ve form koruması + normal kaydetme.
- Küçük ölçüm ekranı 1440, 768, 390 ve 375 px genişliklerinde sayfa taşması olmadan doğrulandı. Tarayıcıda JavaScript hatası yakalanmadı.

### Tekrar çalıştırma

- SPC regresyonları: `npm run test:spc`.
- UI: ayrı terminalde `node --import tsx tests/desktop-review-server.mjs`, ardından `node tests/spc-ui-regression.cjs`. UI betiği Playwright gerektirir; kurulum farklı dizindeyse `PLAYWRIGHT_MODULE` ortam değişkeniyle modül yolu verilebilir. Test, yalnız localhost:3350 üzerindeki review fixture sunucusunu kullanır.
- [Kalıcı SPC testleri](../tests/spc-regression.test.ts), [kalıcı UI regresyon betiği](../tests/spc-ui-regression.cjs).
- [Son tarayıcı sonuçları](../.runtime/spc-fixes/browser-results.json), [revizyon kapsamı](../.runtime/spc-fixes/revision-scope.png), [sabit veri](../.runtime/spc-fixes/constant-data.png), [küçük ölçüler mobil](../.runtime/spc-fixes/small-measurements-mobile.png), [korunan form](../.runtime/spc-fixes/unsaved-form.png).

Kanıtlar sabit son-test dizininde tutuluyor; önceki teşhis kayıtları, ilk bulguların tekrar üretim kanıtı olarak yukarıda bağlı kalıyor. Gerçek cihaz ve canlı servis kabulü bu yerel doğrulamanın kapsamı dışındadır.

UI kaydetme testi yalnız istemci davranışını doğrular; ürün kaydetme yanıtı tarayıcıda kontrollü olarak simüle edilir ve fixture sunucusunun verisi değiştirilmez.

## PDF paylaşımı ve sınırsız pilot güncellemesi

Rapor ekranına PDF indir ve Paylaş eklendi. PDF, yazdırma diyaloğuna bağımlı olmadan üretilir; Türkçe metin, ölçüm/not tablosu, teknik resim ve işaretler, her sayfada teknik sonuç/yönetici onayı ve gerekiyorsa yerel/demo uyarısı içerir. Native dosya paylaşımı doğrudan kullanıcı dokunuşuyla başlar; desteklenmiyorsa dosya indirmeye döner. İptal ve hata/tekrar deneme yolları sınandı.

Sınırsız pilot erişimi sunucu kontrollü çalışma alanı listesiyle uygulanır. Kullanıcı, plan/revizyon ve aylık numune kotası ile deneme/lisans süresi yalnız listedeki hesaplar için aşılır. Diğer hesapların kuralları korunur. Gerçek iki çalışma alanı adı henüz verilmedi; ortam şablonları boş, canlı hesap aktivasyonu ve yayın yapılmadı. [Yapılandırma](VERCEL_SUPABASE.md).

Node 22 üzerinde frontend/backend TypeScript ve üretim build'i başarılı. 11 yeni PDF/pilot testi, önceki 26 regresyon ve 7 cloud-runtime testi geçti (44 test); rapor analizi betiği de geçti. Sekiz tarayıcı senaryosu; gerçek indirilen PDF'nin Türkçe metni, resim gömme/sayfalama, paylaşım aktivasyonu, iptal/hata/indirme dönüşü, varlık yükleme hatasından tekrar deneme, mobil görünüm ve sınırsız hesap ekranını doğruladı. Native paylaşım taklit edildi; fiziksel telefonda gerçek WhatsApp hedefi ayrıca denenmeli.

Kanıt: [tarayıcı sonuçları](../.runtime/report-sharing/browser-results.json), [örnek PDF](../.runtime/report-sharing/example-report.pdf), [PDF ilk sayfa](../.runtime/report-sharing/export-page-1.png), [mobil rapor](../.runtime/report-sharing/report-mobile.png), [sınırsız hesap görünümü](../.runtime/report-sharing/unlimited-pilot.png). Kanıt dizini her çalışmada güncel çıktı ile kullanılır.

## Merkezi tenant yönetimi

`/platform` ekranı yalnız `PLATFORM_ADMIN_USER_IDS` ile tanımlanan platform sahibine açılır. Firma/kullanıcı yönetimi, kalıcı sınırsız pilot erişimi, JSON/CSV export, dosyalar dahil şifreli yedek ve aynı firmada eksik kayıt kurtarma eklendi. Mevcut kayıtlar korunur; çakışmalar engellenir. Başarılı ve başarısız yönetim işlemleri merkezi audit kaydına yazılır.

Gerçek, ayrı PostgreSQL üzerinde 14 API kontrolü ve 10 tarayıcı senaryosu; ayrıca 52 otomatik regresyon testi doğrulama kapsamındadır. Yayın öncesi migration 016 ve yalnız sahibin kullanıcı kimliğinin tanımlanması gerekir. Üretim Supabase Storage kabulü ayrıca yapılmalıdır. Kurulum, kapsam ve kanıtlar: [PLATFORM_ADMIN.md](PLATFORM_ADMIN.md).