> Güncel yayın mimarisi: Satış sitesi ikinci bir hesap oluşturmaz. `/signup` ve `/login`, `NEXT_PUBLIC_APPLICATION_URL` ile ana uygulamadaki firma hesabına yönlendirir. Ana uygulama mevcut JWT kimliğini, Supabase PostgreSQL ve özel Storage kullanır. Eski `site_` tabloları/Supabase Auth bileşenleri korunmuştur fakat yeni kayıt akışında kullanılmaz; eski deneme kayıtları silinmemiştir.
>
> Yayın engelleri: Vercel oturumu ve proje bağlantısı, gerçek HTTPS adresleri, destek/şirket bilgileri, e-posta doğrulama/yenileme, ödeme ayarları ve geri yükleme kabul testi tamamlanmadan ücretli SaaS hazırlığı tamamlanmış sayılmaz. Yeni fiyat sayfası mevcut sunucu kotalarını gösterir ve ödeme almaz.

# Ritim Quality satış sitesi

Mevcut React/Vite kalite uygulamasını değiştirmeden geliştirilen ayrı Next.js App Router projesi. İlk sürüm Türkçedir; İngilizce ve dil seçimi kullanıcı kararıyla ertelendi.

## Çalıştırma

Node.js 22+ gerekir. Bu klasörde:

```powershell
npm install
npm run dev
```

Yerel adres: http://localhost:3500. Mevcut uygulama http://localhost:3400 adresinde bağımsız çalışır.

```powershell
npm run lint
npm run build
npm test
```

Playwright yerelde kurulu Microsoft Edge kullanır. Linux CI için yapılandırmadaki `channel` değerini kaldırıp `npx playwright install --with-deps chromium` çalıştırın. Telefon emülasyonu gerçek iOS/Android klavyesi davranışını doğrulamaz; gerçek cihazda dosya seçimi, klavyenin açılıp kapanması ve sonraki ölçüye odaklanma ayrıca denenmelidir.

## Uygulanan akış

- Türkçe tanıtım, özellikler, fiyatlandırma, yardım ve bilgilendirme sayfaları.
- Ana sayfaya gömülü PDF sürükle/bırak akışı. “Anında deneyin” başka sayfaya gitmeden bu alana kaydırır. `/demo` aynı bileşenin doğrudan giriş adresidir.
- En fazla 15 MB PDF, yalnızca ilk sayfa. PDF.js ile tarayıcıda önizleme ve metin çıkarımı; açık ± veya işaretli tolerans ifadelerinden kontrol planı. Numaralar gerçek PDF metin konumlarına bağlanır. Eksik tolerans, birim ve okunamayan ölçüler uydurulmaz.
- İlk beş noktada kullanıcı ölçümü, çizimden doğrulama, elle sınır/birim düzeltme, uygun/uygunsuz sonucu ve not. Daha az nokta bulunursa yalnızca bulunanlar ölçülür. Beşten sonraki noktalar nominal **otomatik örnek** değerlerle doldurulur; gerçek sonuç sayımına dahil edilmez.
- Son ölçümde rapor aynı ekranda açılır. CSV indirme, PDF yazdırma ve aynı ekranda hesap açma formu. Yeni PDF demosu yalnızca bellekte tutulur; dosya ve plan yeni hesaba otomatik aktarılmaz. Sayfa kapatılmadan rapor indirilmelidir.
- Yedi ölçülü hazır örnek PDF de gerçek metin çıkarımıyla işlenir; yüklenen PDF üstüne sabit örnek noktalar yerleştirilmez.
- Supabase Auth e-posta kayıt/giriş/doğrulama, şifre sıfırlama, çalışma alanı oluşturma ve örnek sonuçları kaydetme kodu.
- Merkezi [paket yapılandırması](lib/config.ts), ödeme sağlayıcısı arayüzü ve kapalı ödeme uçları. İmzasız webhooks abonelik açmaz; gerçek ödeme alınmaz.
- Kişisel veri içermeyen tarayıcı olay bağlantıları. Harici analitik sağlayıcısı bağlı değildir.
- Son 24 ayın en yeni 100 örnek kaydı ve tüm geçmiş için sayfalı JSON dışa aktarım. Otomatik silme yoktur.

## Supabase

Önce ayrı test projesinde [migration](supabase/migrations/001_site_workspace.sql) çalıştırın. Migration mevcut uygulamanın tablolarını değiştirmez; `site_` önekli tablolar, RLS kuralları ve özel depolama alanları ekler. Migration bir defa uygulanmalıdır.

