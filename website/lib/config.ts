export const site={name:'Ritim Quality',url:process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3500',applicationUrl:process.env.NEXT_PUBLIC_APPLICATION_URL||'http://localhost:3400'};
export const plans=[
 {id:'free',name:'Ücretsiz',users:3,controlPlans:2,measurements:2500,description:'İki aktif kontrol planıyla süre sınırı olmadan başlayın.'},
 {id:'starter',name:'Başlangıç',users:3,controlPlans:5,measurements:2500,description:'İlk ekibiniz ve kontrol planlarınız için.'},
 {id:'pro',name:'Profesyonel',users:15,controlPlans:50,measurements:25000,description:'Düzenli ölçüm yapan üretim ekipleri için.'},
 {id:'enterprise',name:'Kurumsal',users:9999,controlPlans:9999,measurements:999999,description:'Geniş ekipler ve yüksek kayıt hacmi için.'},
] as const;
export const authConfigured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
