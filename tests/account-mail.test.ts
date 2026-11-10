import assert from 'node:assert/strict';
import {test} from 'node:test';
import {accountMailConfigured, sendAccountMail} from '../server/services/accountMail.js';

test('account mail keeps tokens in fragments and fails safely without sending real email', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['APP_URL', 'AUTH_EMAIL_FROM', 'RESEND_API_KEY'] as const;
  const saved = keys.map(key => process.env[key]);
  let calls = 0;
  try {
    delete process.env.RESEND_API_KEY;
    globalThis.fetch = async () => { calls++; throw new Error('Unexpected network call'); };
    assert.equal(accountMailConfigured(), false);
    await assert.rejects(sendAccountMail('nobody@example.invalid', 'fixture-token', 'reset'), /not configured/);
    assert.equal(calls, 0);
    process.env.APP_URL = 'https://quality.example.invalid';
    process.env.AUTH_EMAIL_FROM = 'Ritim Quality <accounts@example.invalid>';
    process.env.RESEND_API_KEY = 'test-only';
    assert.equal(accountMailConfigured(), true);
    for (const purpose of ['reset', 'verify'] as const) {
      globalThis.fetch = async (url, options) => {
        calls++;
        assert.equal(url, 'https://api.resend.com/emails');
        const body = JSON.parse(String(options?.body));
        assert.match(body.html, /<html lang="tr">/);
        assert.match(body.html, /role="presentation"/);
        assert.ok(body.html.includes(purpose==='reset'?'Şifremi yenile':'E-posta adresimi doğrula'));
        assert.ok(body.html.includes('auth='+purpose+'#token=fixture-token'));
        assert.deepEqual(body.to, ['nobody@example.invalid']);
        const link = new URL(body.text.split('\n\n')[1]);
        assert.equal(link.searchParams.get('auth'), purpose);
        assert.equal(link.searchParams.has('token'), false);
        assert.equal(new URLSearchParams(link.hash.slice(1)).get('token'), 'fixture-token');
        assert.ok(options?.signal);
        return new Response('{}', {status: 200});
      };
      await sendAccountMail('nobody@example.invalid', 'fixture-token', purpose);
    }
    globalThis.fetch = async () => new Response('{}', {status: 503});
    await assert.rejects(sendAccountMail('nobody@example.invalid', 'fixture-token', 'reset'), /delivery failed/);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
  }
});
