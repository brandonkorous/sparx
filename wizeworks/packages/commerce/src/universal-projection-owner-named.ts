// Every kind of thing an owner names on a screen of its own and could not find by
// that name until persona issue 261, as one list for the indexer's registry.
//
// A new projector file joins this list AND `PROJECTOR_FILES` in
// `scripts/check-search-entities.mjs`; the check cannot see a file it is not told about.

import type { EntityProjector } from '@wizeworks/search';

import { crmOwnerNamedProjectors } from './universal-projection-crm';
import { sellingOwnerNamedProjectors } from './universal-projection-selling';
import { setupOwnerNamedProjectors } from './universal-projection-setup';
import { stockOwnerNamedProjectors } from './universal-projection-stock';

export const ownerNamedUniversalProjectors: EntityProjector[] = [
  ...crmOwnerNamedProjectors,
  ...stockOwnerNamedProjectors,
  ...sellingOwnerNamedProjectors,
  ...setupOwnerNamedProjectors,
];
