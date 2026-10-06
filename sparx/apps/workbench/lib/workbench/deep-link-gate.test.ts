// Whether a LINK may open a pane, and what happens before we know.
//
// The nav hides a switched-off module, so a link is how somebody reaches one: a
// bookmark, a shared address, a saved layout, the back button. This resolver
// exists to apply the same two gates the nav applies.
//
// It failed open. `gateSurface` answered "ok" while the module list was still
// loading, which on a cold arrival is always — so the pane opened, its first
// request hit api-rest's module gate, came back 404, and the surface reported
// "something went wrong reaching the server · try again in a moment" over a
// button that could not work on the first press or the hundredth. Nothing had
// gone wrong. She had switched Email off.
//
// The surfaces here are REGISTERED BY THIS FILE rather than taken from the real
// catalog: the gate is the subject, and importing three hundred React surfaces
// to ask a question about two strings would test the catalog instead.

import { describe, expect, it } from 'vitest';

import { registerSurface, type SurfaceDefinition } from '../surfaces/registry';
import { resolveDeepLink, type SiteGate } from './deep-link-resolve';
import type { DeepLink } from './deep-link';

const stub = (key: string, module: string): SurfaceDefinition =>
  ({
    key,
    title: key,
    module,
    icon: null,
    component: () => null,
  }) as unknown as SurfaceDefinition;

const GATED = 'test.gate.email';
const PLATFORM = 'test.gate.platform';
registerSurface(stub(GATED, 'email'));
registerSurface(stub(PLATFORM, 'platform'));

const SITE: SiteGate = { activeSiteId: 's1', sites: [{ id: 's1', slug: 'primary' }] };

const link = (surface: string): DeepLink => ({ targets: [{ surface }], href: '/x' });

describe('a link to a surface whose module is off', () => {
  it('is refused, and says which reason', () => {
    expect(
      resolveDeepLink(link(GATED), SITE, { states: [{ slug: 'email', enabled: false }] })
    ).toEqual({ kind: 'unresolved', reason: 'module-disabled', detail: GATED });
  });

  it('opens once the module is on', () => {
    expect(
      resolveDeepLink(link(GATED), SITE, { states: [{ slug: 'email', enabled: true }] }).kind
    ).toBe('open');
  });

  it('is refused when the account has it but this PERSON may not open it', () => {
    expect(
      resolveDeepLink(link(GATED), SITE, {
        states: [{ slug: 'email', enabled: true, reachable: false }],
      })
    ).toEqual({ kind: 'unresolved', reason: 'no-access', detail: GATED });
  });
});

describe('before the module list has arrived', () => {
  it('decides NOTHING rather than letting the pane open', () => {
    // The defect in one line. The caller re-runs when the list lands, so waiting
    // costs a beat; allowing costs a pane that opens onto a 404 and then blames
    // the server for it.
    expect(resolveDeepLink(link(GATED), SITE, { states: null }).kind).toBe('nothing');
  });

  it('still opens the workbench’s own surfaces, which cannot be switched off', () => {
    // Settings is how a wrong restriction gets fixed. Waiting on a module list
    // to decide whether somebody may reach Settings is how an account locks
    // itself out of its own console.
    expect(resolveDeepLink(link(PLATFORM), SITE, { states: null }).kind).toBe('open');
  });
});

describe('a module the server has never mentioned', () => {
  it('opens: there is no flag for it to be disabled by', () => {
    expect(
      resolveDeepLink(link(GATED), SITE, { states: [{ slug: 'commerce', enabled: true }] }).kind
    ).toBe('open');
  });

  it('says the address back, never the screen key, for a screen this console lacks', () => {
    const missing: DeepLink = {
      targets: [{ surface: 'nowhere.in.this.console' }],
      href: '/partner/bootcamps/abc?site=primary',
    };
    expect(resolveDeepLink(missing, SITE, { states: null })).toEqual({
      kind: 'unresolved',
      reason: 'unknown-path',
      detail: '/partner/bootcamps/abc',
    });
  });
});
