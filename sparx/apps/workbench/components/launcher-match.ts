// What the launcher considers a match, and how strongly.
//
// Split out of launcher.tsx so the ranking can be read and reasoned about on its
// own: it is the part that decides whether the fastest route in the product
// answers what somebody typed, and it was the part nobody could see.

import type { LucideIcon } from 'lucide-react';
import type { OpenTarget } from '../lib/surfaces/registry';
import { moduleLabel } from '../lib/surfaces/nav';
import { bestOverForms } from './word-forms';
import type { WorkbenchModule } from './module-scope';

/** One selectable row — a surface to open, a record to open, or an action. */
export interface Entry {
  id: string;
  group: string;
  label: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Terms the local filter matches surfaces on. Records are pre-filtered by the server. */
  keywords?: string[];
  /** Whose module this belongs to, so the row's glyph can wear that module's hue. */
  module?: WorkbenchModule;
  run: (mods: { shiftKey?: boolean; altKey?: boolean }) => void;
}

/**
 * The heading a surface sits under in the palette.
 *
 * This used to title-case the module KEY, which produced "Crm", "B2b" and "Seo"
 * — the raw slug with a capital letter, in the one place the app is supposed to
 * be findable by someone who does not know what anything is called. It now asks
 * the same function the rail and the navigation panel ask, so all three agree
 * and a brand that renames a module renames it everywhere at once
 * (lib/product.ts).
 */
export function groupLabel(module: string): string {
  return moduleLabel(module);
}

/** The modifier held at selection decides where the pane lands. */
export function targetFor(mods: { shiftKey?: boolean; altKey?: boolean }): OpenTarget {
  return mods.altKey ? 'window' : mods.shiftKey ? 'beside' : 'tab';
}

/**
 * Whether `needle` starts a word inside `haystack` — "orders" matches "Customer
 * orders" but not "reorders".
 *
 * Hand-rolled rather than a regex because the needle is whatever somebody typed:
 * a query containing `(` or `*` would either throw or quietly mean something
 * else. Both strings arrive lowercased.
 */
export function startsAWord(haystack: string, needle: string): boolean {
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    const before = at === 0 ? '' : haystack.charAt(at - 1);
    if (before === '' || !/[a-z0-9]/.test(before)) return true;
    at = haystack.indexOf(needle, at + 1);
  }
  return false;
}

/**
 * How well one row answers a single word. 0 means it does not.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The filter used to be a single `includes` across the label, the GROUP and the
 * keywords, with the results left in registry order. Typing "customers" matched
 * every screen in the CRM module — because they all carry "Customers" as their
 * group — and the one row actually called Customers came out THIRD, under
 * "How this app behaves" and "Booking links". The launcher is the fastest route
 * in the product and typing a screen's name did not put that screen first.
 *
 * The ladder is what a person means, strongest first: the exact name, then a
 * name starting with it, then a name containing it as a word, then the words we
 * TAGGED it with, then anywhere in the name at all, and last the module it lives
 * in — a group match alone is the weakest possible evidence and must never
 * outrank a real name.
 *
 * Tagged words outrank a bare mid-name substring, and that order is deliberate:
 * typing "sale" used to return five Wholesale screens above Orders, because
 * "sale" sits inside "wholesale" by accident while Orders carries it on purpose.
 * A word we chose is evidence; a word that happens to be inside another one is
 * a coincidence, and a coincidence should not win.
 *
 * Every rung is tried against each spelling of the word — "shelf" reaches
 * Shelves, "categories" reaches Category — and the best rung any spelling earns
 * is the row's rank. A singular and its plural are the same word, so neither is
 * demoted for being the one that was not typed. See word-forms.ts.
 */
export function score(entry: Entry, query: string): number {
  return bestOverForms(query, (form) => rate(entry, form));
}

/**
 * A name, lowercased, with a dash or an underscore read as a space. "sign-off"
 * and "sign off" are the same word to whoever typed it: the task reads "waiting
 * for your sign-off", the screen was tagged "sign off", and typing the task's
 * own word found nothing (sparx persona issue 086). Both sides go through this,
 * so an order number such as "O-000012" still matches itself.
 */
