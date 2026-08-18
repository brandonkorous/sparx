import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { decodeSignedRequest } from './social-meta-callbacks.js';

// The signed_request HMAC is the ONLY authentication on the Meta callbacks — there is
// no bearer token — so these cases guard the actual security boundary: a forged or
// downgraded request must never decode to a user id we would then act on by deleting
// that person's connections.

const SECRET = 'test-app-secret';

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build a signed_request the way Meta does, so the happy path is not self-referential. */
function sign(payload: object, secret = SECRET): string {
  const encoded = base64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest();
  return `${base64Url(sig)}.${encoded}`;
}

describe('decodeSignedRequest', () => {
  it('decodes a correctly signed request', () => {
    const signed = sign({ user_id: '12345', algorithm: 'HMAC-SHA256', issued_at: 1_700_000_000 });
    expect(decodeSignedRequest(signed, SECRET)?.user_id).toBe('12345');
  });

  it('rejects a request signed with a different secret', () => {
    const signed = sign({ user_id: '12345', algorithm: 'HMAC-SHA256' }, 'someone-elses-secret');
    expect(decodeSignedRequest(signed, SECRET)).toBeNull();
  });

  it('rejects a tampered payload whose signature no longer matches', () => {
    const signed = sign({ user_id: '12345', algorithm: 'HMAC-SHA256' });
    const [sig] = signed.split('.');
    // Swap in a different user id — the attack this endpoint must resist, since the
    // user id selects whose connections get deleted.
    const forged = base64Url(Buffer.from(JSON.stringify({ user_id: '99999' }), 'utf8'));
    expect(decodeSignedRequest(`${sig}.${forged}`, SECRET)).toBeNull();
  });

  it('rejects an algorithm downgrade even when the HMAC matches', () => {
    // Signed correctly, but claiming a weaker algorithm — accepting it would let a
    // future signer negotiate down.
    const signed = sign({ user_id: '12345', algorithm: 'MD5' });
    expect(decodeSignedRequest(signed, SECRET)).toBeNull();
  });

  it('rejects malformed input without throwing', () => {
    for (const bad of ['', 'nodot', '.', 'a.', '.b', 'a.b']) {
      expect(decodeSignedRequest(bad, SECRET)).toBeNull();
    }
  });

  it('rejects a signature of the wrong length instead of throwing', () => {
    // timingSafeEqual throws on a length mismatch — the guard must catch it first.
    const signed = sign({ user_id: '12345' });
    const [, payload] = signed.split('.');
    expect(decodeSignedRequest(`${base64Url(Buffer.from('short'))}.${payload}`, SECRET)).toBeNull();
  });
});
