// The colors a PLATFORM email paints itself in, per brand.
//
// This is the other half of `platformBrandIdentity`. That one fixed the NAME on a
// platform email — the masthead wordmark, the subjects, the "your … account"
// copy. The colors were left, and they were sparx's: Ember `#e04631` on a
// `#0c1433` ink masthead, hardcoded as a module constant in `@wizeworks/email`'s
// `signal` tokens. One email worker drains the queue for both brands, so a
// Piggles owner's password reset arrived correctly named and painted in another
// company's palette.
//
// ── WHY HEX, AND WHY CONFIGURATION ──────────────────────────────────────────
//
// Hex because mail clients strip `<style>` blocks and ignore CSS custom
// properties: every value ends up inlined on the element, so a token cannot
// reach an email. That is not a shortcut here, it is the medium.
//
// Configuration because of RULE #0 — this layer may not import `@sparx/*` or
// `@piggles/*`, and the consumer is a shared worker rendering for whichever brand
// the tenant belongs to. A registry of brand hexes in this file would be a brand
// value stated in the platform, which is the thing the tree split exists to stop.
// So the values arrive as `<BRAND>_EMAIL_PALETTE`, exactly like `BRAND_NAME` and
// `BRAND_ACCENT` before them. This file names no brand and holds no brand's
// color; adding a third is setting one more variable.
//
// ── ONE VARIABLE, NOT SIXTEEN ───────────────────────────────────────────────
//
// A palette is ONE decision. Sixteen discrete variables is sixteen chances to
// set half of it, and a half-set palette is the failure mode that matters — an
// email with a brand's accent on another brand's ink looks broken in a way
// neither an unset palette nor a complete one does. So it is one JSON object,
// validated as a unit, and a palette that fails validation is treated as ABSENT
// rather than partially applied.
//
// ── WHAT ABSENT LOOKS LIKE ──────────────────────────────────────────────────
//
// `PLAIN` — an achromatic grey ramp that belongs to nobody. NOT sparx's values.
// A brand-blind fallback that happens to be one brand's palette is the same bug
// wearing a default, and it is worse than an obvious one because it renders
// perfectly. A plain email is visibly unstyled, which is what a misconfigured
// deployment should look like; `paletteSource` reports which one you got so the
// worker can say so in its logs rather than leaving it to be noticed by a
// customer. See the `feedback_absent_behaves_like_fine` failure mode.

/**
 * The roles a platform email actually paints. Every one is consumed by
 * `PlatformEmailLayout` or a Signal block — there are no aspirational entries,
 * because a token nothing reads is a token nobody maintains.
 *
 * Optional fields are the ones a brand's approved palette may genuinely have no
 * value for. Each has a defined COLLAPSE (documented on the field) that loses a
 * refinement without ever inventing a color: a brand board is somebody's
 * decision, and deriving `accentEdge` by darkening the accent would be this file
 * choosing a brand color, which is precisely what it must not do.
 */
export interface EmailPaletteInput {
  /** The one action. Filled button, timeline dates, the accented tail of the
   *  wordmark, the fallback link. */
  accent: string;
  /** Ink ON the accent — the filled button's label. */
  accentContent: string;
  /** The filled button's bottom edge, giving it depth. Absent → the button
   *  renders flat, which is a look rather than a defect. */
  accentEdge?: string;
  /** A light accent wash, for the numbered step chips. Absent → the chip renders
   *  as accent ink on paper inside a 1px accent hairline. */
  accentWash?: string;
  /** The masthead band, the amount hero, the total rule, a one-time code. The
   *  brand's darkest structural color, not its accent. */
  ink: string;
  /** Ink ON the masthead — the wordmark, the payment-brand chip. */
  inkContent: string;
  /** De-emphasised meta ON the masthead (a receipt number). Absent →
   *  `inkContent`, which is louder than intended but never wrong. */
  inkMeta?: string;
  /** The card. */
  paper: string;
  /** The page behind the card, and the fill of a neutral status pill. */
  canvas: string;
  /** The footer well. */
  well: string;
  /** Hairlines, table rules, box borders. */
  line: string;
  /** A hairline that has to carry more weight than a table rule — a link
   *  underline, a ghost button's border. Absent → `line`. */
  lineStrong?: string;
  /** Headings, and the bolder half of a two-line row. */
  heading: string;
  /** Body copy. A real ink, never a faded grey (RULE #3). */
  body: string;
  /** The lead paragraph under a display heading. Absent → `body`. */
  lead?: string;
  /** A functional group label above a data block. Absent → `heading`. */
  label?: string;
  /** Genuine metadata — a receipt line's subtitle, a footer legal line. The only
   *  muted role, and it is muted on purpose. */
  meta: string;

