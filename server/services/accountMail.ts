const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

export function accountMailHtml(link:string,purpose:'reset'|'verify'):string {
  const reset=purpose==='reset';
  const title=reset?'Yeni bir şifreyle devam edin.':'Çalışma alanınıza bir adım kaldı.';
  const action=reset?'Şifremi yenile':'E-posta adresimi doğrula';
  const description=reset?'Ritim Quality hesabınız için şifre yenileme talebinizi aldık. Aşağıdaki düğmeden yeni şifrenizi belirleyebilirsiniz.':'Ritim Quality hesabınızla ilişkili e-posta adresini doğrulamak için aşağıdaki düğmeyi kullanın.';
  const url=escapeHtml(link);
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;padding:0;background:#f3f5f2;color:#18313a;font-family:Segoe UI,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${action}. Bağlantınız 30 dakika geçerlidir.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#fff;border:1px solid #e1e7e3;border-radius:16px;overflow:hidden">
  <tr><td style="background:#152f38;padding:28px 32px;border-bottom:3px solid #c75a40"><span style="color:#fff;font-size:28px;font-weight:700;letter-spacing:-1px">ritim</span><span style="color:#d7e4e5;font-size:13px;letter-spacing:2px"> &nbsp; quality</span></td></tr>
  <tr><td style="padding:36px 32px 32px"><p style="margin:0 0 16px;font-size:10px;letter-spacing:2px;color:#8d5b48">HESABINIZ · RİTİM QUALITY</p><h1 style="margin:0 0 20px;font-size:28px;line-height:1.25;letter-spacing:-.7px;font-weight:600">${title}</h1><p style="margin:0 0 28px;font-size:15px;line-height:1.8;color:#52666e">${description}</p>
  <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#b94a34" style="border-radius:8px"><a href="${url}" style="display:inline-block;border:14px solid #b94a34;border-left-width:24px;border-right-width:24px;border-radius:8px;color:#fff;font-size:15px;font-weight:600;text-decoration:none">${action} &rarr;</a></td></tr></table>
  <p style="margin:24px 0;font-size:12px;line-height:1.7;color:#64777d">Bu bağlantı <strong>30 dakika</strong> geçerlidir ve yalnızca bir kez kullanılabilir.</p>
  <div style="border-top:1px solid #e8ece8;padding-top:24px"><p style="margin:0 0 12px;font-size:12px;line-height:1.7;color:#64777d">Bu talebi siz yapmadıysanız herhangi bir işlem yapmanız gerekmez. ${reset?'Mevcut şifreniz değişmez.':''}</p><p style="margin:0;font-size:11px;line-height:1.7;color:#64777d">Düğme çalışmıyorsa <a href="${url}" style="color:#294f5b;text-decoration:underline">bu bağlantıyı kullanın</a>.</p></div></td></tr>
  <tr><td style="padding:20px 32px;background:#f8f9f6;border-top:1px solid #e8ece8;color:#78888c;font-size:11px;line-height:1.8">Çizimden rapora. Kalitenin her adımında.<br>Ritim Quality · <a href="https://www.getritim.com/quality" style="color:#52666e;text-decoration:none">getritim.com/quality</a></td></tr>
  </table></td></tr></table></body></html>`;
}

export function accountMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM && process.env.APP_URL?.startsWith('https://'));
}
export async function sendAccountMail(email: string, token: string, purpose: 'reset'|'verify'): Promise<void> {
  if (!accountMailConfigured()) throw new Error('Account email is not configured');
  const link=new URL(process.env.APP_URL!);
  // Fragment is not sent in HTTP requests, access logs or referrers.
  link.searchParams.set('auth',purpose);
  link.hash=new URLSearchParams({token}).toString();
  const action=purpose==='reset'?'Şifrenizi yenileyin':'E-posta adresinizi doğrulayın';
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',signal:AbortSignal.timeout(10000),
    headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:process.env.AUTH_EMAIL_FROM,to:[email],subject:`Ritim Quality — ${action}`,html:accountMailHtml(link.toString(),purpose),
      text:`${action}\n\n${link.toString()}\n\nBu bağlantı tek kullanımlıktır ve 30 dakika geçerlidir. Talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.`}),
  });
  if(!response.ok)throw new Error('Account email delivery failed');
}
