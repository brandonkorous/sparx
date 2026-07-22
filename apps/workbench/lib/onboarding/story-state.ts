// Pure reducers over the shared story model.
//
// The clause grammar and the `StoryState` model itself live in @sparx/story-schemas
// (a genuine shared package, not dashboard code — the marketing hero renders the
// same model read-only). This file adds the parts that need the workbench's module
// catalog: the module set a story implies, the prose we persist, and the
// starting-point blueprint match. Pure + client-safe: no React, no server import.

import {
  EMPTY_STORY,
  STORY_EXAMPLES,
  connector as oxford,
  CLAUSE,
  ALL_CLAUSE_IDS,
  NARRATIVE_REQ,
  TENSE,
  AUDIENCE,
  INDUSTRY_BY_SLUG,
  type StoryState,
  type Industry,
  type ClauseVoice,
  type TenseKey,
  type AudienceKey,
} from '@sparx/story-schemas';
import { SWITCHBOARD_MODULES, MODULE_BY_KEY, moduleLock } from './modules';
import type { PersistedStory, WizardBlueprint } from './types';

export { EMPTY_STORY };
export type { StoryState };

/** A deep clone so the shared, mutable model never aliases a catalog constant. */
export function cloneStory(s: StoryState): StoryState {
  return { ...s, cust: [...s.cust], lines: s.lines.map((l) => [...l]), slots: { ...s.slots } };
}

/** The default seed for the shared model — the first starter example, keyed to the
 *  tenant's own web handle. Used by BOTH editors so a fresh onboarding opens on the
 *  same inviting story (and the same plan) whether the owner lands on the sentence or
 *  the step-by-step switchboard first. A persisted draft, when present, wins over this. */
export function starterStory(name: string): StoryState {
  return cloneStory({ ...STORY_EXAMPLES[0]!.story, name });
}

/** Every edit the story canvas can make to the model. Lives here (not in the canvas
 *  component) so the shared model hook the gate owns can produce one without a
 *  surfaces→lib import; the canvas and the step-by-step editor both drive this. */
export interface StoryDispatch {
  setTense: (t: StoryState['tense']) => void;
  setIndustry: (slug: string) => void;
  setAudience: (a: AudienceKey) => void;
  addCust: (id: string) => void;
  addToLine: (li: number, id: string) => void;
  addNewLine: (id: string) => void;
  removeClause: (id: string) => void;
  swapClause: (oldId: string, newId: string) => void;
  setSlot: (id: string, v: string) => void;
  setName: (v: string) => void;
}

/** The narrative as persisted under `settings.onboarding.story`, minus the
 *  server-stamped `composedAt`: the composed prose plus the structured selection
 *  that produced it. */
export interface StoryPayload {
  text: string;
  tense: string | null;
  industry: string | null;
  audience: string | null;
  name: string;
  cust: string[];
  lines: string[][];
  slots: Record<string, string>;
  modules: string[];
}

/** Rebuild the editable `StoryState` from a persisted narrative — so the flow can
 *  resume the post-commit tail (e.g. after the Stripe OAuth round-trip reloads it)
 *  OR resume an in-progress compose draft, with the same prose + plan. */
export function storyFromPersisted(p: PersistedStory): StoryState {
  return {
    tense: (p.tense as TenseKey | null) ?? null,
    industry: p.industry ?? null,
    audience: (p.audience as AudienceKey | null) ?? null,
    cust: p.cust ?? [],
    lines: p.lines ?? [],
    slots: p.slots ?? {},
    name: p.name ?? '',
  };
}

/** Build the persist payload from the live editable state. Used for BOTH the final
 *  commit and the debounced draft save — one source of truth so a resumed draft and
 *  the committed narrative are byte-identical. */
export function toPersistPayload(s: StoryState): StoryPayload {
  return {
    text: toProse(s),
    tense: s.tense,
    industry: s.industry,
    audience: s.audience,
    name: s.name,
    cust: s.cust,
    lines: s.lines,
    slots: s.slots,
    modules: enabledModuleKeys(s),
  };
}