export function plain(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-_‐-―]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One rung-by-rung reading of a row against one exact spelling. */
function rate(entry: Entry, typed: string): number {
  const query = plain(typed);
  if (!query) return 0;
  const label = plain(entry.label);
  if (label === query) return 100;
  if (label.startsWith(query)) return 80;
  if (startsAWord(label, query)) return 60;
  const keywords = (entry.keywords ?? []).map(plain);
  if (keywords.some((keyword) => keyword.startsWith(query))) return 45;
  if (keywords.some((keyword) => startsAWord(keyword, query))) return 35;
  if (label.includes(query)) return 30;
  if (keywords.some((keyword) => keyword.includes(query))) return 20;
  if (plain(entry.group).includes(query)) return 10;
  return 0;
}

/** Words of one or two letters are not evidence of anything, so a phrase drops
 *  them rather than requiring them — "take a payment" is asking about taking and
 *  about payment. Unless that is the whole query, in which case it is the ask. */
function meaningfulWords(query: string): string[] {
  const words = query.split(/\s+/).filter(Boolean);
  // Short words are filler ("a", "of", "to") unless they hold a digit: "31" in
  // "Units 31" is the point of the search. Dropped, the Units screen matched
  // "Units 31" on one word and sat above the task that matched both (sparx
  // persona issue 091).
  const long = words.filter((word) => word.length > 2 || /\d/.test(word));
  const kept = long.length ? long : words;
  // "new discount", "add a supplier", "create invoice": the verb is what they want
  // to DO, and the noun is where it is done. Requiring the verb as a word found
  // nothing at all for "new discount" (sparx persona issue 036), because no screen
  // is called "new". Dropped only when a noun is left to search for.
  const nouns = kept.filter((word) => !INTENT_VERBS.has(word));
  return nouns.length ? nouns : kept;
}

/** Words that say "make one" rather than naming a thing. */
const INTENT_VERBS = new Set(['new', 'add', 'create', 'make', 'start']);

/**
 * How well one row answers everything that was typed.
 *
 * The whole phrase first, exactly as before. When that finds nothing, every
 * meaningful word must match on its own and the row ranks by its WEAKEST word —
 * so "take a payment" reaches "How you take payment", which it could not before,
 * because the box scored the query as one literal string and the word "a" is not
 * in the title. A box that asks what you want to DO has to take a phrase; this
 * one invited the phrasing and then rejected it.
 *
 * Single-word queries behave exactly as they always have: there is nothing to
 * split, so the fallback never runs.
 */
export function scoreQuery(entry: Entry, query: string): number {
  const rank = matchQuery(entry, query);
  // "new social post" asks to MAKE one, so the row that makes one leads its group
  // instead of sitting under the list it belongs to (sparx persona issue 036).
  return rank > 0 && entry.id.startsWith('create:') && asksToMake(query) ? rank + 5 : rank;
}

function asksToMake(query: string): boolean {
  return query.split(/\s+/).some((word) => INTENT_VERBS.has(word));
}

function matchQuery(entry: Entry, query: string): number {
  const whole = score(entry, query);
  // A row that answers the whole PHRASE outranks one that only matches its words
  // one at a time, at the same rung: "import products" is a thing Move in was
  // tagged with, while the supplier list only happens to hold both words, and the
  // tie went to whichever was registered first (sparx persona issue 052).
  if (whole > 0) return /\s/.test(query.trim()) ? whole + 2 : whole;
  const words = meaningfulWords(query);
  // One word left after dropping a verb ("new discount") still has to be tried;
  // a one-word query re-scores to the same answer as the whole, so this is safe.
  if (words.length === 0) return 0;
  let weakest = Number.POSITIVE_INFINITY;
  for (const word of words) {
    const each = score(entry, word);
    if (each === 0) return 0;
    weakest = Math.min(weakest, each);
  }
  return weakest;
}

/**
 * How well one RECORD answers a single word.
 *
 * Records do not go through `score` and must not: that ladder rates a surface,
 * where a GROUP match is weak evidence worth keeping ("typing customers should
 * reach the Customers app"). On a record the group is the entity's own name, so
 * "orders" would score every order in the shop equally and say nothing.
 *
 * What matters here is the row's own NAME, then the line under it — a customer's
 * email, an order's buyer — and nothing else. A row the ladder cannot score at
 * all returns 0 and keeps its place in the SERVER's order, because the server
 * matched it for a reason the client cannot see.
 */
