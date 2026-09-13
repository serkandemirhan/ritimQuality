# Ritim Quality On-Premise

Kalite kontrol planı, operatör ölçümü, ölçüm geçmişi ve SPC yönetimi için kurum içi kurulan tek organizasyonlu sürüm.

## Mimari

- Tek kurulum ve tek kurum profili
- Admin, kalite mühendisi, operatör ve denetçi rolleri
- Admin tarafından oluşturulan yerel kullanıcı hesapları; dışarıdan firma/kullanıcı kaydı yoktur
- Ürün, revizyonlu kontrol planı, ölçüm oturumları ve denetim izi
- Sayısal, OK/NOK, tekli seçim ve çoklu seçim karakteristikleri
- Karakteristik bazlı kabul kuralları ve zorunlu/opsiyonel fotoğraf-video-dosya kanıtı
- Ortak measurement database; manuel, gauge, import ve ileride CMM kaynakları için aynı sonuç modeli
- Cp/Cpk, Pp/Ppk, histogram, trend, X̄-R ve I-MR analizleri
- Ürün/plan revizyonu, lot, seri no, iş emri, ekipman, operatör ve kaynak izlenebilirliği
- Abonelik, ödeme, paket, kota, Stripe ve tenant bağımlılığı yoktur
- Veriler kurumun PostgreSQL sunucusunda tutulur
- Medya kanıtları varsayılan olarak `.data/media` altında kurum sunucusunda tutulur; konum `MEDIA_ROOT` ile değiştirilebilir

## Kurulum

Gereksinimler: Node.js 20+ ve PostgreSQL 15+.

1. `.env.example` dosyasını `.env` olarak kopyalayın ve tüm örnek değerleri değiştirin.
2. Bağımlılıkları kurun: `npm install`
3. Yeni kurulumda boş bir PostgreSQL veritabanı kullanın. Mevcut tek kurumlu Ritim Quality veritabanı da uyumluluk modunda desteklenir.
4. Şemayı kontrol edin veya yeni şemayı kurun: `npm run db:migrate`
5. Kurum profilini ve ilk yöneticiyi oluşturun: `npm run db:seed`
6. API ve web uygulamasını başlatın: `npm run dev:all`
7. `http://localhost:3000` adresinde `ONPREM_ADMIN_EMAIL` ve `ONPREM_ADMIN_PASSWORD` ile giriş yapın.

İlk kurulumdan sonra kullanıcılar yalnızca yönetim panelindeki **Kullanıcılar** ekranından admin tarafından oluşturulur.

Mevcut tek kurumlu veritabanında tablo dönüşümü yapılmaz. Uygulama içeride mevcut kurum kimliğini kullanır; çalışma alanı, abonelik, ödeme ve kota özellikleri arayüz/API'de bulunmaz.

## Savunma sanayii kurulumu için üretim notları

- Uygulamayı internete doğrudan açmayın; kurum ağı/VPN ve ters proxy arkasında çalıştırın.
- TLS, güvenlik duvarı, ağ segmentasyonu, merkezi loglama ve düzenli çevrimdışı yedek uygulayın.
- `JWT_SECRET` için en az 32 karakterli rastgele bir değer kullanın ve örnek admin parolasını ilk kurulumdan sonra `.env` dosyasından kaldırın.
- PostgreSQL için en az yetkili ayrı bir uygulama rolü kullanın.
- Üretim devreye alımından önce kurumun bilgi güvenliği gereksinimleri kapsamında sızma testi, bağımlılık taraması ve felaket kurtarma tatbikatı yapın.

## Komutlar

- `npm run dev`: React uygulaması
- `npm run dev:api`: Express API
- `npm run dev:all`: Web ve API birlikte
- `npm run db:migrate`: PostgreSQL şemasını kurar
- `npm run db:seed`: İlk kurum ve yönetici hesabını oluşturur/günceller
- `npm run lint`: Frontend TypeScript kontrolü
- `npm run build:api`: Backend TypeScript derlemesi
- `npm run build`: Üretim frontend paketi
- `npm start`: Derlenmiş web uygulaması ve API'yi tek yerel sunucudan yayınlar