// ── derivations ───────────────────────────────────────────────────────────────
export function allClauses(s: StoryState): string[] {
  return [...s.cust, ...s.lines.flat()];
}
export function inStory(s: StoryState, id: string): boolean {
  return s.cust.includes(id) || s.lines.some((l) => l.includes(id));
}
export function clauseVoice(id: string): ClauseVoice {
  return CLAUSE[id]?.place === 'cust' ? 'cust' : 'owner';
}

/** Unused clauses (optionally one voice), suggested-first then catalog order. Every
 *  menu renders this FLAT — no section headers. */
export function flatUnused(s: StoryState, voice?: ClauseVoice): string[] {
  const unused = ALL_CLAUSE_IDS.filter(
    (id) => !inStory(s, id) && (!voice || clauseVoice(id) === voice)
  );
  const suggest = s.industry ? (INDUSTRY_BY_SLUG[s.industry]?.suggest ?? []) : [];
  const sug = suggest.filter((id) => unused.includes(id));
  return [...sug, ...unused.filter((id) => !sug.includes(id))];
}

// ── reducers (immutable) ────────────────────────────────────────────────────────
/** Add a customer clause → the opening's "where they can …" list. */
export function addCust(s: StoryState, id: string): StoryState {
  if (inStory(s, id)) return s;
  return { ...s, cust: [...s.cust, id] };
}

/** Add an owner clause to an existing sentence (extend "I'll A and B"). */
export function addToLine(s: StoryState, li: number, id: string): StoryState {
  if (inStory(s, id) || !s.lines[li]) return s;
  const lines = s.lines.map((l, i) => (i === li ? [...l, id] : l));
  const slots = { ...s.slots };
  if (CLAUSE[id]?.slot && slots[id] == null) slots[id] = '';
  return { ...s, lines, slots };
}

/** Start a NEW sentence: an owner clause becomes its own line; a customer clause
 *  can't be a standalone sentence, so it joins the opening. */
export function addNewLine(s: StoryState, id: string): StoryState {
  if (inStory(s, id)) return s;
  if (clauseVoice(id) === 'cust') return { ...s, cust: [...s.cust, id] };
  const slots = { ...s.slots };
  if (CLAUSE[id]?.slot && slots[id] == null) slots[id] = '';
  return { ...s, lines: [...s.lines, [id]], slots };
}

export function removeClause(s: StoryState, id: string): StoryState {
  const slots = { ...s.slots };
  delete slots[id];
  return {
    ...s,
    cust: s.cust.filter((x) => x !== id),
    lines: s.lines.map((l) => l.filter((x) => x !== id)).filter((l) => l.length > 0),
    slots,
  };
}

/** Replace a clause IN PLACE (keeps its spot). Same voice → swaps within its
 *  sentence; different voice → relocates (opening ↔ a new owner sentence). */
export function swapClause(s: StoryState, oldId: string, newId: string): StoryState {
  if (oldId === newId) return s;
  if (inStory(s, newId)) return removeClause(s, oldId); // target already present — drop the old
  const nv = clauseVoice(newId);
  let cust = s.cust;
  let lines = s.lines;
  const ci = s.cust.indexOf(oldId);
  if (ci !== -1) {
    if (nv === 'cust') {
      cust = s.cust.map((x) => (x === oldId ? newId : x));
    } else {
      cust = s.cust.filter((x) => x !== oldId);
      lines = [...s.lines, [newId]];
    }
  } else {
    lines = s.lines
      .map((line) => {
        const i = line.indexOf(oldId);
        if (i === -1) return line;
        if (nv === 'owner') return line.map((x) => (x === oldId ? newId : x));
        return line.filter((x) => x !== oldId);
      })
      .filter((l) => l.length > 0);
    if (nv === 'cust') cust = [...s.cust, newId];
  }
  const slots = { ...s.slots };
  delete slots[oldId];
  if (CLAUSE[newId]?.slot && slots[newId] == null) slots[newId] = '';
  return { ...s, cust, lines, slots };
}

