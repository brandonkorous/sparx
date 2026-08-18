// Catches the utility classes that compile to NOTHING, at authoring time.
//
// THE FAILURE THIS EXISTS FOR. Both apps build their CSS by @source-scanning this
// package's source plus silicaui's dist, with `builder-vocabulary.css` declaring the
// extra families on top. A class in a repo composite is therefore always covered — it
// gets scanned. A class in an AUTHORED tree is not: those live in the database, no
// scanner ever sees them, and anything outside the declared vocabulary emits no CSS.
//
// No error, no warning, no failed build. Three real examples, all shipped and all found
// by eye afterwards:
//   · `gap-7`         — the scale skips odd steps above 6, so a CTA stack collapsed to
//                       zero spacing.
//   · `lg:row-start-1` — absent entirely at the time, so mirrored two-column rows
//                       silently stacked.
//   · `leading-[1.05]` — an arbitrary value; display type fell back to body leading.
//
// WHAT IT CHECKS, and why it is not "must be in the safelist". Most valid classes are
// covered by the SCAN rather than the declared list (`flex`, `w-full`, `rounded-box`,
// `btn-primary`, `aspect-video`), so rejecting anything unlisted would be almost all
// false positives. Instead it flags the two cases that genuinely cannot work:
//
//   1. ARBITRARY VALUES (`leading-[1.05]`, `w-[37px]`). Tailwind generates these only
//      where it SEES them, so in an authored tree they never compile. No exceptions.
//   2. OUT-OF-RANGE STEPS on a family the vocabulary declares (`gap-7` when the
//      declared gap scale is 0-6,8,10,…). The family is declared, so the intent is
//      unambiguous and the specific value is provably missing.
//   3. VIEWPORT VARIANTS (`md:grid-cols-3`). The odd one out: this class DOES compile
//      and DOES work on the published page. It is flagged because it is invisible in
//      the tool that authors it — silica's device toggle sets an element's width, not
//      the window's, so a viewport variant is frozen at whatever the real browser
//      window happens to be. The author switches to Mobile, sees no change, and
//      concludes the layout is fine. One vocabulary, container queries, is the fix;
//      `builder-vocabulary.css` carries the full reasoning and the step mapping.
//
// Anything else passes: unknown families are assumed scan-covered rather than guessed
// at, because a false positive that blocks a legitimate authoring call is worse than a
// miss here — this is a guard rail, not a whitelist.

import type { ClassValidator } from '@wizeworks/silicaui-html';

import { VOCABULARY_PATTERNS } from './vocabulary-patterns';

/** One unusable class found in an authored tree. */
export interface VocabularyIssue {
  /** The offending class, verbatim. */
  className: string;
  reason: 'arbitrary-value' | 'out-of-range' | 'viewport-variant';
  /** What to write instead — a concrete nearest legal value, never just "don't". */
  hint: string;
  /**
   * The SAME answer as `hint`, as one class a machine can substitute for `className`.
   *
   * `hint` is a sentence for a person; this is for an editor offering to make the change.
   * They are derived from the same values on purpose — a second, hand-written answer to
   * "what should I have written" is how the two quietly diverge.
   *
   * ABSENT WHEN THERE IS NO SINGLE ANSWER, which is the whole contract: `arbitrary-value`
   * has none (`leading-[1.05]` could become any of a dozen tokens, and picking one for the
   * author would be a guess wearing the clothes of a fix), so nothing may offer to fix it
   * automatically. A caller can rely on this being unambiguous whenever it is set.
   */
  replacement?: string;
}

/** Viewport breakpoint → the container step nearest it in px.
 *
 *  `sm` 640 → `@2xl` 672 · `md` 768 → `@3xl` 768 (exact) · `lg` 1024 → `@5xl` 1024
 *  (exact) · `xl` 1280 and `2xl` 1536 → `@5xl`, the top of the declared container
 *  set. Nothing maps above `@5xl` because a full-bleed section caps its content with
 *  `max-w-*` well before 1024px of container, so there is no layout left to restate.
 *
 *  A translation, not an equivalence: the two axes measure different boxes. It is
 *  right for the full-bleed sections everything here is authored inside, which is
 *  where viewport variants got written in the first place. */
