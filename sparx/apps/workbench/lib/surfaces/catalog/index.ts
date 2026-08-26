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
// One file per module. The order below no longer decides the rail — that is
// authored explicitly in MODULE_ORDER in ../nav.ts, because a module claims its
// rail slot at its first LISTED surface and the cross-module product panels in
// commerce.ts would otherwise drag Inventory/Dropshipping/Content out of place.
// This array now only controls import/registration order (and so the stable
// tiebreak for any module not listed in MODULE_ORDER).
//
// Surfaces whose screens are not built yet are declared with `stub()` (see
// ./stub.ts) rather than omitted. A registered stub gives the module its real
// navigation now and swaps to the finished screen later without changing its
// key, so saved layouts and deep links survive.

import { registerSurfaces } from '../registry';
import { PLATFORM_SURFACES } from './platform';
import { ANALYTICS_SURFACES } from './analytics';
import { INVOICING_SURFACES } from './invoicing';
import { COMMERCE_SURFACES } from './commerce';
import { CRM_SURFACES } from './crm';
import { B2B_SURFACES } from './b2b';
import { INVENTORY_SURFACES } from './inventory';
import { BUILDER_SURFACES } from './builder';
import { CMS_SURFACES } from './cms';
import { EMAIL_SURFACES } from './email';
import { SCHEDULING_SURFACES } from './scheduling';
import { SOCIAL_SURFACES } from './social';
import { FUNNEL_SURFACES } from './funnels';
import { FINANCE_SURFACES } from './finance';
import { STAFF_SURFACES } from './staff';
import { DROPSHIP_SURFACES } from './dropship';
import { AUTOMATION_SURFACES } from './automations';
import { SMALL_MODULE_SURFACES } from './small-modules';
import { PARTNER_SURFACES } from './partner';
import { ONBOARDING_SURFACES } from './onboarding';

registerSurfaces([
  ...PLATFORM_SURFACES,
  // Setup flows + the welcome checklist as REOPENABLE surfaces. First-run
  // onboarding is a full-viewport gate (see workbench-shell), not these — these
  // let an operator come back to setup afterward.
  ...ONBOARDING_SURFACES,
  // Cross-module dashboards — a platform-level landing, like Pulse.
  ...ANALYTICS_SURFACES,
  ...INVOICING_SURFACES,
  ...COMMERCE_SURFACES,
  ...CRM_SURFACES,
  ...B2B_SURFACES,
  ...INVENTORY_SURFACES,
  ...BUILDER_SURFACES,
  ...CMS_SURFACES,
  ...EMAIL_SURFACES,
  ...SCHEDULING_SURFACES,
  ...SOCIAL_SURFACES,
  // Campaigns — after the surfaces that CARRY a campaign (the site, the email,
  // the posts) and before the money, which is where its result shows up.
  ...FUNNEL_SURFACES,
  ...FINANCE_SURFACES,
  // Your team — immediately after finance, because that is the relationship:
  // staff is where the biggest number in the ledger comes from.
  ...STAFF_SURFACES,
  // Dropshipping — its own module block (suppliers, catalog, orders, profit).
  ...DROPSHIP_SURFACES,
  // Automations — the cross-module rule engine (rules, runs, reporting).
  ...AUTOMATION_SURFACES,
  ...SMALL_MODULE_SURFACES,
  // Last on purpose: a partner is a different KIND of user, so its module sits
  // below the ones that describe the business itself.
  ...PARTNER_SURFACES,
]);
