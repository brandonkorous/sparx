// The story's state model + pure reducers. The composer holds ONE `StoryState`; every
// edit (add/remove/swap a clause, start a new sentence) returns a fresh state through
// these helpers. Also derives the module set the story implies and the rendered prose
// we persist. Pure + client-safe — no React, no server import.

import { SWITCHBOARD_MODULES, MODULE_BY_KEY } from '@/lib/modules';
import type { WizardBlueprint } from '../../onboarding/_lib/types';
import {
  CLAUSE,
  ALL_CLAUSE_IDS,
  NARRATIVE_REQ,
  TENSE,
  AUDIENCE,
  INDUSTRY_BY_SLUG,
  type Industry,
  type ClauseVoice,
  type TenseKey,
  type AudienceKey,
} from './clauses';

export interface StoryState {
  tense: TenseKey | null;
  /** Industry slug (one of INDUSTRIES). The load-bearing spine. */
  industry: string | null;
  audience: AudienceKey | null;
  /** Customer clauses → the opening's "…where they can A, B, and C". */
  cust: string[];
  /** Owner sentences, in order → "I'll …" then "I also …". Each is its own line. */
  lines: string[][];
  /** Inline object slots (e.g. dropship → "branded swag"), keyed by clause id. */
  slots: Record<string, string>;
  /** The chosen web handle → `<slug>.sparx.zone`. */
  name: string;
}

export const EMPTY_STORY: StoryState = {
  tense: null,
  industry: null,
  audience: null,
  cust: [],
  lines: [],
  slots: {},
  name: '',
};

/** The narrative as persisted under `settings.onboarding.story` (the api-rest
 *  `StoryNarrative` shape). The composer's live `StoryState` is the editable subset;
 *  `text`/`modules`/`composedAt` are derived records we keep but don't edit. */
export interface PersistedStory {
  tense?: string | null;
  industry?: string | null;
  audience?: string | null;
  name?: string;
  cust?: string[];
  lines?: string[][];
  slots?: Record<string, string>;
}

/** Rebuild the editable `StoryState` from a persisted narrative — so the page can
 *  resume the post-commit tail (e.g. after the Stripe OAuth round-trip reloads it)
 *  with the same prose + plan the owner composed. */
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
  if (s.industry) on.builder = true;
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
function oxford(i: number, n: number): string {
  if (i === 0) return '';
  if (i === n - 1) return n > 2 ? ', and ' : ' and ';
  return ', ';
}
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

/** Pick the starting-point blueprint for the story: the richest catalog blueprint
 *  whose required modules are ALL already enabled (so installing it never silently
 *  bills a module the owner didn't choose), preferring the industry's vertical.
 *  Returns null when nothing is compatible → the commit starts from a blank Builder
 *  site instead. */
export function pickBlueprint(
  industry: Industry | null,
  modules: Record<string, boolean>,
  blueprints: WizardBlueprint[]
): WizardBlueprint | null {
  const wanted = industry?.vertical ?? (modules.commerce || modules.b2b ? 'retail' : 'content');
  const compatible = blueprints.filter((bp) => bp.requiresModules.every((m) => modules[m]));
  if (!compatible.length) return null;
  const score = (bp: WizardBlueprint): number => (bp.vertical === wanted ? 1000 : 0) + richness(bp);
  return [...compatible].sort((a, b) => score(b) - score(a))[0] ?? null;
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