  // ── Semantic. Shared by default, overridable per brand ──────────────────
  //
  // A green that means "paid" is not a brand signal, so the platform supplies a
  // contrast-checked ramp and a brand overrides it only if it wants to. This is
  // the one place a default value is legitimately shared: `wizeworks/CLAUDE.md`
  // makes which semantic colors EXIST shared and their values brand-owned, and a
  // brand that states nothing here is not having a color chosen for it — it is
  // declining to differentiate one.
  //
  // Note these are FOREGROUND-on-wash pairs, which is a different job from a
  // silica `--color-success` fill. A brand whose board softens its semantics for
  // use as fills should NOT paste those values here without checking them
  // against the wash: a soft green on a pale green wash is unreadable.

  /** Success foreground, on `successWash`. */
  success?: string;
  /** Success wash — the pill and alert fill. */
  successWash?: string;
  /** Warning foreground. Deliberately a deep ink rather than the amber itself:
   *  amber-on-amber fails contrast at every weight. */
  warnInk?: string;
  /** Warning wash. */
  warnWash?: string;
  /** Danger foreground. */
  danger?: string;
  /** Danger wash. */
  dangerWash?: string;
  /** Info foreground. */
  info?: string;
  /** Info wash — also the one-time-code block's fill. */
  infoWash?: string;

  /**
   * The brand's DARK surfaces, for the `prefers-color-scheme: dark` block the
   * silica renderer emits.
   *
   * Optional as a whole and all-or-nothing within: a brand that publishes no
   * dark theme renders its light design everywhere, which is honest. A dark
   * block assembled from half a set is a dark email with a white card in it.
   *
   * The hues are separately optional because most brands keep their accent in
   * both modes; omit them and they stay unmapped, which is the correct rendering
   * for a brand whose accent does not shift.
   */
  dark?: EmailPaletteDark;
}

export interface EmailPaletteDark {
  /** The card, in dark. */
  background: string;
  /** Body + heading text, in dark. */
  foreground: string;
  /** Page background + subtle fills, in dark. */
  muted: string;
  /** Hairlines, in dark. */
  border: string;
  /** The accent, if it shifts in dark. Omit → unchanged. */
  primary?: string;
  /** Ink on that accent, if it shifts. Omit → unchanged. */
  primaryForeground?: string;
  /** Link / secondary accent, if it shifts. Omit → unchanged. */
  accent?: string;
}

/**
 * The palette with every collapse applied, which is what a component reads. No
 * optional fields: a block should never have to ask whether a role was set.
 *
 * `dark` is the exception and stays nullable, because "this brand has no dark
 * theme" is a real answer with a real rendering (light everywhere) rather than a
 * gap to be filled. Collapsing it onto the light values would emit a dark-mode
 * block that changes nothing — bytes in every email to say nothing.
 */
export type EmailPalette = Required<Omit<EmailPaletteInput, 'dark'>> & {
  dark: EmailPaletteDark | null;
};

