// Lookups derived from the app registry. Derived rather than hand-kept, so a
// mapping can never end up written in one direction and not the other.

import type { PigglesGroup } from '@piggles/brand';
import { APPS, type ModuleKey, type PigglesAppDef } from './apps';

export type PigglesAppId = (typeof APPS)[number]['id'];

/** Lookup by id. */
export const APP_BY_ID: Record<string, PigglesAppDef> = Object.fromEntries(
  APPS.map((a) => [a.id, a])
);

/** Which group an app belongs to. The canonical statement of this mapping —
 *  `@piggles/brand`'s theme.css restates it in CSS only because a stylesheet
 *  cannot import TypeScript. */
export const APP_GROUP: Record<string, PigglesGroup> = Object.fromEntries(
  APPS.map((a) => [a.id, a.group])
);

/** Module key → the Piggles app that fronts it. The bridge for SHARED surfaces:
 *  they speak sparx's vocabulary (`commerce`, `crm`), and this answers "what
 *  does Piggles call the place this belongs". */
export const MODULE_TO_APP: Record<ModuleKey, string> = Object.fromEntries(
  APPS.flatMap((a) => a.modules.map((m) => [m, a.id]))
);

/** Module key → colour group, for anything reaching for a hue directly.
 *  Mirrors the `[data-module=…]` bridge in `@piggles/brand`'s theme.css. */
export const MODULE_GROUP: Record<ModuleKey, PigglesGroup> = Object.fromEntries(
  APPS.flatMap((a) => a.modules.map((m) => [m, a.group]))
);

/** The apps in a group, in nav order. */
export const appsInGroup = (group: PigglesGroup): PigglesAppDef[] =>
  APPS.filter((a) => a.group === group).sort((x, y) => x.navOrder - y.navOrder);

/** The rail a brand-new business sees. Onboarding narrows this further by asking
 *  what the business actually does — it HIDES, it never gates, and every app
 *  stays reachable from the launcher regardless. */
export const defaultRail = (): PigglesAppDef[] =>
  APPS.filter((a) => a.defaultEnabled).sort((x, y) => x.navOrder - y.navOrder);

// There is deliberately NO `modulesForGroups` here any more.
//
// It mapped onboarding's "what do you do?" answer to the modules to activate,
// and that mapping was the bug: a module left off returns 404 and stores no
// rows, so the groups somebody did not tick became locked doors on a screen
// promising "everything is included either way". Onboarding now activates
// ALL_MODULES for every business (RULE #2) and the groups decide only what
// starts on the rail. Reintroducing a groups→modules function is reintroducing
// the gate.
