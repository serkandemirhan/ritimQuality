'use client';
export default function ErrorPage({retry}:{retry:()=>void}){return <div className="container prose" role="alert"><h1>Bu sayfa açılamadı.</h1><p>Bağlantıyı kontrol edip yeniden deneyin.</p><button className="button button-primary" onClick={retry}>Tekrar dene</button></div>;}
