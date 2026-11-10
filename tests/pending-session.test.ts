import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasValidSession, pendingStore, sessionScope } from '../src/services/pendingInspections';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} });
const token = (claims: unknown) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

test('invalid and expired sessions do not crash startup or expose pending records', () => {
  for (const value of ['', 'broken', 'x.bad.y', token({}), token({ tenantId: 'a', userId: 'u', exp: 1 })]) {
    storage.set('auth', value);
    assert.equal(hasValidSession('auth'), false);
    assert.deepEqual(pendingStore('auth').list(), []);
  }
});

test('pending records remain scoped to the current company and user', () => {
  storage.set('auth', token({ tenantId: 'a', userId: 'u', exp: Date.now() / 1000 + 60 }));
  storage.set('auth:pending:a:u', JSON.stringify([{ log: { id: 'saved' } }]));
  assert.equal(hasValidSession('auth'), true);
  assert.equal(sessionScope('auth'), 'a:u');
  assert.equal(pendingStore('auth').list().length, 1);
  storage.set('auth', token({ tenantId: 'b', userId: 'u' }));
  assert.deepEqual(pendingStore('auth').list(), []);
  storage.set('auth', token({ tenantId: 'a', userId: 'other' }));
  assert.deepEqual(pendingStore('auth').list(), []);
});
