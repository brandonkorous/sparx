// Universal-search projector registry (docs/39 §5).
//
// Assembled once at module load from every module's projector bundle. The
// event handler dispatches `search.entity.changed` by `entity_type` through
// this map; reindex walks every projector to backfill the `entities`
// collection. Phase 1 ships the Commerce + CRM projectors (both re-exported
// from @sparx/commerce, which the indexer already depends on — no new
// dependency edge). Phase 2 appends CMS / Email / Site Builder bundles here.

import { commerceUniversalProjectors } from '@sparx/commerce';
import { buildRegistry } from '@sparx/search';

export const REGISTRY = buildRegistry([...commerceUniversalProjectors]);