function recordWordRank(entry: Entry, typed: string): number {
  const query = plain(typed);
  if (!query) return 0;
  const label = plain(entry.label);
  if (label === query) return 100;
  if (label.startsWith(query)) return 80;
  if (startsAWord(label, query)) return 60;
  if (label.includes(query)) return 40;
  const subtitle = plain(entry.subtitle ?? '');
  if (subtitle.startsWith(query)) return 30;
  if (startsAWord(subtitle, query)) return 25;
  if (subtitle.includes(query)) return 15;
  return 0;
}

/** The record ladder against everything typed, with the same weakest-word rule
 *  `scoreQuery` uses for surfaces so a phrase behaves the same in both halves. */
export function recordRank(entry: Entry, query: string): number {
  const whole = recordWordRank(entry, query);
  if (whole > 0) return whole;
  const words = meaningfulWords(query);
  // One word left after dropping a verb ("new discount") still has to be tried;
  // a one-word query re-scores to the same answer as the whole, so this is safe.
  if (words.length === 0) return 0;
  let weakest = Number.POSITIVE_INFINITY;
  for (const word of words) {
    const each = recordWordRank(entry, word);
    if (each === 0) return 0;
    weakest = Math.min(weakest, each);
  }
  return weakest;
}

/**
 * Records, re-ranked against what was actually typed.
 *
 * Record hits arrive in the SEARCH SERVER's order, across several collections at
 * once, and its relevance is typo-tolerant by design. That is right for FINDING
 * things and wrong for deciding what Enter opens, because the highlight starts on
 * the first row and Enter is the contract the panel prints along its own foot.
 *
 * Two measurements, both from typing a customer's name:
 *
 *   "Priya"      → Privacy Policy first (two edits away), then a segment, and the
 *                  three customers actually called Priya below both.
 *   "Marguerite" → the text of a review first, and Marguerite herself second.
 *
 * Both times Enter opened something the person had not asked for. So a literal
 * match on the row's own name wins, then one on the line under it, then
 * everything else in the server's own order. `sort` is stable, so rows the client
 * cannot tell apart never shuffle between keystrokes.
 *
 * Nothing is FILTERED OUT. Typo tolerance is why "Privacy Policy" is a useful
 * answer to a mistyped "privacy", and dropping it would trade one wrong result
 * for one missing one.
 */
export function rankRecords(entries: Entry[], query: string): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries
    .map((entry, index) => ({ entry, index, rank: recordRank(entry, q) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((row) => row.entry);
}

/**
 * The matching rows, best first, with each module's screens kept together.
 *
 * Groups are ranked by their BEST member, then members within a group by their
 * own rank. Sorting on member rank alone would scatter one module's screens
 * through the list — and because the render re-collects rows into group buckets
 * while the keyboard walks the flat array, a scattered group would make ↓ jump
 * around the screen. Contiguous groups keep the two in step. `sort` is stable,
 * so equal ranks stay in registry order.
 */
export function rankEntries(entries: Entry[], query: string): Entry[] {
  // Word by word is the fallback for a phrase NOTHING answers whole, and only
  // that. Run beside whole-phrase matches it lets one leftover word bring in
  // every screen it happens to start: "set up" drops "up" as filler, "set"
  // starts "settings", and a business three minutes old typed "set up" and got
  // fifteen settings screens above Get set up (Piggles persona issue 935). A screen
  // whose name holds the whole phrase is the answer; the rest is a coincidence.
  const whole = /\s/.test(query.trim()) && entries.some((entry) => score(entry, query) > 0);
  const scored = entries
    .map((entry) => ({
      entry,
      rank: whole && score(entry, query) === 0 ? 0 : scoreQuery(entry, query),
    }))
    .filter((row) => row.rank > 0);

  const best = new Map<string, number>();
  for (const { entry, rank } of scored) {
    best.set(entry.group, Math.max(best.get(entry.group) ?? 0, rank));
  }
  scored.sort(
    (a, b) => (best.get(b.entry.group) ?? 0) - (best.get(a.entry.group) ?? 0) || b.rank - a.rank
  );
  return scored.map((row) => row.entry);
}
