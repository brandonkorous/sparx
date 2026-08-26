import { describe, expect, it } from 'vitest';
import { mintFormUploadToken } from './form-upload-token.js';
import {
  GATED_DELIVERY_TTL_SECONDS,
  mintGatedDeliveryToken,
  verifyGatedDeliveryToken,
} from './gated-delivery-token.js';

const SECRET = 'a-test-secret-that-is-at-least-32-characters-long';
const NOW = 1_800_000_000;

const CLAIMS = {
  tid: '11111111-1111-1111-1111-111111111111',
  key: 'gated/tenant/the-2027-pricing-guide.pdf',
  name: 'The 2027 Pricing Guide.pdf',
  mime: 'application/pdf',
  sub: 'jordan@example.com',
  exp: NOW + GATED_DELIVERY_TTL_SECONDS,
};

describe('gated delivery token', () => {
  it('round-trips the claims it was minted with', () => {
    const token = mintGatedDeliveryToken(CLAIMS, SECRET);
    const result = verifyGatedDeliveryToken(token, { secret: SECRET, now: NOW });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.claims).toEqual(CLAIMS);
  });

  it('rejects a tampered payload', () => {
    const token = mintGatedDeliveryToken(CLAIMS, SECRET);
    const [body, sig] = token.split('.');
    // Swap the storage key for someone else's and keep the signature.
    const forged = Buffer.from(
      JSON.stringify({ typ: 'gated-delivery', ...CLAIMS, key: 'private/somebody-elses.pdf' }),
      'utf8'
    ).toString('base64url');
    expect(body).not.toBe(forged);
    const result = verifyGatedDeliveryToken(`${forged}.${String(sig)}`, {
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad-signature');
  });

  it('rejects a token signed with a different secret', () => {
    const token = mintGatedDeliveryToken(CLAIMS, 'another-secret-of-at-least-32-characters!!');
    const result = verifyGatedDeliveryToken(token, { secret: SECRET, now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad-signature');
  });

  it('reports an expired link as expired, not as forged', () => {
    const token = mintGatedDeliveryToken(CLAIMS, SECRET);
    const result = verifyGatedDeliveryToken(token, {
      secret: SECRET,
      now: CLAIMS.exp + 1,
    });
    expect(result.ok).toBe(false);
    // The distinction is the whole point: one deserves "that link ran out, here
    // is the form again" and the other deserves nothing at all.
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('accepts a link on its last second', () => {
    const token = mintGatedDeliveryToken(CLAIMS, SECRET);
    expect(verifyGatedDeliveryToken(token, { secret: SECRET, now: CLAIMS.exp }).ok).toBe(true);
  });

  it('refuses an upload token, which shares the signing secret', () => {
    // This is why the two carry a distinct `typ`. Both are validly signed by the
    // same key, so without the type check a form-upload URL would be a download
    // grant for whatever key it names.
    const upload = mintFormUploadToken(
      {
        tid: CLAIMS.tid,
        uid: 'u1',
        key: CLAIMS.key,
        mime: CLAIMS.mime,
        max: 1000,
        name: CLAIMS.name,
        exp: CLAIMS.exp,
      },
      SECRET
    );
    const result = verifyGatedDeliveryToken(upload, { secret: SECRET, now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-type');
  });

  it('rejects a malformed token rather than throwing', () => {
    for (const bad of ['', '.', 'nodot', 'a.', '.b', 'not-base64.also-not']) {
      expect(verifyGatedDeliveryToken(bad, { secret: SECRET, now: NOW }).ok).toBe(false);
    }
  });

  it('refuses to sign with a weak secret', () => {
    expect(() => mintGatedDeliveryToken(CLAIMS, 'too-short')).toThrow(/32/);
  });
});
