# Merkezi tenant yönetimi

Panel yolu: `/platform`. Mevcut Ritim hesabınızın çalışma alanı, e-posta ve şifresiyle giriş yapılır. Merkezi yetki, müşteri firmasındaki `admin` rolünden ayrıdır.

## Etkinleştirme sırası

1. Üretim veritabanına `016_platform_admin` migration'ını uygulayın. Yeni sürümden **önce** yapılmalıdır; kimlik kontrolü yeni durdurma alanını okur. Mevcut migration mekanizması kullanılır; otomatik build sırasında migration çalıştırılmaz.
2. Kendi aktif hesabınızın değişmez kullanıcı kimliğini belirleyin:

   ```powershell
   node --env-file=.env.cloud --import tsx tools/platform-identify.ts --workspace kendi-alaniniz --email siz@example.com
   ```

   Komut kullanıcı kimliği ve temel hesap bilgisini verir; parola veya oturum token'ı göstermez.
3. Sunucu/Vercel Production ortamına bu kimliği girin:

   ```text
   PLATFORM_ADMIN_USER_IDS=gercek-kullanici-kimligi
   ```

   Birden fazla platform sahibi gerekiyorsa kimlikler virgülle ayrılır. Değişken `VITE_` öneki almaz. Boş liste herkese merkezi erişimi reddeder. E-posta eşleştirmesi kullanılmaz; başka firmada aynı e-postayla kayıt açılması merkezi yetki vermez.
4. Backend/frontend yeni sürümü yayımlayın; kendi hesabınızla `/platform` adresini açın. Kendi uygulamanızdaki profil menüsünde de “Platform yönetimi” bağlantısı görünür.
5. Normal bir müşteri yöneticisiyle aynı adresin reddedildiğini ve özel Supabase bucket üzerinden bir yedek/geri yükleme kabulünü doğrulayın.

Migration'ı bulut ortamında mevcut kurulum yöntemiyle çalıştırabilirsiniz:

```powershell
node --env-file=.env.cloud --import tsx server/db/migrate.ts
```

Migration yeni platform tablolarını oluşturur, RLS/FORCE RLS ve runtime izinlerini ekler. Güncel `supabase/runtime-role.sql` da bu tabloları kapsar. Uygulama runtime'ına migration sahibi bağlantısı verilmez.

## Paneldeki işlemler

- Tüm firmaları arama ve seçme; firma bazlı kullanıcı, parça, plan, ölçüm ve dosya sayıları.
- Yeni firma ve ilk yönetici hesabı oluşturma. Sınırsız pilot seçimi başlangıçta açıktır.
- Mevcut firmada sınırsız pilotu açma/kapatma; bu tercih sunucu ortam listesinin önüne geçer ve yeniden yayın gerektirmez.
- Firmayı geçici durdurma/açma. Durdurma, müşteri API erişimini engeller; merkezi panel erişimi devam eder. Platform sahibinin kendi giriş yaptığı firma bu panelden durdurulamaz.
- Kullanıcı oluşturma, rol/durum değiştirme ve yeni parola atama. Mevcut parola gösterilmez. Son aktif firma yöneticisi kaldırılamaz; merkezi yönetici kimlikleri müşteri yöneticilerince değiştirilemez/silinemez.
- Kalite kayıtlarını ve ayrıntılarını görüntüleme; teknik resim ve kanıt dosyası indirme.
- Seçilen veri türünün JSON veya CSV export'u. CSV hücrelerinde formül başlangıçları etkisizleştirilir. Hesap parolası/hash/token gibi alanlar export ve görüntülemede ayıklanır.
- Şifreli mantıksal firma yedeği ve doğrulamalı eksik kayıt geri yükleme.
- Platform işlemlerini gerçek platform kullanıcı kimliği, firma, zaman ve gerekçeyle ayrı denetim izinde takip etme.

## Yedeğin kapsamı

“Tam yedek al” tutarlı bir PostgreSQL `REPEATABLE READ` görüntüsü oluşturur. Şunlar alınır:

- Tesisler, bölümler, istasyonlar ve kullanıcılar.
- Parçalar, kontrol planları, ölçüm oturumları ve normalleştirilmiş sonuçlar.
- Sunucu taslakları, uygunsuzluklar, onaylar, görevler ve bildirim geçmişi.
- Firma içi denetim izi.
- Teknik resimler/kanıt dosyalarının metadata'sı ve tamamlanmış dosyaların gerçek baytları.
- Firma kimliği/profil metadata'sı ve şema parmak izi.

Sayfalı veri ve doğrudan dosya aktarımı, arşivin tek büyük Vercel API gövdesi olarak taşınmasını önler. Bir dosya eksikse veya boyut/özet uyuşmazsa tamamlanmış yedek üretilmez.

