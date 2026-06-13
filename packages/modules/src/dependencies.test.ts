// Module dependency graph — the two distinct relationships and their helpers.
//
// These are PURE (settings-blob in, decision out) so they need no DB. The two
// invariants that matter most for billing are pinned explicitly:
//   • a BUNDLED_FREE capability (invoicing) is on for any provider tenant, and
//   • a REQUIRES dependency (commerce) is NEVER derived on from its dependent
//     (b2b) — it must be physically enabled so it stays billable.

import { describe, it, expect } from 'vitest';

import {
  requiredModules,
  blockingDependents,
  isModuleFlagOn,
  deriveModuleStates,
  type ModuleSlug,
} from './index';

/** Build a tenant `settings` blob with the given modules flagged enabled. */
function settings(...enabled: ModuleSlug[]): unknown {
  return { modules: Object.fromEntries(enabled.map((m) => [m, { enabled: true }])) };
}

describe('requiredModules', () => {
  it('returns the paid requirements that must be co-enabled', () => {
    expect(requiredModules('b2b')).toEqual(['commerce']);
  });

  it('is empty for modules with no requirements', () => {
    expect(requiredModules('commerce')).toEqual([]);
    expect(requiredModules('invoicing')).toEqual([]);
    expect(requiredModules('cms')).toEqual([]);
  });
});

describe('blockingDependents', () => {
  it('reports an enabled dependent that blocks disabling its requirement', () => {
    // B2B requires Commerce → can't turn Commerce off while B2B is on.
    expect(blockingDependents('commerce', (m) => m === 'b2b')).toEqual(['b2b']);
  });

  it('does not block when the dependent is off', () => {
    expect(blockingDependents('commerce', () => false)).toEqual([]);
  });

  it('never blocks a module nothing requires', () => {
    expect(blockingDependents('b2b', () => true)).toEqual([]);
    expect(blockingDependents('invoicing', () => true)).toEqual([]);
  });
});

describe('isModuleFlagOn — BUNDLED_FREE derivation', () => {
  it('invoicing is on when only its own flag is set', () => {
    expect(isModuleFlagOn(settings('invoicing'), 'invoicing')).toBe(true);
  });

  it('invoicing rides along free with B2B', () => {
    expect(isModuleFlagOn(settings('b2b'), 'invoicing')).toBe(true);
  });

  it('invoicing rides along free with Commerce', () => {
    expect(isModuleFlagOn(settings('commerce'), 'invoicing')).toBe(true);
  });

  it('invoicing is off when neither it nor a provider is set', () => {
    expect(isModuleFlagOn(settings('cms', 'crm'), 'invoicing')).toBe(false);
    expect(isModuleFlagOn(settings(), 'invoicing')).toBe(false);
    expect(isModuleFlagOn(null, 'invoicing')).toBe(false);
  });

  it('Commerce is NOT derived-on from B2B (billing invariant — it must be set to be billed)', () => {
    // The REQUIRES edge is enforced write-side, never derived here; otherwise a
    // B2B tenant would get Commerce functionally without a billable flag.
    expect(isModuleFlagOn(settings('b2b'), 'commerce')).toBe(false);
  });

  it('a plain module reflects only its own flag', () => {
    expect(isModuleFlagOn(settings('cms'), 'cms')).toBe(true);
    expect(isModuleFlagOn(settings('crm'), 'cms')).toBe(false);
  });
});

describe('deriveModuleStates — enabled + source', () => {
  it('marks an explicitly purchased module as explicit', () => {
    const s = deriveModuleStates(settings('invoicing'));
    expect(s.invoicing).toEqual({ enabled: true, source: 'explicit', includedBy: [] });
  });

  it('marks a bundled capability with its providers', () => {
    const s = deriveModuleStates(settings('b2b'));
    expect(s.invoicing).toEqual({ enabled: true, source: 'bundled', includedBy: ['b2b'] });
    // B2B itself is explicit; Commerce is off until the toggle handler writes it.
    expect(s.b2b.source).toBe('explicit');
    expect(s.commerce).toEqual({ enabled: false, source: 'off', includedBy: [] });
  });

  it('lists every provider that bundles a capability', () => {
    const s = deriveModuleStates(settings('b2b', 'commerce'));
    expect(s.invoicing.source).toBe('bundled');
    expect(s.invoicing.includedBy).toEqual(['b2b', 'commerce']);
  });

  it('bundling WINS over a standalone purchase — invoicing bought first, then a provider', () => {
    // Regression: a tenant who enabled `invoicing` standalone and LATER turned on
    // Commerce must stop being charged. Before the precedence fix this stayed
    // `explicit` (still billed, UI showed "+ $19" instead of "Included").
    const s = deriveModuleStates(settings('invoicing', 'commerce'));
    expect(s.invoicing).toEqual({ enabled: true, source: 'bundled', includedBy: ['commerce'] });
  });

  it('preserves the standalone flag so invoicing re-bills once the provider is gone', () => {
    // The flag set in the bundled case above survives — removing the provider
    // re-surfaces invoicing as an explicit (billable) purchase, not off.
    expect(deriveModuleStates(settings('invoicing')).invoicing).toEqual({
      enabled: true,
      source: 'explicit',
      includedBy: [],
    });
  });

  it('marks an unprovided module off', () => {
    const s = deriveModuleStates(settings('cms'));
    expect(s.invoicing).toEqual({ enabled: false, source: 'off', includedBy: [] });
  });
});
