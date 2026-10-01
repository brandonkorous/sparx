// Search headings in Piggles' words (issue 914).
//
// An entry keyed by an entity type nothing routes would do nothing at all, and a
// heading that does nothing looks exactly like one that was never needed. So
// every key has to be a real kind of record the search box can show.
// [[feedback_absent_behaves_like_fine]]

import { ROUTES } from '@wizeworks/links';
import { describe, expect, it } from 'vitest';
import { PIGGLES_ENTITY_LABELS, PIGGLES_SURFACES } from './vocabulary';

const routed = new Map(
  ROUTES.filter((route) => route.entity).map((route) => [route.entity, route])
);

describe('PIGGLES_ENTITY_LABELS', () => {
  it('only names kinds of record the search box can show', () => {
    const unknown = Object.keys(PIGGLES_ENTITY_LABELS).filter((key) => !routed.has(key));
    expect(unknown).toEqual([]);
  });

  it('only exists where it says something the platform heading does not', () => {
    const same = Object.entries(PIGGLES_ENTITY_LABELS)
      .filter(([key, label]) => routed.get(key)?.entityLabel === label)
      .map(([key]) => key);
    expect(same).toEqual([]);
  });

  it('calls a group of customers what its own screen calls it', () => {
    expect(PIGGLES_ENTITY_LABELS.segment).toBe(PIGGLES_SURFACES['crm.segments.list']);
    expect(PIGGLES_ENTITY_LABELS.ticket).toBe(PIGGLES_SURFACES['crm.tickets.list']);
    expect(PIGGLES_ENTITY_LABELS.subscription).toBe(
      PIGGLES_SURFACES['commerce.subscriptions.list']
    );
  });
});
