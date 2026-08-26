import { describe, expect, it } from 'vitest';
import { ALL_MODULES } from '@wizeworks/modules';
import { FUNNEL_LIBRARY, recipesForModules } from './library';
import { DEFAULT_STALL_HOURS, FunnelStages, stallHoursOf } from './schemas';

describe('the shipped library', () => {
  it('ships the seven recipes docs/151 §9 promises', () => {
    expect(FUNNEL_LIBRARY).toHaveLength(7);
  });

  it('gives every recipe a unique, stable key', () => {
    // The key is stamped onto the tenant's row as provenance and is how the
    // gallery knows what they already have. A duplicate would make two recipes
    // indistinguishable after install.
    const keys = FUNNEL_LIBRARY.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every recipe a goal, so none installs as homework', () => {
    // The server refuses to turn on a campaign with no goal. A library whose
    // members all land as un-activatable drafts would be a gallery of chores.
    for (const recipe of FUNNEL_LIBRARY) {
      expect(recipe.goal.conditions.length, recipe.key).toBeGreaterThan(0);
    }
  });

  it('starts every recipe at the capture line, never an anonymous view rung', () => {
    // A `view` rung has to be told which page counts, and a funnel with an
    // unresolved one is refused activation (B3). Shipping seven that all say
    // "say which page first" is the failure this asserts against.
    for (const recipe of FUNNEL_LIBRARY) {
      expect(
        recipe.stages.some((s) => s.kind === 'view'),
        `${recipe.key} starts with a view rung`
      ).toBe(false);
    }
  });

  it('ends every recipe with something that counts as won', () => {
    for (const recipe of FUNNEL_LIBRARY) {
      const last = recipe.stages[recipe.stages.length - 1];
      expect(last?.kind, recipe.key).toBe('convert');
    }
  });

  it('passes the platform stage validator every recipe', () => {
    // The same rules a tenant's own campaign is held to. A shipped recipe that
    // could not be saved through the normal path would be a library of rows the
    // editor then refuses to accept.
    for (const recipe of FUNNEL_LIBRARY) {
      const parsed = FunnelStages.safeParse(recipe.stages);
      expect(parsed.success, `${recipe.key}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
  });

  it('overrides the kind default only where the recipe knows better', () => {
    const nurture = FUNNEL_LIBRARY.find((r) => r.key === 'lead-nurture')!;
    // A nurture campaign that gives up after the `lead` default of a fortnight
    // is a follow-up campaign wearing the wrong name.
    expect(nurture.stallAfterHours).toBeGreaterThan(DEFAULT_STALL_HOURS.lead);
    expect(stallHoursOf({ kind: nurture.kind, stallAfterHours: nurture.stallAfterHours })).toBe(
      nurture.stallAfterHours
    );

    const cart = FUNNEL_LIBRARY.find((r) => r.key === 'cart-recovery')!;
    // And where the default is right, it is left alone rather than restated.
    expect(cart.stallAfterHours).toBeUndefined();
    expect(stallHoursOf({ kind: cart.kind, stallAfterHours: null })).toBe(
      DEFAULT_STALL_HOURS.recovery
    );
  });
});

describe('recipesForModules — what a given tenant should get', () => {
  it('gives a commerce-only tenant the commerce campaigns and nothing else', () => {
    const got = recipesForModules(['commerce', 'funnels']).map((r) => r.key);
    expect(got).toEqual(['cart-recovery', 'post-purchase']);
  });

  it('never offers a CMS-only publisher a campaign about baskets', () => {
    // The whole reason a recipe declares its module: a campaign about an event
    // the tenant cannot emit is not a partial campaign, it is a wrong one.
    expect(recipesForModules(['cms', 'funnels'])).toEqual([]);
  });

  it('gives a tenant with everything on all seven', () => {
    expect(recipesForModules(['commerce', 'crm', 'b2b', 'scheduling'])).toHaveLength(7);
  });

  it('is empty rather than throwing for a tenant with nothing on', () => {
    expect(recipesForModules([])).toEqual([]);
  });

  it('names only modules the platform actually has', () => {
    // Asserted against the REAL registry, not a list copied into this file. A
    // recipe pointing at a slug nobody registered would install for nobody,
    // silently, forever (docs/152 §8 footgun 2) — and a hardcoded copy of the
    // module list here would go stale and stop catching it.
    const real = new Set<string>(ALL_MODULES);
    for (const recipe of FUNNEL_LIBRARY) {
      expect(real.has(recipe.module), `${recipe.key} names "${recipe.module}"`).toBe(true);
    }
  });
});