/**
 * The palette for a brand that has published none.
 *
 * Achromatic on purpose. It is legible, it is complete, and it is recognisably
 * nobody's — so a deployment that forgot the variable produces an email that
 * looks unstyled instead of one that looks like the wrong company. The semantic
 * ramp is the real one, because a failed-payment notice still has to read as a
 * failure whatever else is unconfigured.
 */
export const PLAIN_EMAIL_PALETTE: EmailPalette = {
  accent: '#1f2937',
  accentContent: '#ffffff',
  accentEdge: '#111827',
  accentWash: '#f3f4f6',
  ink: '#111827',
  inkContent: '#ffffff',
  inkMeta: '#9ca3af',
  paper: '#ffffff',
  canvas: '#f3f4f6',
  well: '#f9fafb',
  line: '#e5e7eb',
  lineStrong: '#d1d5db',
  heading: '#111827',
  body: '#374151',
  lead: '#374151',
  label: '#4b5563',
  meta: '#6b7280',
  success: '#0f8a5f',
  successWash: '#e7f6ef',
  warnInk: '#7c3a06',
  warnWash: '#fbeed9',
  danger: '#b3271a',
  dangerWash: '#fdece9',
  info: '#3b5bdb',
  infoWash: '#eef2ff',
  // No dark theme. An unconfigured brand renders its (plain) light design in
  // every client rather than a dark one nobody chose.
  dark: null,
};

const DARK_REQUIRED = ['background', 'foreground', 'muted', 'border'] as const;
const DARK_KEYS = [...DARK_REQUIRED, 'primary', 'primaryForeground', 'accent'] as const;

/** Returns the reasons this dark block is unusable — empty when it is fine. */
function darkProblems(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['dark is not a JSON object'];
  }
  const problems: string[] = [];
  for (const [name, v] of Object.entries(value as Record<string, unknown>)) {
    if (!(DARK_KEYS as readonly string[]).includes(name)) {
      problems.push(`dark.${name} is not a dark role`);
    } else if (typeof v !== 'string' || !HEX.test(v)) {
      problems.push(`dark.${name} is not a 6-digit hex`);
    }
  }
  const missing = DARK_REQUIRED.filter(
    (k) => typeof (value as Record<string, unknown>)[k] !== 'string'
  );
  if (missing.length > 0) problems.push(`dark is missing ${missing.join(', ')}`);
  return problems;
}

/** The roles a brand MUST state for its palette to be usable at all. Everything
 *  else has a collapse or a shared default. Miss one of these and there is no
 *  coherent email to render, so the whole palette is refused. */
const REQUIRED_KEYS = [
  'accent',
  'accentContent',
  'ink',
  'inkContent',
  'paper',
  'canvas',
  'well',
  'line',
  'heading',
  'body',
  'meta',
] as const satisfies readonly (keyof EmailPaletteInput)[];

/** Six-digit only. Three-digit shorthand and eight-digit alpha are both
 *  unreliable across mail clients (Outlook's word-rendering engine drops them),
 *  so a value that would silently not paint is rejected here where it can be
 *  reported rather than in a client where it cannot. */
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface ResolvedEmailPalette {
  palette: EmailPalette;
  /** `configured` — the brand stated a complete palette. `plain` — it stated
   *  none, or stated one that did not validate. The caller LOGS this; a fallback
   *  nobody can see is a fallback nobody fixes. */
  source: 'configured' | 'plain';
  /** Why it fell back, for the log line. Null when `source` is `configured`. */
  reason: string | null;
}

