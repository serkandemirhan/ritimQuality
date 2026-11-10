# Ritim Quality — gerçek Android cihaz kabul testi

Tarih: 9–10 Kasım 2026  
Ortam: yerel fixture (`http://127.0.0.1:3350`), üretim verisi kullanılmadı

## Cihazlar

| Cihaz | Android | Chrome | Fiziksel ekran | CSS görünümü |
|---|---:|---:|---:|---:|
| Samsung Galaxy A32 5G (`SM-A326B`) | 13 | 156.0.8078.81 | 720 × 1600 | 384 × 721 |
| Samsung Galaxy S22 (`SM-S901B`) | 16 | 156.0.8078.79 | 1080 × 2340 | 360 × 649 |

## Doğrulanan akışlar

- Genel bakış, kontrol planları, parçalar, aksiyonlar, kontrol kayıtları, kullanıcılar, ayarlar ve operatör ekranları iki cihazda açıldı.
- Her iki cihazda beş ardışık ölçüm gerçek dokunmatik arayüzden girildi ve IndexedDB içinde kalıcı olarak doğrulandı.
- Üçüncü ölçümden sonra ağ kesildi; çevrimdışı ölçüm kaydı iki cihazda da devam etti.
- Uygulama Android ana ekranına gönderilip geri açıldı; beş ölçümlük taslak korundu.
- Dikey/yatay yön değişiminden sonra veri kaybı ve yatay sayfa taşması görülmedi.
- Ölçüm alanı ile kaydet düğmesinin kesişmediği sınır dikdörtgenleriyle doğrulandı.
- Seçili karakteristik, nominal ve tolerans değerleri aynı aktif karakteristikten üretildi.
- Teknik resim oranı dikey ölçüm akışında korundu; seçili balon ve işaretleme katmanı görünür kaldı.
- S22 üzerinde tek numunelik altı karakteristik tamamlandı; ağ kesikken yerel kalite raporu açıldı ve “Yerel rapor” uyarısı doğrulandı.

## Yapılan iyileştirmeler

- 360 px genişlikte uzun karakteristik adının nokta ilerlemesini sıkıştırması giderildi; dar görünümde yalnızca gereksiz “Noktalar” etiketi gizleniyor, sayaç korunuyor.
- Kısa yatay görünüm için ölçüm kabuğu, teknik resim ve kontroller daha kompakt hale getirildi.
- Gerçek cihaz kabul, çevrimdışı kayıt, yeniden açma, yön değiştirme ve tamamlanmış yerel rapor testleri otomatikleştirildi.

## Otomatik regresyon sonucu

- TypeScript/lint: geçti.
- Mobil ölçüm birim testleri: 8/8 geçti.
- Mobil tarayıcı yaşam döngüsü testi: geçti. 360/390/430 px, 48 px hedefler, çevrimdışı 250 hücre, tekrar ölçüm, kanıt zorunlulukları, kota ve medya hata kurtarma senaryoları doğrulandı.
- Üretim derlemesi: geçti. Ana paket için mevcut 500 kB üzeri uyarısı devam ediyor; bu bir derleme hatası değil.

## Kanıt ekranları

- [A32 genel bakış](./RFCRC1R150K/01-genel-bakis.png)
- [A32 mobil ölçüm](./RFCRC1R150K/12-bes-ardisik-olcum.png)
- [A32 çevrimdışı kayıt](./RFCRC1R150K/11-cevrimdisi-cihazda-kayit.png)
- [A32 yeniden açma](./RFCRC1R150K/14-uygulama-yeniden-acildi.png)
- [S22 genel bakış](./R5CTB21F4LH/01-genel-bakis.png)
- [S22 mobil ölçüm](./R5CTB21F4LH/12-bes-ardisik-olcum.png)
- [S22 çevrimdışı kayıt](./R5CTB21F4LH/11-cevrimdisi-cihazda-kayit.png)
- [S22 tamamlanmış ölçüm](./R5CTB21F4LH/17-tum-olcumler-tamamlandi.png)
- [S22 çevrimdışı yerel rapor](./R5CTB21F4LH/18-cevrimdisi-yerel-rapor.png)

## Sınırlar

- Bu çalışma gerçek iki Android cihazı kapsar; gerçek iPhone/iOS cihaz doğrulaması yapılmadı.
- Gerçek kullanıcı adı/parola oturumu, yerel PostgreSQL test servisi çalışmadığı için bu turda tekrar doğrulanamadı. Rol ve kullanıcı yaşam döngüsü yerel fixture üzerinden test edildi.
- Kamera QR önizlemesi için fiziksel kamera izni otomatik olarak değiştirilmedi; QR çözümleme akışı tarayıcı testiyle kapsanıyor.
- Canlı ortama dağıtım yapılmadı.