// ── module resolution (clause mods + builder base + narrative deps) ─────────────
/** The module dict the story implies — over EVERY module slug, true when a clause
 *  names it, Builder when an industry is chosen, plus the narrative-dependency
 *  closure (selling anything pulls Commerce). The API enforces the billing graph
 *  (b2b→commerce) on save; this is the user-intended set we send. */
export function resolveModules(s: StoryState): Record<string, boolean> {
  const on: Record<string, boolean> = {};
  for (const m of SWITCHBOARD_MODULES) on[m.key] = false;
  // Builder is the always-on base — every site in onboarding starts on it (the gate
  // is scoped to the Builder hue for exactly this reason). It's the one module the
  // story can't express as a clause and the step-by-step editor can't switch off, so
  // both editors agree on it unconditionally.
  on.builder = true;
  for (const id of allClauses(s)) {
    const mod = CLAUSE[id]?.mod;
    if (mod) on[mod] = true;
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Object.keys(on)) {
      if (!on[key]) continue;
      for (const dep of NARRATIVE_REQ[key] ?? []) {
        if (!on[dep]) {
          on[dep] = true;
          changed = true;
        }
      }
    }
  }
  return on;
}

export function enabledModuleKeys(s: StoryState): string[] {
  const on = resolveModules(s);
  return SWITCHBOARD_MODULES.filter((m) => on[m.key]).map((m) => m.key);
}

// ── module ⇄ clause bridge (the step-by-step editor over the shared story) ───────
// The story is the single model; the "switch on what you use" editor is a second way
// to populate it. Each toggleable module has ONE representative clause — flipping the
// switch adds that phrase to the sentence (turning the module on) or strips every
// phrase that names the module (turning it off). Builder has no clause (it's the base,
// never switchable here). So a module toggled on in step-by-step simply shows up as a
// phrase when you return to the story, and the plan is identical either way because
// both read `resolveModules` off the same state.
export const MODULE_PRIMARY_CLAUSE: Record<string, string> = {
  commerce: 'shop',
  scheduling: 'book',
  cms: 'blog',
  crm: 'crm',
  email: 'email',
  b2b: 'wholesale',
  ai: 'ai',
  dropship: 'dropship',
  chat: 'chat',
  invoicing: 'invoicing',
  inventory: 'inventory',
};

/** Every clause in the story that names module `key` (all of them, e.g. Commerce owns
 *  order-online + the fulfillment clauses) — the set a toggle-off must strip. */
function clausesNaming(s: StoryState, key: string): string[] {
  return allClauses(s).filter((id) => CLAUSE[id]?.mod === key);
}

/** Toggle a module by editing the shared story: add its representative phrase, or
 *  remove every phrase that names it. Mirrors the dependency graph the switchboard
 *  enforces — a locked row (Builder base, a required or bundled-free module) ignores
 *  the toggle, exactly as `toggleModule` does for the plain-dict editor. */
export function toggleModuleInStory(s: StoryState, key: string): StoryState {
  if (key === 'builder') return s; // the always-on base — nothing to toggle
  const on = resolveModules(s);
  if (moduleLock(on, key) !== null) return s; // required/included — locked, ignore
  if (on[key]) {
    // Turn off: strip every clause that names this module.
    return clausesNaming(s, key).reduce((acc, id) => removeClause(acc, id), s);
  }
  // Turn on: add its representative phrase (voice-routed by addNewLine).
  const clause = MODULE_PRIMARY_CLAUSE[key];
  return clause ? addNewLine(s, clause) : s;
}

/** A clause directly names module `m` (or it's the Builder base). */
export function directlyNamed(s: StoryState, m: string): boolean {
  return m === 'builder' || allClauses(s).some((id) => CLAUSE[id]?.mod === m);
}

