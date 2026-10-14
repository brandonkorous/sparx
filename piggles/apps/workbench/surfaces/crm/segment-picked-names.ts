'use client';

// The names behind the values a segment rule PICKS: team members, wholesale
// customers and wholesale groups, which the rule stores by id. The builder lists them
// in its pickers; the Segments list reads a saved rule back in words with them
// (sparx persona issue 149).
//
// A kind is left OUT until its whole list is in hand. The summary then says "a
// chosen group" rather than "a group since removed": a page that stopped at 100 rows is
// not proof that the 101st was deleted.

import { useMemo } from 'react';
import { useTeamRoster } from '../../lib/api/team';
import { useTiers } from '../b2b/pricing-tiers-data';
import { useAccounts } from './companies-data';
import type { PickedNames } from './segment-summary';

/** Every list a segment rule picks from. A shop does not run 100 wholesale groups, and
 *  the account picker reads the same first 100 accounts it always has. */
const TAKE = 100;

export function usePickedNames(): PickedNames {
  const roster = useTeamRoster();
  const { data: accounts } = useAccounts();
  const { data: tiers } = useTiers({ take: TAKE, skip: 0 });

  return useMemo(() => {
    const names: PickedNames = {};
    if (roster.ready && !roster.isError) {
      names.rep = Object.fromEntries(roster.members.map((m) => [m.userId, m.name ?? m.email]));
    }
    if (accounts && (accounts.total ?? accounts.items.length) <= accounts.items.length) {
      names.account = Object.fromEntries(accounts.items.map((a) => [a.id, a.companyName]));
    }
    if (tiers && (tiers.total ?? tiers.items.length) <= tiers.items.length) {
      names.tier = Object.fromEntries(tiers.items.map((t) => [t.id, t.name]));
    }
    return names;
  }, [roster.ready, roster.isError, roster.members, accounts, tiers]);
}