const VIEWPORT_TO_CONTAINER: Record<string, string> = {
  sm: '@2xl',
  md: '@3xl',
  lg: '@5xl',
  xl: '@5xl',
  '2xl': '@5xl',
};

/** Expand one `@source inline(...)` brace pattern into its literal classes.
 *  `{sm:,md:,}gap-{1,2}` → `gap-1 gap-2 sm:gap-1 sm:gap-2 md:gap-1 md:gap-2`. */
function expand(pattern: string): string[] {
  const open = pattern.indexOf('{');
  if (open === -1) return [pattern];
  const close = pattern.indexOf('}', open);
  if (close === -1) return [pattern];
  const head = pattern.slice(0, open);
  const tail = pattern.slice(close + 1);
  return pattern
    .slice(open + 1, close)
    .split(',')
    .flatMap((option) => expand(`${head}${option}${tail}`));
}

/** Every class the declared vocabulary covers, expanded once and cached. */
let declared: Set<string> | null = null;
function declaredClasses(): Set<string> {
  declared ??= new Set(VOCABULARY_PATTERNS.flatMap(expand));
  return declared;
}

/** The declared families, mapped to the full set of values declared for each — so an
 *  out-of-range step can name its legal neighbours instead of just failing. */
let families: Map<string, Set<string>> | null = null;
function declaredFamilies(): Map<string, Set<string>> {
  if (families) return families;
  families = new Map();
  for (const cls of declaredClasses()) {
    // Strip any variant prefixes (`lg:`, `@md:`, `hover:`) — the family is the last
    // segment, and a variant never changes which values exist.
    const bare = cls.slice(cls.lastIndexOf(':') + 1);
    const dash = bare.lastIndexOf('-');
    if (dash <= 0) continue;
    const family = bare.slice(0, dash);
    const value = bare.slice(dash + 1);
    const set = families.get(family) ?? new Set<string>();
    set.add(value);
    families.set(family, set);
  }
  return families;
}

/** Numeric values sort numerically so a hint reads `6, 8` rather than `10, 12, 6`. */
function sortValues(values: Set<string>): string[] {
  return [...values].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

/** The nearest declared value to a rejected numeric step, for the hint. */
function nearest(values: Set<string>, target: string): string | null {
  const n = Number(target);
  if (!Number.isFinite(n)) return null;
  const numeric = [...values].map(Number).filter(Number.isFinite);
  if (!numeric.length) return null;
  return String(
    numeric.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), numeric[0]!)
  );
}

const VIEWPORT_PREFIXES = new Set(Object.keys(VIEWPORT_TO_CONTAINER));

/** The viewport breakpoint inside a class token, and the class without it.
 *
 *  Scans EVERY variant segment, not just the first: `hover:md:text-lg` and
 *  `md:hover:text-lg` are the same class and both need catching. Container variants
 *  carry an `@` (`@2xl:`) so they never collide with the viewport names, and a class
 *  with no variant at all (`max-w-sm`, `text-sm`) has no colon to split on.
 *
 *  `max-sm:` — "narrower than sm" — inverts, so it maps to `@max-2xl:` rather than
 *  `@2xl:`. Getting that backwards would hide exactly the content it was meant to
 *  show, which is worse than leaving the class alone. */
export function viewportVariant(className: string): { container: string; rest: string } | null {
  const parts = className.split(':');
  if (parts.length < 2) return null;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const raw = parts[i]!;
    const below = raw.startsWith('max-');
    const prefix = below ? raw.slice(4) : raw;
    if (!VIEWPORT_PREFIXES.has(prefix)) continue;
    const step = VIEWPORT_TO_CONTAINER[prefix]!;
    return {
      container: below ? `@max-${step.slice(1)}` : step,
      rest: parts.filter((_, j) => j !== i).join(':'),
    };
  }
  return null;
}