/** If module `m` is on only because a clause's module pulled it in (narrative dep),
 *  the display name of that puller — for the panel's "· comes with X" caption. */
export function pulledBy(s: StoryState, m: string): string | null {
  const namer = allClauses(s).find((id) => {
    const mod = CLAUSE[id]?.mod;
    return mod ? (NARRATIVE_REQ[mod] ?? []).includes(m) : false;
  });
  const mod = namer ? CLAUSE[namer]?.mod : undefined;
  if (!mod) return null;
  return MODULE_BY_KEY[mod]?.name ?? mod;
}

/** Active commerce fulfillment methods (ship is the default once Commerce is on). */
export function fulfillment(s: StoryState): Set<string> {
  const set = new Set<string>();
  for (const id of allClauses(s)) {
    const cfg = CLAUSE[id]?.cfg;
    if (cfg) set.add(cfg);
  }
  if (resolveModules(s).commerce && !set.has('pickup') && !set.has('delivery')) set.add('ship');
  return set;
}

// ── prose (what we persist as story.text) ───────────────────────────────────────
function phrase(id: string, slots: Record<string, string>): string {
  const cl = CLAUSE[id];
  if (!cl) return id;
  const base = cl.cust ?? cl.owner ?? id;
  if (cl.slot) {
    const filled = slots[id];
    return `${base} ${filled && filled.length > 0 ? filled : cl.slot}`;
  }
  return base;
}
function joinClauses(ids: string[], slots: Record<string, string>): string {
  return ids.map((id, i) => `${oxford(i, ids.length)}${phrase(id, slots)}`).join('');
}

/** Slugify a typed handle into the `.sparx.zone` subdomain form. */
export function handleSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || ''
  );
}

// ── starting-point blueprint match ──────────────────────────────────────────────
function richness(bp: WizardBlueprint): number {
  const c = bp.contents;
  return c.products + c.pages + c.content + c.emails + c.collections + c.categories;
}

/** Pick the starting-point blueprint for the story: among candidates whose required
 *  modules are ALL already enabled (so installing one never silently bills a module
 *  the owner didn't choose), prefer a vertical match; break a tie toward the LEAST
 *  content-rich (obviously-generic beats detailed-and-wrong for an owner who won't
 *  proofread every seeded page), then alphabetically by key. Returns null when
 *  nothing is compatible → the commit starts from a blank Builder site. */
export function pickBlueprint(
  industry: Industry | null,
  modules: Record<string, boolean>,
  blueprints: WizardBlueprint[]
): WizardBlueprint | null {
  const wanted = industry?.vertical ?? (modules.commerce || modules.b2b ? 'retail' : 'content');
  const compatible = blueprints.filter((bp) => bp.requiresModules.every((m) => modules[m]));
  if (!compatible.length) return null;
  return (
    [...compatible].sort((a, b) => {
      const aMatch = a.vertical === wanted ? 1 : 0;
      const bMatch = b.vertical === wanted ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      if (richness(a) !== richness(b)) return richness(a) - richness(b);
      return a.key.localeCompare(b.key);
    })[0] ?? null
  );
}

/** Render the story as plain prose — the human-readable record we persist. */
export function toProse(s: StoryState): string {
  if (!s.tense || !s.industry || !s.audience) return '';
  const ind = INDUSTRY_BY_SLUG[s.industry];
  const noun = ind?.noun ?? 'a business';
  let out = `I ${TENSE[s.tense].verb} ${noun} for ${AUDIENCE[s.audience].label}`;
  if (s.cust.length) out += `, where they can ${joinClauses(s.cust, s.slots)}`;
  out += '.';
  s.lines.forEach((line, li) => {
    out += `${li === 0 ? ' I’ll ' : ' I also '}${joinClauses(line, s.slots)}.`;
  });
  out += ` Find me at ${handleSlug(s.name) || 'your-name'}.sparx.zone.`;
  return out;
}
