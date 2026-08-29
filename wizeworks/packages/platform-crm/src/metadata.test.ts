// The board's facts froze at the last rename (issue 320).
//
// `ensureMirror` rewrote a deal's metadata only inside `if (title !== existing.title)`,
// and a title changes once — when a placeholder workspace name becomes the real
// business name — if at all. Onboarding necessarily runs AFTER the tenant row
// exists, so the trade, the modules and the story are chosen minutes after the
// deal is created and never reached the board.
//
// Splitting the two conditions is only safe if "did the facts change?" is
// reliable. The stored side is Postgres `jsonb`, which does not preserve key
// order, so a naive JSON.stringify comparison reports a difference every time
// and turns the guard into an unconditional write on every lifecycle event.

import { describe, expect, it } from 'vitest';

import { sameMetadata } from './mirror';

const NEXT = {
  sparxTenantId: '2e78fb6c-a823-4698-bcb9-58a4f17710a0',
  sparxTenantSlug: 'juniper-row',
  platformBrand: 'piggles',
  modules: ['commerce', 'crm'],
  storyIndustry: 'apparel',
  storyAudience: null,
  storyImpliedModules: [],
  railGroups: ['web', 'sell', 'people'],
};

describe('sameMetadata', () => {
  it('matches the same facts however jsonb reordered the keys', () => {
    const stored = {
      railGroups: ['web', 'sell', 'people'],
      platformBrand: 'piggles',
      storyIndustry: 'apparel',
      modules: ['commerce', 'crm'],
      sparxTenantSlug: 'juniper-row',
      storyImpliedModules: [],
      storyAudience: null,
      sparxTenantId: '2e78fb6c-a823-4698-bcb9-58a4f17710a0',
    };
    expect(sameMetadata(stored, NEXT)).toBe(true);
  });

  it('sees a trade that arrived after signup', () => {
    // The exact case from the issue: the deal was written before onboarding
    // recorded the trade.
    const stored = { ...NEXT, storyIndustry: null };
    expect(sameMetadata(stored, NEXT)).toBe(false);
  });

  it('sees a module switched on and an acquisition detail filled in', () => {
    expect(sameMetadata({ ...NEXT, modules: ['crm'] }, NEXT)).toBe(false);
    expect(sameMetadata({ ...NEXT, acquisitionCampaign: 'spring' }, NEXT)).toBe(false);
  });

  it('does not treat array ORDER as noise', () => {
    // Module lists are sorted upstream, so a reordering is a real change and
    // sorting it away here would hide one.
    expect(sameMetadata({ ...NEXT, modules: ['crm', 'commerce'] }, NEXT)).toBe(false);
  });

  it('treats an absent or unusable stored value as changed', () => {
    for (const stored of [null, undefined, 'a string', 42, [1, 2]]) {
      expect(sameMetadata(stored, NEXT)).toBe(false);
    }
  });
});