Dosya, **tarayıcıda** AES-256-GCM ile şifrelenir; anahtar PBKDF2-SHA256, rastgele salt ve IV ile türetilir. Parola en az 12 karakterdir ve sunucuya gönderilmez. Arşiv `.ritimbackup` olarak indirilir. Gerekirse girişleri koruyabilmek için kullanıcı parola hash'leri şifreli yedeğe dahildir; JSON/CSV export'unda yoktur. Arşiv parolası unutulursa panel bu parolayı geri getiremez.

Geçici sunucu paketleri 24 saat geçerlidir. Kullanılmayan yüklemeler panelden temizlenebilir; mevcut günlük cron süresi dolan paketleri de temizler. Yalnız ilgili staging işleminin oluşturduğu ve müşteri kayıtlarınca kullanılmayan dosyalar kaldırılır. Uygulanmış yedeğin kullanılan dosyaları korunur.

## İçe aktarma / geri yükleme

1. Hedef firmayı seçin ve o firmaya ait `.ritimbackup` dosyasını açın.
2. Arşiv parolasını ve işlem gerekçesini girin.
3. “Yedeği doğrula ve önizle” ile şema, firma kimliği, kayıt alanları, dosya boyutu/özeti ve ilişkiler denetlenir. Bu aşama canlı kalite kayıtlarını değiştirmez.
4. Eklenecek, korunacak ve çakışan kayıt sayılarını inceleyin.
5. Genel görünümden firmayı geçici durdurun. Panel sahibinin kendi giriş firması durdurulamaz.
6. Önizlemeye dönüp hedef çalışma alanı adını yazarak yüklemeyi başlatın.
7. Veriler ve dosya referansları tek transaction içinde uygulanır. Hata halinde müşteri verisi rollback edilir. Aynı işlemin tekrarı kayıt çoğaltmaz.
8. Sonucu kontrol edip firmayı yeniden açın.

Mevcut kayıtların üzerine yazılmaz. Çakışan parça/plan/ölçümler işlemi durdurur. Mevcut kullanıcıların güncel şifreleri ve rol/durumları korunur; yalnız kayıp kullanıcılar yedekten eklenir ve eski oturumlarının geçersiz kalması için session sürümü artırılır. Dosyalar yeni staging konumunda doğrulanıp referansları uygulanır.

Bu işlem **aynı firmada eksik kayıt kurtarmadır**; geçmiş bir tarihe yıkıcı rollback, firma klonlama veya farklı tenant'a kopyalama değildir. Hedef tenant'ın var olması gerekir. Firma kimliği, lisans/erişim ve ödeme ayarları yedekten otomatik değiştirilmez. Bütün veritabanının kaybı için sağlayıcı seviyesindeki PostgreSQL/Storage yedekleri ayrıca gerekir.

## Kapsam dışı veriler ve sınırlar

- Henüz operatör cihazında duran, sunucuya gönderilmemiş IndexedDB/çevrimdışı ölçümleri merkezi panel alamaz.
- Tek kullanımlık giriş/şifre sıfırlama token'ları, push abonelikleri ve Stripe operasyon kayıtları aktarılmaz.
- Mevcut dosya başına 8 MB sınırı korunur. Tarayıcı arşiv açmada 256 MB dosya ve 512 MB açılmış içerik sınırı vardır; bunlar müşteri paket kotası değildir.
- Yerel kabul gerçek PostgreSQL ve yerel dosyalarla yapılmıştır. Üretim private Supabase Storage imzalı yükleme/indirme akışı gerçek ortamda ayrıca kabul edilmelidir.

## Doğrulama

- `npm run test:platform`: owner yetkisi, gizli alan ayıklama, tablo seçici, çakışma ve şifreli arşiv testleri.
- `npm run test:platform:integration`: yeni, ayrı loopback PostgreSQL kümesinde API + gerçek tarayıcı akışı. Kurulu veritabanına bağlanmaz; test sonunda kendi kümesini durdurur. Windows PostgreSQL 18 ve Node 22 kullanılır. Farklı binary konumu için `RITIM_PG_BIN` verilebilir; Playwright başka yerdeyse `PLAYWRIGHT_MODULE` kullanılabilir.
- API kabulü: owner/normal admin ayrımı, firma izolasyonu, owner hesabını ele geçirme koruması, son yönetici, kalıcı pilot erişimi, tutarlı snapshot ve dosyalar, yanlış tenant/bozuk dosya/yanlış FK reddi, çakışma, bakım kapısı, idempotent geri yükleme, RLS ve audit koruması.
- UI kabulü: gerçek DB üzerinden firma/kullanıcı oluşturma, export, şifreli yedek, yanlış parola, önizleme, bakım + açık hedef onayı, geri yükleme, audit ve 1440/768/390 px görünüm.

Kanıtlar: [API sonuçları](../.runtime/platform-admin/integration-results.json), [tarayıcı sonuçları](../.runtime/platform-admin/browser-results.json), [masaüstü](../.runtime/platform-admin/platform-overview.png), [mobil](../.runtime/platform-admin/platform-mobile.png), [kullanıcılar](../.runtime/platform-admin/platform-users.png).
