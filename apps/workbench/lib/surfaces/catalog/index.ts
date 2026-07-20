// The catalog — every surface the workbench can open.
//
// Importing this module is what populates the registry, so it must be imported
// once before the dock mounts (see components/workbench-shell.tsx). Registration
// is a side effect of import on purpose: it means adding a surface is a single
// entry in one module file and nothing else — no separate nav config, no route
// file, no per-module wiring to keep in sync.
//
// The navigation panel and the ⌘K launcher are both DERIVED from this list, so a
// surface cannot exist and be unreachable. Contrast the dashboard, where the same
// change spans three hand-synced registries that typecheck green when they
// disagree.
//
// One file per module. Order below is the order modules appear in the rail,
// since buildNav() preserves first-registration order — so this array is also
// the rail's running order, and the only place it is decided.
//
// Surfaces whose screens are not built yet are declared with `stub()` (see
// ./stub.ts) rather than omitted. A registered stub gives the module its real
// navigation now and swaps to the finished screen later without changing its
// key, so saved layouts and deep links survive.

import { registerSurfaces } from '../registry';
import { PLATFORM_SURFACES } from './platform';
import { INVOICING_SURFACES } from './invoicing';
import { COMMERCE_SURFACES } from './commerce';
import { CRM_SURFACES } from './crm';
import { B2B_SURFACES } from './b2b';
import { INVENTORY_SURFACES } from './inventory';
import { BUILDER_SURFACES } from './builder';
import { CMS_SURFACES } from './cms';
import { EMAIL_SURFACES } from './email';
import { SCHEDULING_SURFACES } from './scheduling';
import { FINANCE_SURFACES } from './finance';
import { SMALL_MODULE_SURFACES } from './small-modules';
import { PARTNER_SURFACES } from './partner';

registerSurfaces([
  ...PLATFORM_SURFACES,
  ...INVOICING_SURFACES,
  ...COMMERCE_SURFACES,
  ...CRM_SURFACES,
  ...B2B_SURFACES,
  ...INVENTORY_SURFACES,
  ...BUILDER_SURFACES,
  ...CMS_SURFACES,
  ...EMAIL_SURFACES,
  ...SCHEDULING_SURFACES,
  ...FINANCE_SURFACES,
  ...SMALL_MODULE_SURFACES,
  // Last on purpose: a partner is a different KIND of user, so its module sits
  // below the ones that describe the business itself.
  ...PARTNER_SURFACES,
]);
