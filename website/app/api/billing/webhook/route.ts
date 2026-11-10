import {NextResponse} from 'next/server';
export async function POST(){return NextResponse.json({error:'Ödeme sağlayıcısı yapılandırılmadı; abonelik durumu değiştirilmedi.'},{status:503});}
