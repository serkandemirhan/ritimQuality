/** Release dates describe production publication, not the time a feature was implemented. */
export const releaseHistory = [
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