[Ortam şablonunu](.env.example) `.env.local` olarak doldurun. Yalnızca Supabase URL'si ve **publishable** anahtar tarayıcıya açıktır. Service-role/secret anahtarını NEXT_PUBLIC değişkenlerine koymayın.

Supabase Auth ayarlarında e-posta doğrulamasını etkinleştirin; Site URL ve redirect allowlist'e gerçek site adresini ve `/auth/callback` adresini ekleyin. Şifre sıfırlama callback'i `/auth/callback?next=/reset-password` kullanır. Üretim SMTP/e-posta teslimini ayrıca doğrulayın. Google sağlayıcısı ve yönlendirmeleri yapılandırıldıktan sonra `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` ile Google giriş düğmesi açılabilir; varsayılan olarak gizlidir.

İki ayrı kullanıcıyla farklı çalışma alanı kayıtlarının okunamadığını, üyelik/plan alanlarının istemciden değiştirilemediğini ve özel dosyaların anonim erişilemediğini gerçek Supabase üzerinde test edin. Bu migration otomatik çalıştırılmaz.

## Vercel

Bu depo için **ayrı Vercel projesi** oluşturun; Root Directory `website`, framework Next.js, build `npm run build`. Ana uygulamanın Vercel projesi ve yapılandırması korunur. `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APPLICATION_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ortam değerlerini tanımlayın. Önizlemeleri test Supabase projesine bağlayın. Bu çalışma üretime yayınlamaz.

## İsteğe bağlı ilk sayfa yapay zekâ analizi

Metin tabanlı yerel çıkarım API anahtarı olmadan çalışır. Metinden ölçü bulunamazsa ilk sayfa tarayıcıda Tesseract OCR ile üç yönde okunur. OCR motoru ve dil dosyaları aynı sunucudan yüklenir; belge harici bir servise gönderilmez. `predev` ve `prebuild`, gerekli varlıkları bağımlılıklardan `public/ocr` altına kopyalar.

OCR çıktıları güven ve konum filtrelerinden geçerek **ölçü adayları** olarak gösterilir; tüm teknik özelliklerin, deliklerin veya GD&T işaretlerinin bulunacağı garanti edilmez. Ölçünün yanındaki açık tolerans, genel toleranstan önceliklidir. Çizimde açık ISO 2768 sınıfı ve mm birimi varsa doğrusal ölçülere Tablo 1 uygulanır. Yarıçaplarda kenar yuvarlatma/diğer yarıçap ayrımı kullanıcı tarafından seçilir (Tablo 2/1). Açılar, belirsiz standartlar ve geometrik toleranslar için değer uydurulmaz. Delik merkezi mesafesi gibi özel notlar gösterilir; kapsamını geometriye otomatik eşleştirme henüz yoktur, kullanıcı doğrulaması gerekir. Kullanıcı çizimden kontrol edip sınırları tamamlamadan ölçüm kaydedilemez. Hiç nokta bulunamazsa açıklama ve örnek çizim seçeneği gösterilir.

Antet ve revizyon alanları, başlık/metin konumlarından belirlenir; sabit dosya adı veya müşteri koordinatı kullanılmaz. Bu alanlar kontrol noktası çıkarımından dışlanır ancak birim/tolerans notları için okunur. Döndürülmüş PDF metninin kutuları metin yönüne göre hesaplanır. API yanıtı da aynı bölge filtresinden geçer; güvenilir kaynakta aynı konumda bulunan açık tolerans modelin genel tolerans tahmininden önceliklidir. Modelin kaynağa bağladığı nominal değer kaynakla çelişirse nokta elenir.

Gerçek AI için `.env.local` dosyasında `DEMO_AI_ENABLED=true`, geçerli `OPENAI_API_KEY` ve gerekiyorsa `OPENAI_MODEL` tanımlayıp sunucuyu yeniden başlatın. Tarayıcıya yalnızca özelliğin kullanılabilirlik bilgisi verilir. Anahtar istemciye gönderilmez. Kullanıcı ayrıca açık işleme izni verip analiz düğmesine basar. Yalnızca ilk sayfanın JPEG görüntüsü ve metni gönderilir; orijinal PDF ve diğer sayfalar gönderilmez. API hatasında yerel taslak korunur.

Üretimde önce [analiz bütçesi migration'ını](supabase/migrations/002_demo_analysis_budget.sql) test Supabase projesinde uygulayın ve sunucuda `SUPABASE_SERVICE_ROLE_KEY` tanımlayın. Veri tabanında atomik günlük 100 toplam / ziyaretçi başına 3 istek sınırı vardır; hata halinde analiz başlatılmaz. Yerel geliştirmede süreç başına 10 dakikada 10 istek sınırı kullanılır. Tabloda belge yoktur; yalnızca günlük sayaç ve hash tutulur. Migration otomatik uygulanmadı, gerçek Supabase eşzamanlılık/RLS doğrulaması ayrıca yapılmalıdır.

Sağlayıcı isteği [Responses API yapılandırılmış çıktıları](https://developers.openai.com/api/docs/guides/structured-outputs) ve [görüntü girdisini](https://developers.openai.com/api/docs/guides/images-vision) kullanır. Yanıtlar ayrıca sunucuda doğrulanır; `store:false` kullanılır. Bu ayar sağlayıcının tüm teknik günlüklerini kaldırma garantisi değildir.

## Doğrulama durumu (6 Kasım 2026)

- TypeScript kontrolü ve üretim derlemesi geçti. Bağımlılıklar sürüm ve lockfile ile sabitlendi.
- Masaüstü, iPhone ve Android emülasyonlarında 33 test doğrulandı: son toplu koşuda 32 test geçti; geliştirme sunucusundaki fiyat sayfası geçişinin süre aşımı için URL beklemesi eklendikten sonra ilgili test yeniden geçti. Ana sayfada kalma, sürükle/bırak, bozuk/boş PDF, gerçek yedi noktalı örnek çıkarımı, ikinci sayfanın dışlanması, beş kullanıcı ölçümü, iki otomatik örnek, sonuç sayımları, CSV ve aynı sayfada kayıt formu doğrulandı.
- OCR ile görüntü PDF okuma, ikinci sayfanın dışlanması, ± sembolünün + ve = işaretlerinden ayrılması, ISO sınırları, aynı konumdaki özel toleransın önceliği, antet/revizyon filtreleri, antet dışındaki gerçek yarıçapın korunması ve API taslağının kaynakla karşılaştırılması test edildi. Balon gizleme ve yakınlaştırmada sabit boyut doğrulandı.
- Kullanıcının iki yerel PDF’si ayrı tarayıcı kontrollerinde denendi: ilkinde 60 ±0,1 için 59,9–60,1 sınırları ve 60,2 uygunsuz sonucu; ikincisinde R01 revizyonunun elenmesi, dört açık toleranslı ölçü ve Türkçe mm notu doğrulandı. Bu PDF’ler web varlıklarına veya test deposuna kopyalanmadı.
- Yapay zekâ izin kontrolü, yalnızca ilk sayfa verisinin gönderimi ve sağlayıcı hatasında yerel planın korunması taklit API yanıtlarıyla test edildi; canlı AI başarısı iddia edilmez.
- Tolerans sınırları, virgüllü giriş, eksik toleransın uydurulmaması, tekrar eden ayrı boyutların korunması ve bir ölçünün biriminin diğerlerine aktarılmaması test edildi.
- Masaüstü ana sayfa/plan ve mobil ana sayfa ekran görüntüleri incelendi. Gerçek telefon klavyesi, gerçek Supabase kayıt/giriş, RLS ve atomik bütçe kontrolleri ayrıca beklemektedir.

## Ana uygulamayla bağlantı

Mevcut uygulama özel JWT giriş sistemi ve 14 günlük deneme kullanır. Yeni sitenin Supabase Auth hesabı mevcut uygulamaya tek oturumla giriş sağlamaz. Mevcut müşteri girişi ayrı bağlantıyla sunulur. Ortak kimlik ve paket geçişi tamamlanmadan ücretsiz/ücretli paketlerin ana uygulamada etkin olduğu iddia edilmez.

Bu nedenle korumalı site çalışma alanı yalnızca **örnek demo sonuçlarını** saklar. Ana üretim uygulaması yeniden yazılmadı. Üretim kontrol planları, ekip davetleri, gerçek belge kotası ve ücretli abonelik yönetimi mevcut uygulamayla entegrasyon aşamasında kalır. Fiyat sayfası hedef paketleri açıkça belirtir; yıllık indirim uydurulmaz.

Kayıtsız PDF metin analizi açıktır. Gerçek yapay zekâ akışı geçerli anahtar ve yukarıdaki yapılandırma olmadan etkin değildir. Sağlayıcı hata/izin akışlarının otomatik testleri gerçek bir canlı AI çağrısının geçtiği anlamına gelmez.

Gizlilik/koşullar sayfaları geliştirme bilgilendirmesidir; yayın öncesinde işletme bilgileri, destek iletişimi ve hukuki metinler tamamlanmalıdır. Veri tabanı yedeğine ek olarak dosya yedekleme ve saklama süreçleri ayrıca kurulmalıdır.
