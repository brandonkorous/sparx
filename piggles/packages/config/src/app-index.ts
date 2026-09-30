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

/** Module key → color group, for anything reaching for a hue directly.
 *  Mirrors the `[data-module=…]` bridge in `@piggles/brand`'s theme.css. */
export const MODULE_GROUP: Record<ModuleKey, PigglesGroup> = Object.fromEntries(
  APPS.flatMap((a) => a.modules.map((m) => [m, a.group]))
);

/** The apps in a group, in nav order. */
export const appsInGroup = (group: PigglesGroup): PigglesAppDef[] =>
  APPS.filter((a) => a.group === group).sort((x, y) => x.navOrder - y.navOrder);

/**
 * How many apps there are, and the word for it.
 *
 * THE MARKETING SITE SAID "fifteen" IN 42 PLACES AND THERE WERE SIXTEEN. Both
 * were written in the same commit, so the number was never right: the /apps
 * page headed itself "Fifteen apps. One subscription." over a grid of sixteen
 * tiles a visitor could count, and the Terms said "every one of the fifteen
 * apps" as a term of the subscription.
 *
 * The number belongs to the registry, so it is taken from the registry. A
 * spelled count typed into a sentence is a copy of a fact that lives somewhere
 * else, and it goes stale the first time somebody adds an app without grepping
 * for the word. `check:app-count` fails the build if one is typed again.
 * [[feedback_never_present_absence_as_measurement]]
 *
 * SPELLED, because these appear mid-sentence in marketing copy where a numeral
 * reads as a price or a version. `pricing/page.tsx` says so in its own comment:
 * mixed numerals in one passage read as an error.
 */
export const APP_COUNT: number = APPS.length;

const COUNT_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

/**
 * A small number as the word for it, falling back to the numeral past twenty
 * rather than inventing a word, because a wrong word is worse than a digit.
 *
 * Shared because a private copy of this list is how the count goes wrong twice:
 * `answer-receipt.tsx` kept one that stopped at `'fifteen'`, so the moment a
 * sixteenth app existed its "N, waiting" row printed a NUMERAL on a page that
 * spells every other number on purpose.
 */
export const numberWord = (n: number): string => COUNT_WORDS[n] ?? String(n);

/** "sixteen". */
export const APP_COUNT_WORD: string = numberWord(APP_COUNT);

/** "Sixteen", for the start of a sentence or a heading. */
export const APP_COUNT_WORD_CAP: string =
  APP_COUNT_WORD.charAt(0).toUpperCase() + APP_COUNT_WORD.slice(1);

/**
 * "fifteen" — every app EXCEPT the one being talked about.
 *
 * `/apps/[app]` closes twice with "So are the other fourteen", which is the
 * total minus one and was typed by hand off a total that was itself wrong. Two
 * hand-derived numbers in one sentence is two chances to be stale, and this one
 * was wrong by two.
 */
export const OTHER_APPS_WORD: string = numberWord(Math.max(APP_COUNT - 1, 0));

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