function readEnv(name: string): string | null {
  if (typeof process === 'undefined') return null;
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Parse and validate one brand's palette variable.
 *
 * Every failure returns PLAIN with a reason rather than throwing. An email worker
 * must not stop over a color — the same posture `platformBrandIdentity` takes for
 * a display name, and for the same reason: a queue that halts is worse than an
 * email that is grey.
 */
export function resolveEmailPalette(brand: string | null | undefined): ResolvedEmailPalette {
  const key = (brand ?? '').trim().toLowerCase() || 'sparx';
  const varName = `${key.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_EMAIL_PALETTE`;
  const raw = readEnv(varName);
  if (!raw) return { palette: PLAIN_EMAIL_PALETTE, source: 'plain', reason: `${varName} is unset` };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      palette: PLAIN_EMAIL_PALETTE,
      source: 'plain',
      reason: `${varName} is not valid JSON`,
    };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      palette: PLAIN_EMAIL_PALETTE,
      source: 'plain',
      reason: `${varName} is not a JSON object`,
    };
  }

  const input = parsed as Record<string, unknown>;

  // Reject the whole palette on a bad value, never repair it. A palette missing
  // its ink still renders — in the fallback's ink, against this brand's accent —
  // and that combination is the one outcome worse than either palette whole.
  const bad: string[] = [];
  for (const [name, value] of Object.entries(input)) {
    if (name === 'dark') {
      bad.push(...darkProblems(value));
    } else if (!(name in PLAIN_EMAIL_PALETTE)) {
      bad.push(`${name} is not a palette role`);
    } else if (typeof value !== 'string' || !HEX.test(value)) {
      bad.push(`${name} is not a 6-digit hex`);
    }
  }
  const missing = REQUIRED_KEYS.filter((k) => typeof input[k] !== 'string');
  if (missing.length > 0) bad.push(`missing ${missing.join(', ')}`);
  if (bad.length > 0) {
    return {
      palette: PLAIN_EMAIL_PALETTE,
      source: 'plain',
      reason: `${varName}: ${bad.join('; ')}`,
    };
  }

  const stated = input as unknown as EmailPaletteInput;
  return { palette: applyCollapses(stated), source: 'configured', reason: null };
}

/**
 * Fill the optional roles from the ones the brand did state.
 *
 * Role reassignment, never computation. `lead` becomes `body` because a lead
 * paragraph the brand has not distinguished IS body copy at a larger size — it
 * does not become a lightened `body`, which would be this file picking a color.
 * The semantic ramp is the only place a value comes from outside the brand, and
 * that is stated as a decision above.
 */
function applyCollapses(p: EmailPaletteInput): EmailPalette {
  return {
    accent: p.accent,
    accentContent: p.accentContent,
    // Absent is meaningful, not missing: `EmailActionButton` reads
    // `accentEdge === accent` as "no edge" and renders the button flat.
    accentEdge: p.accentEdge ?? p.accent,
    // Likewise `accentWash === paper` means "no wash" — the chip takes an accent
    // hairline instead of a fill.
    accentWash: p.accentWash ?? p.paper,
    ink: p.ink,
    inkContent: p.inkContent,
    inkMeta: p.inkMeta ?? p.inkContent,
    paper: p.paper,
    canvas: p.canvas,
    well: p.well,
    line: p.line,
    lineStrong: p.lineStrong ?? p.line,
    heading: p.heading,
    body: p.body,
    lead: p.lead ?? p.body,
    label: p.label ?? p.heading,
    meta: p.meta,
    success: p.success ?? PLAIN_EMAIL_PALETTE.success,
    successWash: p.successWash ?? PLAIN_EMAIL_PALETTE.successWash,
    warnInk: p.warnInk ?? PLAIN_EMAIL_PALETTE.warnInk,
    warnWash: p.warnWash ?? PLAIN_EMAIL_PALETTE.warnWash,
    danger: p.danger ?? PLAIN_EMAIL_PALETTE.danger,
    dangerWash: p.dangerWash ?? PLAIN_EMAIL_PALETTE.dangerWash,
    info: p.info ?? PLAIN_EMAIL_PALETTE.info,
    infoWash: p.infoWash ?? PLAIN_EMAIL_PALETTE.infoWash,
    // Not collapsed onto anything: absent means light-only, and that is the
    // rendering rather than a hole. See the type's note.
    dark: p.dark ?? null,
  };
}