/**
 * The CONTAINER variants in a class string — `@2xl:grid-cols-3`, `@max-md:hidden`.
 *
 * The counterpart to `viewportVariant`: that one finds the classes that are wrong here,
 * this one finds the classes that are right but INERT unless an ancestor establishes a
 * container. A `@`-prefixed segment is unambiguous — Tailwind's viewport breakpoints
 * carry no `@`, so the two vocabularies cannot collide.
 */
export function containerVariants(className: string | undefined): string[] {
  if (!className) return [];
  return className
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      const parts = token.split(':');
      if (parts.length < 2) return false;
      return parts.slice(0, -1).some((p) => p.startsWith('@') && p !== '@container');
    });
}

/** Does this class string make its element a query container? `@container` alone, or a
 *  NAMED one (`@container/card`), which is what a nested card inside a section needs so
 *  its own variants resolve against the card rather than the section. */
export function establishesContainer(className: string | undefined): boolean {
  if (!className) return false;
  return className
    .split(/\s+/)
    .some((token) => token === '@container' || token.startsWith('@container/'));
}

/** Check ONE class token. Null when it is fine (or not our business). */
export function checkClass(className: string): VocabularyIssue | null {
  if (!className) return null;

  // 1. Arbitrary values never compile from a stored tree, whatever the family.
  if (/\[[^\]]*\]/.test(className)) {
    return {
      className,
      reason: 'arbitrary-value',
      hint: 'Arbitrary values only compile where Tailwind can SEE them, and an authored tree is never scanned — this emits no CSS at all. Use a scale token instead (e.g. `leading-none` rather than `leading-[1.05]`).',
    };
  }

  // 2. Viewport variants author against the browser WINDOW. Everything on this
  //    platform is authored through a canvas that fakes the device by setting an
  //    element's width, so a viewport variant is the one class that renders correctly
  //    on the live page and lies in the preview — the tenant switches to Mobile, sees
  //    the desktop layout, and has no way to know the control did nothing.
  const viewport = viewportVariant(className);
  if (viewport) {
    return {
      className,
      reason: 'viewport-variant',
      hint:
        `\`${className}\` is measured against the browser window, so the builder's phone and tablet ` +
        `previews cannot reflow it — the design changes on a real device but never on the canvas. ` +
        `Write \`${viewport.container}:${viewport.rest}\` instead, and make sure some parent carries ` +
        `\`@container\` (every seeded section, the nav and the footer already do).`,
      // Unambiguous as a SUBSTITUTION, but not unconditionally safe to apply: the hint's
      // second clause is load-bearing. Swapping this in under a node with no `@container`
      // ancestor turns a rule that works on a real device into one that never matches
      // anywhere — a downgrade dressed as a fix. Only `site-lint` can see the ancestors,
      // so it is the one that decides whether to OFFER this; the string itself is correct
      // either way.
      replacement: `${viewport.container}:${viewport.rest}`,
    };
  }

  const bare = className.slice(className.lastIndexOf(':') + 1);
  const dash = bare.lastIndexOf('-');
  if (dash <= 0) return null;
  const family = bare.slice(0, dash);
  const value = bare.slice(dash + 1);

  const values = declaredFamilies().get(family);
  // Unknown family → assume the @source scan covers it. See the header: a false
  // positive here blocks legitimate authoring, which is worse than a miss.
  if (!values || values.has(value)) return null;

  // NUMERIC STEPS ONLY. A declared family still holds plenty of valid non-numeric
  // values that the scan covers and this file never lists — `text-center`, `font-mono`,
  // `border-t`, `p-px`. Flagging those would reject correct authoring constantly. A
  // numeric step outside a declared numeric scale, though, is unambiguous: `gap-7`
  // against a 0-6,8,10 scale is a typo for a value that does not exist.
  const numericScale = [...values].some((v) => Number.isFinite(Number(v)));
  if (!Number.isFinite(Number(value)) || !numericScale) return null;

  const near = nearest(values, value);
  // The variant prefix (`@2xl:`, `hover:`) has to survive the substitution: only the
  // FAMILY-VALUE tail was out of range, and dropping the prefix would move the styling
  // to every width at once — silently, and while calling itself a fix.
  const prefix = className.slice(0, className.lastIndexOf(':') + 1);
  return {
    className,
    reason: 'out-of-range',
    hint: near
      ? `\`${family}-${value}\` is not in the declared scale and emits no CSS — the nearest declared step is \`${family}-${near}\`. Declared: ${sortValues(values).join(', ')}.`
      : `\`${family}-${value}\` is not in the declared scale and emits no CSS. Declared: ${sortValues(values).join(', ')}.`,
    // Only when a nearest step exists. A declared family with no numeric values at all
    // leaves `near` null, and there is nothing to substitute.
    ...(near ? { replacement: `${prefix}${family}-${near}` } : {}),
  };
}

