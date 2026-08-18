// Gate manifest coverage (§7.1#2/#4) + the webhook-egress SSRF guard.
// Pure unit-level — the egress gate inspects the effect, not the tenant tx.

import { describe, expect, it } from 'vitest';

import { installBuiltinActions } from '../../src/actions/builtins';
import { getDescriptor, registerAction, registeredActionTypes } from '../../src/actions/registry';
import { dispatch, UnregisteredActionError } from '../../src/dispatch/dispatcher';
import type { EffectInput, TenantCtx } from '../../src/engine-types';
import { webhookEgressGate } from '../../src/gates/builtins';

const fakeCtx = {} as TenantCtx;
const effect = (url: unknown): EffectInput => ({
  actionType: 'platform.webhook',
  config: { url },
  fields: {},
});

describe('gate manifest coverage (§7.1)', () => {
  it('every registered action declares a gate manifest + justifying note', () => {
    installBuiltinActions();
    const types = registeredActionTypes();
    expect(types.length).toBeGreaterThan(0);
    for (const t of types) {
      const d = getDescriptor(t)!;
      expect(Array.isArray(d.gates)).toBe(true);
      // an empty manifest is allowed ONLY with a justifying note
      if (d.gates.length === 0) expect(d.manifestNote.trim().length).toBeGreaterThan(0);
    }
  });

  it('an empty manifest with no note fails registration', () => {
    expect(() =>
      registerAction({
        type: 'commerce.update_inventory',
        module: 'commerce',
        gates: [],
        manifestNote: '   ',
        execute: () => Promise.resolve(null),
      })
    ).toThrow(/manifestNote/);
  });

  it('dispatching an unregistered action throws (never a silent no-op)', async () => {
    await expect(dispatch(fakeCtx, 'b2b.convert_quote', {}, {})).rejects.toBeInstanceOf(
      UnregisteredActionError
    );
  });
});

describe('webhook-egress gate (SSRF guard)', () => {
  it('allows a public https URL', async () => {
    const r = await webhookEgressGate.run(fakeCtx, effect('https://hooks.example.com/x'));
    expect(r.kind).toBe('allow');
  });

  it('denies loopback / private / link-local hosts', async () => {
    for (const url of [
      'http://127.0.0.1/x',
      'http://localhost:3000/x',
      'http://10.1.2.3/x',
      'http://192.168.0.5/x',
      'http://169.254.169.254/latest/meta-data', // cloud metadata endpoint
      'http://172.16.5.5/x',
    ]) {
      const r = await webhookEgressGate.run(fakeCtx, effect(url));
      expect(r.kind, url).toBe('deny');
    }
  });

  it('denies non-http(s) schemes and missing/invalid URLs', async () => {
    expect((await webhookEgressGate.run(fakeCtx, effect('file:///etc/passwd'))).kind).toBe('deny');
    expect((await webhookEgressGate.run(fakeCtx, effect('not a url'))).kind).toBe('deny');
    expect((await webhookEgressGate.run(fakeCtx, effect(undefined))).kind).toBe('deny');
  });
});
