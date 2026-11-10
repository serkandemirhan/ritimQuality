import {NextResponse} from 'next/server';
export async function POST(){return NextResponse.json({error:'Ücretli abonelikler henüz etkin değil. Ödeme alınmadı.'},{status:503});}
