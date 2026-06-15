// The raw-class reconciler (docs/builder/04 §2.4 / step 5–6). The Custom CSS card
// edits `node.class` directly; without reconciliation a hand-typed token can
// silently fight a structured control — two `text-*` sizes, a recipe color AND a
// free `text-*` color (eval Finding 10). This module DETECTS those conflicts so
// the hatch can warn inline, and offers an exact-preserving RESOLVE that dedupes
// each managed group while leaving every unrecognized token untouched.
//
// "Preserve unknown must be exact" (docs/builder/04 §5): a token the reconciler
// doesn't recognize as a managed-group member is NEVER dropped — only genuine
// in-group duplicates at the same layer are removed, keeping the first (which is
// the one readClassGroup already treats as active).

import { parseClasses } from '@sparx/builder-schemas';

import {
  ALIGN_CONTENT_CONTROL,
  ALIGN_ITEMS_CONTROL,
  ALIGN_SELF_CONTROL,
  ASPECT_CONTROL,
  BACKDROP_BLUR_CONTROL,
  BACKGROUND_CONTROL,
  BG_POSITION_CONTROL,
  BG_REPEAT_CONTROL,
  BG_SIZE_CONTROL,
  BLUR_CONTROL,
  BORDER_COLOR_CONTROL,
  BORDER_CONTROL,
  BORDER_SIDES,
  BORDER_STYLE_CONTROL,
  BOX_DISPLAY_CONTROL,
  COLOR_CONTROL,
  COLUMNS_CONTROL,
  DIRECTION_CONTROL,
  FLEX_GROW_CONTROL,
  FLEX_SHRINK_CONTROL,
  FLEX_WRAP_CONTROL,
  FONT_FAMILY_CONTROL,
  FONT_SIZE_CONTROL,
  FONT_WEIGHT_CONTROL,
  GAP_CONTROL,
  GRADIENT_DIRECTION_CONTROL,
  GRADIENT_FROM_CONTROL,
  GRADIENT_TO_CONTROL,
  GRADIENT_VIA_CONTROL,
  GRAYSCALE_CONTROL,
  GRID_FLOW_CONTROL,
  GRID_ROWS_CONTROL,
  JUSTIFY_CONTROL,
  JUSTIFY_ITEMS_CONTROL,
  LEADING_CONTROL,
  LINE_CLAMP_CONTROL,
  MIX_BLEND_CONTROL,
  OVERFLOW_CONTROL,
  POSITION_CONTROL,
  RADIUS_CONTROL,
  RADIUS_CORNERS,
  RING_COLOR_CONTROL,
  RING_CONTROL,
  SHADOW_COLOR_CONTROL,
  SHADOW_CONTROL,
  TEXT_ALIGN_CONTROL,
  TEXT_CASE_CONTROL,
  TEXT_COLOR_CONTROL,
  TEXT_DECORATION_CONTROL,
  TRACKING_CONTROL,
  TRANSFORM_ORIGIN_CONTROL,
  TRANSITION_CONTROL,
  VARIANT_CONTROL,
  WHITESPACE_CONTROL,
  WORD_BREAK_CONTROL,
  borderSideControl,
  radiusCornerControl,
  type ClassControl,
} from './class-controls';

// Every structured group whose duplication is a conflict. Each entry is a label
// + its bare token list (the variant prefix is stripped before matching, so the
// SAME group is checked independently per layer — base, hover:, @lg:, …). The
// list intentionally excludes the open-ended VALUE groups (w-, p-, top-, …):
// those are single-token-per-prefix by construction (applyValueGroup), so they
// can't duplicate, and their arbitrary `[…]` values aren't a fixed vocabulary.
const MANAGED: { label: string; tokens: string[] }[] = (
  [
    COLOR_CONTROL,
    VARIANT_CONTROL,
    BOX_DISPLAY_CONTROL,
    POSITION_CONTROL,
    DIRECTION_CONTROL,
    COLUMNS_CONTROL,
    GAP_CONTROL,
    JUSTIFY_CONTROL,
    ALIGN_ITEMS_CONTROL,
    FLEX_WRAP_CONTROL,
    GRID_ROWS_CONTROL,
    GRID_FLOW_CONTROL,
    JUSTIFY_ITEMS_CONTROL,
    ALIGN_CONTENT_CONTROL,
    FLEX_GROW_CONTROL,
    FLEX_SHRINK_CONTROL,
    ALIGN_SELF_CONTROL,
    ASPECT_CONTROL,
    OVERFLOW_CONTROL,
    BACKGROUND_CONTROL,
    GRADIENT_DIRECTION_CONTROL,
    GRADIENT_FROM_CONTROL,
    GRADIENT_VIA_CONTROL,
    GRADIENT_TO_CONTROL,
    BG_SIZE_CONTROL,
    BG_POSITION_CONTROL,
    BG_REPEAT_CONTROL,
    FONT_FAMILY_CONTROL,
    FONT_SIZE_CONTROL,
    FONT_WEIGHT_CONTROL,
    LEADING_CONTROL,
    TEXT_ALIGN_CONTROL,
    TRACKING_CONTROL,
    TEXT_CASE_CONTROL,
    TEXT_COLOR_CONTROL,
    TEXT_DECORATION_CONTROL,
    LINE_CLAMP_CONTROL,
    WHITESPACE_CONTROL,
    WORD_BREAK_CONTROL,
    BORDER_CONTROL,
    BORDER_STYLE_CONTROL,
    BORDER_COLOR_CONTROL,
    RADIUS_CONTROL,
    SHADOW_CONTROL,
    SHADOW_COLOR_CONTROL,
    RING_CONTROL,
    RING_COLOR_CONTROL,
    MIX_BLEND_CONTROL,
    BLUR_CONTROL,
    BACKDROP_BLUR_CONTROL,
    GRAYSCALE_CONTROL,
    TRANSITION_CONTROL,
    TRANSFORM_ORIGIN_CONTROL,
    ...BORDER_SIDES.map((s) => borderSideControl(s.key)),
    ...RADIUS_CORNERS.map((c) => radiusCornerControl(c.key)),
  ] satisfies ClassControl[]
).map((c) => ({ label: c.label, tokens: c.options.map((o) => o.token) }));

