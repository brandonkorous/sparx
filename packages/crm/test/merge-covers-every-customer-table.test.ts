// The guard on the bug that made this test necessary.
//
// A merge relinked four tables. Thirty-three others carried a `customer_id` and
// were left pointing at the record that had just been retired — including the
// person's orders, their invoices, their bookings and their consent. Nothing
// failed, nothing logged, and the survivor's totals were rolled up from the
// stats at the same moment, so the contact showed "3 orders, $2,400" above an
// empty list.
//
// The failure mode was not that somebody wrote it wrong. It is that the list
// lived in a function nobody revisits, while tables kept being added by people
// who had no reason to know that function existed. So the list is checked
// against the schema instead of against memory: add a table with a customer on
// it and this test fails until somebody decides, in writing, whether a merge
// should move it.
//
// It reads the DMMF rather than the database, so it needs no connection and
// runs in CI with the rest of the unit suite.

import { describe, expect, it } from 'vitest';
import { Prisma } from '@sparx/db';
import { MOVED_MODELS, MERGE_HANDLED_ELSEWHERE } from '../src/services/merge-service';

/** Models with a `customerId`, as Prisma client property names. */
function modelsCarryingACustomer(): string[] {
  return Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'customerId'))
    .map((model) => model.name.charAt(0).toLowerCase() + model.name.slice(1));
}

describe('a merge leaves nothing behind', () => {
  it('has a decision recorded for every table that carries a customer', () => {
    const decided = new Set<string>([...MOVED_MODELS, ...MERGE_HANDLED_ELSEWHERE]);
    const undecided = modelsCarryingACustomer().filter((model) => !decided.has(model));

    // If this fails, add the model to `MOVED_MODELS` (a merge should carry it
    // across) or to `MERGE_HANDLED_ELSEWHERE` if it is dealt with some other way.
    expect(undecided).toEqual([]);
  });

  it('names only models the client actually has, so a typo cannot ship', () => {
    const real = new Set(modelsCarryingACustomer());
    const unknown = [...MOVED_MODELS, ...MERGE_HANDLED_ELSEWHERE].filter(
      (model) => !real.has(model)
    );

    // A name in the list that no longer matches a model would move nothing and
    // say nothing — it has to fail here rather than at merge time.
    expect(unknown).toEqual([]);
  });
});
