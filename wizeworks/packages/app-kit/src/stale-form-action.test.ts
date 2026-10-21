import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { postedActionIds, readActionIds, staleFormActionRedirect } from './stale-form-action';

// The 500 this exists for: a server-action form posted without JavaScript names
// its action by id, and an id from an older build made Next.js throw "Failed to
// find Server Action". These hold the two halves: an unknown id is sent back to
// a fresh page, and nothing Next would accept is ever redirected.

const LIVE = 'a'.repeat(42);
const STALE = 'b'.repeat(42);

const dist = mkdtempSync(join(tmpdir(), 'app-kit-actions-'));
mkdirSync(join(dist, 'server'));
writeFileSync(
  join(dist, 'server', 'server-reference-manifest.json'),
  JSON.stringify({
    node: { [LIVE]: { workers: { 'app/signup/page': { moduleId: 1, async: false } } } },
    edge: {},
  })
);
afterAll(() => rmSync(dist, { recursive: true, force: true }));

/** A multipart POST as it arrives through the ingress: typed and sized. */
async function post(
  fields: Record<string, string>,
  headers: Record<string, string> = {}
): Promise<Request> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const encoded = new Response(form);
  const body = await encoded.arrayBuffer();
  return new Request('https://getpiggles.com/signup?from=home-why', {
    method: 'POST',
    body,
    headers: {
      'content-type': encoded.headers.get('content-type') ?? '',
      'content-length': String(body.byteLength),
      ...headers,
    },
  });
}

describe('readActionIds', () => {
  it('reads the ids from the build manifest', () => {
    expect(readActionIds(dist)).toEqual(new Set([LIVE]));
  });

  it('knows nothing when there is no build to read', () => {
    expect(readActionIds(join(dist, 'missing'))).toBeNull();
  });
});

describe('postedActionIds', () => {
  it('reads a plain action field and a bound-action descriptor', () => {
    const form = new FormData();
    form.append(`$ACTION_ID_${LIVE}`, '');
    form.append('$ACTION_REF_1', '');
    form.append('$ACTION_1:0', JSON.stringify({ id: STALE, bound: '$@1' }));
    form.append('email', 'owner@example.com');
    expect(postedActionIds(form)).toEqual([LIVE, STALE]);
  });
});

describe('staleFormActionRedirect', () => {
  const known = readActionIds(dist);

  it('sends a form from an older build back to a fresh page', async () => {
    const res = await staleFormActionRedirect(
      await post({ [`$ACTION_ID_${STALE}`]: '', email: 'owner@example.com' }),
      known
    );
    expect(res?.status).toBe(303);
    expect(res?.headers.get('location')).toBe('https://getpiggles.com/signup?from=home-why');
  });

  it('gives a Location Next can parse without a base', async () => {
    // Next's proxy adapter reads the Location as `new NextURL(location)` with no
    // base. A bare path threw "Invalid URL" there and turned the redirect into
    // the same 500 it was written to prevent.
    const res = await staleFormActionRedirect(await post({ [`$ACTION_ID_${STALE}`]: '' }), known);
    const location = res?.headers.get('location') ?? '';
    expect(() => new URL(location)).not.toThrow();
  });

  it('sends back a bound action whose descriptor names an older build', async () => {
    const res = await staleFormActionRedirect(
      await post({ $ACTION_REF_1: '', '$ACTION_1:0': JSON.stringify({ id: STALE, bound: null }) }),
      known
    );
    expect(res?.status).toBe(303);
  });

  it('lets a form from this build through', async () => {
    expect(
      await staleFormActionRedirect(await post({ [`$ACTION_ID_${LIVE}`]: '' }), known)
    ).toBeNull();
    expect(
      await staleFormActionRedirect(
        await post({ $ACTION_REF_1: '', '$ACTION_1:0': JSON.stringify({ id: LIVE, bound: null }) }),
        known
      )
    ).toBeNull();
  });

  it('never touches a post that names no action, which may be an upload to a route', async () => {
    expect(await staleFormActionRedirect(await post({ file: 'bytes' }), known)).toBeNull();
  });

  it('leaves a hydrated action call to Next, which already answers it', async () => {
    const res = await staleFormActionRedirect(
      await post({ [`$ACTION_ID_${STALE}`]: '' }, { 'next-action': STALE }),
      known
    );
    expect(res).toBeNull();
  });

  it('never reads a body too large, or of unknown size, to be a form', async () => {
    const stale = { [`$ACTION_ID_${STALE}`]: '' };
    expect(
      await staleFormActionRedirect(
        await post(stale, { 'content-length': String(1024 * 1024) }),
        known
      )
    ).toBeNull();
    const unsized = await post(stale);
    unsized.headers.delete('content-length');
    expect(await staleFormActionRedirect(unsized, known)).toBeNull();
  });

  it('judges nothing when the build could not be read', async () => {
    expect(
      await staleFormActionRedirect(await post({ [`$ACTION_ID_${STALE}`]: '' }), null)
    ).toBeNull();
  });

  it('leaves the body readable for Next after it looks', async () => {
    const req = await post({ [`$ACTION_ID_${LIVE}`]: '', email: 'owner@example.com' });
    await staleFormActionRedirect(req, known);
    expect((await req.formData()).get('email')).toBe('owner@example.com');
  });
});
