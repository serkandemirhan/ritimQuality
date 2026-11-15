/** Release dates describe production publication, not the time a feature was implemented. */
export const releaseHistory = [
  {version:'1.9.0',date:'2026-11-15' as string|null,status:'published' as const,databaseVersion:'019_workspace_usernames',changes:['Mobil ölçümden çıkarken taslağı kaydetme veya silme seçenekleri eklendi; giriş ekranı daha kompakt hale getirildi.','Ölçüm raporunda kontrol noktalarının teknik resimle hizalanması düzeltildi.','Bildirim listesi sıkılaştırıldı ve tüm bildirimleri okundu işaretleme eklendi.', 'Kontrol kayıtları menüsü Ölçümler olarak adlandırıldı.', 'Tekrar ölçüm notu isteğe bağlı oldu; numune durumu, kanıt uyarıları ve operatör süreleri iyileştirildi.']},
  {version:'1.8.0',date:'2026-11-15' as string|null,status:'published' as const,databaseVersion:'019_workspace_usernames',changes:['Kontrol hazırlığında ürün seçimine ve mobil ölçümde taslağa dönüş kolaylaştırıldı.', 'Mobil ölçümde nokta gezgini ve kaydedilen ölçülere geri dönme düzeltildi.']},
  {version:'1.7.0',date:'2026-11-15' as string|null,status:'published' as const,databaseVersion:'019_workspace_usernames',changes:['Mobil ölçüm taslaklarının farklı sekmelerde sürdürülmesi ve cihazdan gönderim iyileştirildi.']},
  {version:'1.6.0',date:'2026-11-15' as string|null,status:'published' as const,databaseVersion:'019_workspace_usernames',changes:['Mobil bildirim, kontrol hazırlığı ve kanıt penceresi iyileştirildi; cihazdaki birden fazla taslak yönetilebilir.', 'Firma yöneticisi dışındaki kullanıcılar için çalışma alanına bağlı kullanıcı adıyla giriş eklendi.','Platform yöneticisi firma çalışma alanı adını değiştirebilir.', 'Giriş ekranındaki e-posta doğrulama bağlantısı kaldırıldı.']},
  {version:'1.5.0',date:'2026-11-15' as string|null,status:'published' as const,databaseVersion:'018_free_registration',changes:['Mobil ölçüm pencerelerinin iPhone’da işlem düğmelerinin arkasında kalması engellendi.']},
  {version:'1.4.0',date:'2026-11-14' as string|null,status:'published' as const,databaseVersion:'018_free_registration',
   changes:['Mobil kanıt ve uygunsuzluk ekranı, daha okunaklı ölçüm özeti ve dosya işlemleriyle yenilendi.','Ölçüm ekranında eksik kanıt ve değerler nokta ve numune bazında gösterilir.','Reddedilen ölçümler düzenlenebilir; teknik resimde tüm noktalar görünümü kararlı çalışır.','Kanıt dosyaları sürüklenerek yüklenebilir ve ölçümden kaldırılabilir.','Mobil tekrar ölçüm sebebi doğrudan ölçüm ekranından girilebilir.','Mobil teknik resim seçili noktaya odaklanır; ölçüm ekranı daha kompakt kullanılır.']},
  {version:'1.3.0',date:'2026-11-14' as string|null,status:'published' as const,databaseVersion:'018_free_registration',
   changes:['Yeni firma kayıtları süre sınırı olmayan ücretsiz paketle başlar.','Ücretsiz pakette iki aktif kontrol planı sınırı yayınlamada uygulanır; taslaklar ve arşivler kotayı tüketmez.','Örnek ölçülü otomatik plan kaldırıldı; parça kaydından plan hazırlamaya ve yayınlamadan ölçüme doğrudan geçiş eklendi.','Gerçek kayıt ve PDF indirme kabul testleri ile adım bazında süre ölçümü eklendi.']},
  {
    version: '1.2.0',
    date: '2026-11-14' as string | null,
    status: 'published' as const,
    databaseVersion: '016_platform_admin',
    changes: ['Platform yönetiminde firma listesi tek satırlı ve daha kompakt hale getirildi.', 'Platform girişinde çalışma alanı isteme sorunu giderildi.'],
  },
  {
    version: '1.1.0',
    date: '2026-11-14' as string | null,
    status: 'published' as const,
    databaseVersion: '016_platform_admin',
    changes: ['Ayarlar bölümüne sürüm ve değişiklik geçmişi eklendi.', 'Platform paneline manuel abonelik yönetimi eklendi.'],
  },
  {
    version: '1.0.0',
    date: '2026-11-14',
    status: 'published' as const,
    databaseVersion: '016_platform_admin',
    changes: [
      'Platform yönetimi için çalışma alanı gerektirmeyen giriş eklendi.',
      'Operatör ölçüm ekranı ve teknik resim görünümü yenilendi.',
      'Ölçüm taslakları daha kompakt ve aranabilir hale getirildi.',
      'Kontrol planı düzenleme ve toplu işlemler geliştirildi.',
    ],
  },
] as const;
export const currentRelease = releaseHistory[0];
