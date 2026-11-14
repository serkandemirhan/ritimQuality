# Ücretsiz başlangıç ve ilk rapor kabulü

## Ürün davranışı

Yeni kayıt `free`, `active`, `trial_ends_at=NULL`, `pilot_unlimited=false` oluşturur. Mevcut ücretli, deneme veya pilot hesaplar otomatik dönüştürülmez. Ücretsiz paket 2 aktif yayınlanmış plan içerir. Diğer başlangıç hakları mevcut starter kapsamıyla aynı tutulmuştur: 3 aktif kullanıcı ve aylık 2.500 numune. Taslak ve arşivler aktif plan kotasını tüketmez. Ücretli paketlerin mevcut toplam plan/revizyon kotaları korunur.

017 enum ekler; 018 yeni kayıt varsayılanlarını değiştirir. Migrasyon çalıştırıcısı dosyaları ayrı işlemlerde tamamlar. **017 ve 018 koddan önce uygulanmalıdır.** İlk dosyanın enum değişimini ikinci dosyayla aynı transaction'a birleştirmeyin. Yayın henüz yapılmadı: uygulama sürümü 1.2.0 pending.

Plan yayınlama tenant kilidini ürün/plan kilitlerinden önce alır. İki farklı ürünün eşzamanlı yayınlaması aynı kilitte sıraya girer. Aynı ürünün revizyon değişimi mevcut aktif planı aynı transaction içinde arşivler; ek aktif slot gerektirmez. Planın ürün kimliği değiştirilemez.

Ürün kaydı otomatik örnek plan oluşturmaz; plan hazırlamaya yönlendirir. Yeni plan boştur. Boş taslak saklanabilir; yayınlanamaz ve ölçüm için kullanılamaz. Yeni karakteristiklere gerçek ad ve tolerans girilmelidir. Yayınla ve ölçüme geç mevcut değişiklikleri tek sunucu isteğinde kaydeder/yayınlar ve ürünü ölçüm için seçer. PDF analizi isteğe bağlıdır; paneli kapatmak manuel plandaki değişiklikleri silmez.

Çevrimiçi tamamlamada sunucu yanıtı beklenir. Başarısız gönderim/çevrimdışı durumda dayanıklı yerel kuyruk korunur; açılan rapor açıkça yerel olarak işaretlenir. Kuyruk sunucuda kabul edildiğinde rapor güncellenir. Yerel rapor beş dakika başarısı sayılmaz.

## Çalıştırma

Node 22 ve PostgreSQL 17+, Chromium gerekir:

```
npm ci
npx playwright install --with-deps chromium
npm run test:free
TEST_DATABASE_URL=postgresql://postgres:LOCAL_PASSWORD@127.0.0.1:5432/postgres npm run test:acceptance
```

Harness yalnız loopback DB kabul eder; rastgele adlandırılmış ayrı bir DB yaratır, migrasyonları uygular ve NOBYPASSRLS uygulama rolüyle gerçek API'yi başlatır. Testlerin sonunda DB ve geçici medya silinir. TEST_DATABASE_URL yalnız bu iş için ayrılmış PostgreSQL sunucusunu göstermelidir; uygulama rolünün parolası bu test sunucusunda değiştirilir. Üretim verileri veya üretim ortam değişkenleri kullanılmaz. Harici e-posta/ödeme anahtarları harness içinde kapatılır.

Tarayıcı her testte yeni context ve yeni firma kullanır. Ana senaryoda API mock, oturum enjeksiyonu, hazır plan veya ürün yoktur. Gerçek ApplicationEntry kayıt bileşeni harness içinde render edilir; tam Next.js yönlendirmesi/deploy/DNS veya gerçek bulut depolama performansı bu yerel testin kapsamında değildir. Mevcut website navigasyon testi ayrıca korunur.

1440 ve 390 piksel genişliğinde gerçek kayıt, boş firma, ürün/çizim yükleme, üç karakteristik, yayınlama, bir numune, sunucu kaydı ve uygulamanın PDF indir işlemi sınanır. İndirilen PDF ayrıştırılır; ürün, kayıt numarası, adlar, ölçüler ve çizim nesnesi doğrulanır. page.pdf() uygulama indirmesinin yerine kullanılmaz.

## Ölçüm

T0 kayıt giriş sayfasına navigasyon öncesi; T1 form hazır; T2 kayıt API yanıtı; T3 çalışma alanı kullanılabilir; T4 ürün kaydı ve plan hazırlama ekranı; T5 kayıt/yayın isteği kabulü; T6 ölçüme geçiş hazır; T7 ölçüm ekranı; T8 sunucu ölçüm kabulü; T9 PDF indir etkin; T10 gerçek dosya indirme tamamlandı.

Monoton runner saati kullanılır. Toplam T10-T0 <= 300000 ms olmalıdır. PDF içerik ve kalıcılık kontrolleri T10 sonrasında yapılır fakat başarısızsa tüm test başarısızdır. Test timeout'u 360 saniye; performans eşiği 300 saniyedir. Yeniden denemeler kapalıdır. JSON'a commit, çalışma ağacı durumu, ortam, cihaz, süreler ve sonuç yazılır. Parola/token, auth ekran görüntüsü, trace veya HAR kaydedilmez.

`.runtime/acceptance` HTML sonuçları, indirilen PDF, rapor görüntüsü ve timing.json içerir. CI bunları 7 gün saklar. Bunlar otomasyon süreleridir; gerçek yeni müşterilerin beş dakikada bitirdiğini kanıtlamaz. Lansman için ayrıca daha önce kullanmamış 10 kişiyle yardımsız ölçüm önerilir; önerilen eşik en az 9 kişinin geçerli PDF'ye 300 saniyede ulaşmasıdır. Üretim benzeri ağ ve bulut depolama ayrıca ölçülmelidir.

## Kapsam

Birim: ücretsiz erişim/sona erme, aktif kota, boş taslak/yayın, Stripe ayrımı; mevcut PDF ve pilot testleri.

Gerçek DB/API: boş ücretsiz kayıt, istemci ayrıcalık enjeksiyonu, geçmiş deneme tarihine rağmen ücretsiz erişim, çok sayıda taslak, üçüncü aktif plan reddi, arşivleme ve yeniden aktifleştirme, revizyon değiştirme, eşzamanlı yayınlama, firma izolasyonu, ücretli kota, boş plan/geçersiz tolerans, eksik ölçüm, sahte uygun sonucu ve çift gönderim, operatörün plan yazmasının reddi.

Tarayıcı: gerçek ilk rapor indirme; kayıt çakışması, bootstrap/yükleme hatası, geçersiz PDF sonrası manuel devam, kayıt bağlantı hatası, yerel raporun etiketlenmesi, font hatası sonrası PDF yeniden deneme ve bağlantı geri geldiğinde aynı kaydın sunucuda kabul edilmesi ayrıca sınanır. Hata enjeksiyonu senaryosu beş dakika performans eşiğine dahil edilmez. Test dosyasının bulunması testin çalıştırıldığı veya geçtiği anlamına gelmez. Gerçek kullanıcı süresi ölçülmeden hedef doğrulandı olarak raporlanmaz.
