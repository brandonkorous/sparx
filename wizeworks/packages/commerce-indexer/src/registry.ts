// Universal-search projector registry (docs/39 §5).
//
// Assembled once at module load from every module's projector bundle. The
// event handler dispatches `search.entity.changed` by `entity_type` through
// this map; reindex walks every projector to backfill the `entities`
// collection. Phase 1 ships the Commerce + CRM projectors (both re-exported
// from @wizeworks/commerce, which the indexer already depends on — no new
// dependency edge). Phase 2 appends CMS / Email / Site Builder bundles here.
//
// The EMAIL bundle is in — campaigns, automatic emails and the rules that fire
// them (`messaging-projection.ts`). It reads Prisma directly, so it needed no
// new dependency either; the header there says why it lives in this package.
//
// The owner-named bundle (persona issue 261) is everything else an owner names on
// a screen of its own: reports, boards, requests, shelves, price lists, services,
// content types and the rest. Same dependency, so no new edge either.

import { commerceUniversalProjectors, ownerNamedUniversalProjectors } from '@wizeworks/commerce';
import { buildRegistry } from '@wizeworks/search';

import { messagingUniversalProjectors } from './messaging-projection.js';

export const REGISTRY = buildRegistry([
  ...commerceUniversalProjectors,
  ...ownerNamedUniversalProjectors,
  ...messagingUniversalProjectors,
]);