/** Every unusable class in a whitespace-separated class string. */
export function checkClassString(classString: string): VocabularyIssue[] {
  const issues: VocabularyIssue[] = [];
  for (const token of classString.split(/\s+/)) {
    const issue = checkClass(token);
    if (issue) issues.push(issue);
  }
  return issues;
}

/** Every unusable class anywhere in an authored tree, deduplicated.
 *
 *  Walks `class` on element/component nodes. Deduplicated by class name: a broken
 *  `gap-7` repeated across nine cards is ONE thing to fix, and nine copies of the same
 *  message buries it. */
export function checkTreeClasses(node: unknown): VocabularyIssue[] {
  const seen = new Map<string, VocabularyIssue>();
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    const rec = n as { class?: unknown; children?: unknown[] };
    if (typeof rec.class === 'string') {
      for (const issue of checkClassString(rec.class)) {
        if (!seen.has(issue.className)) seen.set(issue.className, issue);
      }
    }
    for (const child of rec.children ?? []) walk(child);
  };
  walk(node);
  return [...seen.values()];
}

/** The write-time half of the responsive rule — a silica `ClassValidator` that
 *  REFUSES a class string containing a viewport variant, with the container class to
 *  write instead.
 *
 *  Why a refusal here when the MCP path only WARNS. The two surfaces fail differently.
 *  An MCP write has already been persisted by the time the tree is inspected, so
 *  rejecting it would trade a page the agent can fix for a page that does not exist.
 *  `Editor.setClass` runs this BEFORE it commits and hands the reason straight back to
 *  the Classes field the author is typing in — nothing is lost, and the correction is
 *  one token away in the box already under their cursor. A warning there would be a
 *  warning nobody reads, and the two vocabularies drift back apart within a release.
 *
 *  This is deliberately the ONLY rule here. It is not a re-run of `checkClassString`:
 *  an arbitrary value or an out-of-range step is a class that emits no CSS, which is
 *  bad but recoverable and sometimes intentional while an author is mid-thought.
 *  Blocking every one of them at keystroke time would make the field feel broken. */
export const validateResponsiveVocabulary: ClassValidator = (cls) => {
  for (const token of cls.split(/\s+/)) {
    const viewport = token ? viewportVariant(token) : null;
    if (!viewport) continue;
    return {
      ok: false,
      reason:
        `${token} sizes itself against the browser window, so the phone and tablet previews ` +
        `can't show what it does. Use ${viewport.container}:${viewport.rest} instead — it measures ` +
        `the space the block is actually in, which is what the preview changes.`,
    };
  }
  return { ok: true };
};