// The recipe axes — a free utility color competing with these is the Finding-10
// clash (the recipe themes the component; a raw `text-*`/`bg-*` overrides it).
const RECIPE_COLOR_PREFIX = 'st-c-';
const FREE_TEXT_TOKENS = new Set(TEXT_COLOR_CONTROL.options.map((o) => o.token));
const FREE_BG_TOKENS = new Set(BACKGROUND_CONTROL.options.map((o) => o.token));

/** Strip a leading Tailwind variant chain (`hover:`, `@lg:`, `dark:`, …) and any
 *  trailing `/NN` opacity modifier, yielding the bare utility + its layer prefix.
 *  ':' inside an arbitrary `[…]` value is NOT a variant separator. */
function splitToken(token: string): { prefix: string; base: string } {
  let depth = 0;
  let lastColon = -1;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
    else if (ch === ':' && depth === 0) lastColon = i;
  }
  const prefix = token.slice(0, lastColon + 1);
  let base = token.slice(lastColon + 1);
  // Drop a color-opacity modifier (`text-primary/75` → `text-primary`) so the
  // token still matches its group; the slash only appears outside brackets.
  const slash = base.indexOf('/');
  if (slash !== -1 && !base.includes('[')) base = base.slice(0, slash);
  return { prefix, base };
}

export interface ClassConflict {
  /** Human-readable, shown inline in the Custom CSS card. */
  message: string;
}

/** Detect tokens in a class string that fight a structured control — duplicate
 *  members of one group at the same layer, or a recipe color competing with a
 *  free utility color. Returns [] when the string is clean. */
export function detectClassConflicts(classStr: string | undefined): ClassConflict[] {
  const tokens = parseClasses(classStr);
  const out: ClassConflict[] = [];

  // Duplicate members of a managed group, per layer.
  for (const group of MANAGED) {
    const members = new Set(group.tokens);
    const hitsByLayer = new Map<string, string[]>();
    for (const token of tokens) {
      const { prefix, base } = splitToken(token);
      if (members.has(base)) {
        const list = hitsByLayer.get(prefix) ?? [];
        list.push(token);
        hitsByLayer.set(prefix, list);
      }
    }
    for (const [, hits] of hitsByLayer) {
      if (hits.length > 1) {
        out.push({
          message: `${group.label}: ${hits.join(', ')} both set — only the first applies.`,
        });
      }
    }
  }

  // Recipe color vs a free utility color (Finding 10).
  const hasRecipeColor = tokens.some((t) => splitToken(t).base.startsWith(RECIPE_COLOR_PREFIX));
  const freeColor = tokens.find((t) => {
    const { base } = splitToken(t);
    return FREE_TEXT_TOKENS.has(base) || FREE_BG_TOKENS.has(base);
  });
  if (hasRecipeColor && freeColor) {
    out.push({
      message: `A theme color and a custom color (${freeColor}) are both set — the custom one wins.`,
    });
  }

  return out;
}

/** True when the class string has any structured conflict. */
export function hasClassConflicts(classStr: string | undefined): boolean {
  return detectClassConflicts(classStr).length > 0;
}

/** Resolve duplicate-in-group conflicts by keeping the FIRST member of each
 *  managed group per layer and dropping later ones — the structured controls
 *  already treat the first as active, so this makes the raw string agree with
 *  them. Every unrecognized token is preserved EXACTLY, in order (the recipe-vs-
 *  free-color clash is advisory only — never auto-removed, since which the author
 *  wants is ambiguous). */
export function resolveClassConflicts(classStr: string | undefined): string {
  const tokens = parseClasses(classStr);
  // token → its managed group index (or -1), precomputed once.
  const seen = new Set<string>(); // `${groupIdx}|${prefix}` already kept
  const kept: string[] = [];
  for (const token of tokens) {
    const { prefix, base } = splitToken(token);
    const groupIdx = MANAGED.findIndex((g) => g.tokens.includes(base));
    if (groupIdx === -1) {
      kept.push(token);
      continue;
    }
    const key = `${groupIdx}|${prefix}`;
    if (seen.has(key)) continue; // a later duplicate of an already-kept group/layer
    seen.add(key);
    kept.push(token);
  }
  return kept.join(' ');
}
