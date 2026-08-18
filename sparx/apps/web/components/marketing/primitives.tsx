/**
 * Marketing-only primitives.
 *
 * sparx/apps/web is CLASS-BASED: these primitives emit `className` built from the
 * marketing utility vocabulary registered in app/globals.css (`@theme`) — the
 * editorial type scale (`text-md`/`text-lg`/`text-sm`…), the section
 * rhythm + page gutter (`py-28`/`px-page`), and silica's own color
 * utilities (`text-base-content`/`bg-base-200`/`text-primary`). Ink is ALWAYS
 * the surface's paired `-content` — there is no marketing-local ink vocabulary. Appearance lives in CSS,
 * so a design change is one edit there — NOT a hunt through stamped inline
 * styles. The only inline `style` left is genuinely per-instance dynamic values
 * (a Display headline's fluid clamp, a Dot's size, a module-specific tint).
 *
 * IMPORTANT: class names must be STATIC literals — Tailwind's scanner cannot see
 * an interpolated class like `leading-[${x}px]`. Dynamic sizing therefore maps
 * to a fixed set of literal utility classes (see `textSizeClass`), never a
 * computed class string.
 */
import * as React from 'react';
// Silica owns typography. These are aliased because this file still exports its
// OWN legacy `Text`/`Display` for the ~143 un-swept marketing files; as those
// convert, the local pair goes away and the aliases collapse to plain imports.
import { Heading as SilicaHeading, Text as SilicaText } from '@wizeworks/silicaui-react';
import { FILLED_SHAPE, FLUSH_SHAPE, PAINTED_TONE_CLASS, type PaintedTone } from './band';
// NOTE: the vector wordmark/mark live in `@sparx/brand/react` — import them from
// there DIRECTLY where needed. This file deliberately does NOT re-export them:
// `primitives` is imported by both server sections and the `'use client'`
// interactive components, and re-exporting the mixed server/client
// `@sparx/brand/react` barrel (it includes the stateful `SparkMascot`) through a
// no-directive module dragged that whole barrel into both module graphs — which
// Turbopack resolves to a phantom `undefined` export. Keep this file barrel-free.

/** Join class fragments, dropping falsy ones. */
function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Per-module identity, expressed as SILICA CLASSES — not colors.
 *
 * The `--color-module-*` tokens are registered with the silicaui plugin in
 * globals.css, so every module gets the full utility family for free. This map
 * exists only to hand a component the right LITERAL class name (Tailwind's
 * scanner cannot see an interpolated `bg-module-${key}`), never to carry a hue.
 *
 *   bg   → `bg-module-crm`                 solid fill — FILL ONLY, see below
 *   bg + `bg-soft` → the tinted card wash  (silica's own 15% color-mix)
 *   ink  → `text-module-crm`               the hue as text/icon ink
 *   content → `text-module-crm-content`    the legible ink ON that fill — pair
 *           it with `bg` ALWAYS (see below); never `text-white`
 *   color → `var(--color-module-crm)`      the token, for the few places that
 *           need a VALUE (an SVG `stroke`, a canvas fill) rather than a class
 *
 * `bg-*` SETS THE FILL AND NOTHING ELSE. It does NOT bring its paired `-content`
 * ink along — silica emits `bg-module-crm` and `text-module-crm-content` as two
 * independent utilities (confirmed against the plugin's generated class list).
 * So a solid module fill MUST also carry its ink:
 *
 *   <div className="bg-module-crm text-module-crm-content">   ← correct
 *   <div className="bg-module-crm">                           ← inherits whatever
 *       ink the surrounding surface had. Looks fine on the one theme you tested
 *       and can go unreadable in the other.
 *
 * This comment previously claimed the `-content` ink was automatic. It never
 * was, and that is the likeliest reason `color: '#FFFFFF'` kept appearing next
 * to module fills across the marketing pages — people hit the contrast problem
 * and reached for white instead of the token.
 *
 * There are deliberately NO hex values here. A hand-mirrored `tint: '#EEF2FF'`
 * / `text: '#4338CA'` pair used to live in this map: it duplicated the tokens,
 * ignored dark mode, and drifted from silica's own `soft` treatment — three
 * different washes for one idea. The literal hues survive in exactly one TS
 * place, `MODULE_HEX` in @sparx/brand, for satori/canvas contexts where CSS
 * custom properties genuinely don't resolve.
 */
const MODULE_COLORS = {
  builder: {
    color: 'var(--color-module-builder)',
    bg: 'bg-module-builder',
    ink: 'text-module-builder',
    content: 'text-module-builder-content',
  },
  commerce: {
    color: 'var(--color-module-commerce)',
    bg: 'bg-module-commerce',
    ink: 'text-module-commerce',
    content: 'text-module-commerce-content',
  },
  cms: {
    color: 'var(--color-module-cms)',
    bg: 'bg-module-cms',
    ink: 'text-module-cms',
    content: 'text-module-cms-content',
  },
  crm: {
    color: 'var(--color-module-crm)',
    bg: 'bg-module-crm',
    ink: 'text-module-crm',
    content: 'text-module-crm-content',
  },
  invoicing: {
    color: 'var(--color-module-invoicing)',
    bg: 'bg-module-invoicing',
    ink: 'text-module-invoicing',
    content: 'text-module-invoicing-content',
  },
  email: {
    color: 'var(--color-module-email)',
    bg: 'bg-module-email',
    ink: 'text-module-email',
    content: 'text-module-email-content',
  },
  b2b: {
    color: 'var(--color-module-b2b)',
    bg: 'bg-module-b2b',
    ink: 'text-module-b2b',
    content: 'text-module-b2b-content',
  },
  dropship: {
    color: 'var(--color-module-dropship)',
    bg: 'bg-module-dropship',
    ink: 'text-module-dropship',
    content: 'text-module-dropship-content',
  },
  inventory: {
    color: 'var(--color-module-inventory)',
    bg: 'bg-module-inventory',
    ink: 'text-module-inventory',
    content: 'text-module-inventory-content',
  },
  chat: {
    color: 'var(--color-module-chat)',
    bg: 'bg-module-chat',
    ink: 'text-module-chat',
    content: 'text-module-chat-content',
  },
  scheduling: {
    color: 'var(--color-module-scheduling)',
    bg: 'bg-module-scheduling',
    ink: 'text-module-scheduling',
    content: 'text-module-scheduling-content',
  },
  ai: {
    color: 'var(--color-module-ai)',
    bg: 'bg-module-ai',
    ink: 'text-module-ai',
    content: 'text-module-ai-content',
  },
  // Free platform capabilities, not billable modules — no manifest and not in
  // ModuleSlug. SEO is always present; Automations unlocks with any one module.
  // They carry module hues because they ARE module-shaped to a visitor.
  seo: {
    color: 'var(--color-module-seo)',
    bg: 'bg-module-seo',
    ink: 'text-module-seo',
    content: 'text-module-seo-content',
  },
  automations: {
    color: 'var(--color-module-automations)',
    bg: 'bg-module-automations',
    ink: 'text-module-automations',
    content: 'text-module-automations-content',
  },
  // A real, independently-gated module (docs/133) that is simply priced at $0 —
  // unlike SEO/Automations above, which are platform capabilities, not ModuleSlugs.
  social: {
    color: 'var(--color-module-social)',
    bg: 'bg-module-social',
    ink: 'text-module-social',
    content: 'text-module-social-content',
  },
  // Spend + profitability (docs/148). Billable standalone, free with Commerce or
  // B2B — the tile carries that story rather than a bare price.
  finance: {
    color: 'var(--color-module-finance)',
    bg: 'bg-module-finance',
    ink: 'text-module-finance',
    content: 'text-module-finance-content',
  },
  // The people who do the work (docs/149). A deep rust brown — the one hue
  // family the palette had never used, and deliberately far from commerce's
  // orange (L 31% against 66%) so the two never read as the same module at 16px.
  staff: {
    color: 'var(--color-module-staff)',
    bg: 'bg-module-staff',
    ink: 'text-module-staff',
    content: 'text-module-staff-content',
  },
} as const;

export type MarketingModule = keyof typeof MODULE_COLORS;

export function getModuleColor(module: MarketingModule) {
  return MODULE_COLORS[module];
}

/**
 * Fill + paired ink for a LAYER 5 section — the module's own hue, painted.
 *
 * Built from the two literals already in `MODULE_COLORS` so Tailwind's scanner
 * still sees both class names at their original site; nothing here is a new
 * interpolated class.
 *
 * Every one of the 18 pairs was measured against WCAG before this existed —
 * lowest is `module-finance` at 4.52:1, highest `module-seo` at 7.60:1, so all
 * of them clear AA for BODY text, not just large. That is the whole reason the
 * `-content` ink is mandatory rather than `text-white`: silica pairs cyan
 * (`#06b6d4`) with a dark navy (`#083344`, 5.52:1) precisely because white on
 * cyan fails. Paint the fill without its ink and a layer-5 band inherits
 * whatever came before it — which on this site is usually near-black on the
 * light theme and white inside a dark island.
 */
const MODULE_TONE_CLASS = Object.fromEntries(
  Object.entries(MODULE_COLORS).map(([k, v]) => [k, `${v.bg} ${v.content}`])
) as Record<MarketingModule, string>;

// ── Text scale mapping ───────────────────────────────────────────────────────
// A numeric px `size` maps onto SILICA's own rem ladder. There is no marketing
// type scale any more: silica ships text-sm 14 / text-md 16 / text-lg 18 /
// text-xl 20 / text-2xl 24 / text-3xl 30, rem-based so it scales with the
// reader's font-size preference. The app used to redefine the same ladder in px
// with 1px steps, which is a second vocabulary AND cannot scale.
//
// `text-md` is the default. `text-sm` is the caption step. Nothing here emits
// `text-xs` — that is reserved for text nobody is meant to read, which is not
// what this primitive is for. Kept as literal class names so Tailwind's scanner
// emits every one.
function textSizeClass(size: number): string {
  if (size < 15) return 'text-sm'; // 14 — captions and labels, the floor
  if (size < 17) return 'text-md'; // 16 — body, the default
  if (size < 19) return 'text-lg'; // 18 — lede
  if (size < 22) return 'text-xl'; // 20
  if (size < 27) return 'text-2xl'; // 24
  // Past 30px hand back to <Display>, which is fluid-clamped and owns the big end.
  return 'text-3xl'; // 30
}

// There is no ink prop. `<Text>` emits NO color class at all, so it inherits
// whatever ink its surface pairs with — `text-base-content` under `bg-base-100`,
// `text-primary-content` under `bg-primary`, and both re-resolve inside a
// `data-theme="dark"` island by themselves. A caller who wants a specific hue
// passes it as a utility (`className={M.ink}`) and it simply applies.
//
// This replaced a `tone` axis of `default | muted | subtle | none`. Two of those
// (`muted`, `subtle`) were a parallel `--color-ink-*` vocabulary competing with
// silica's `-content` contract. The other two were the bug: because `<Text>`
// ALWAYS stamped a color class, adding `M.ink` via `className` put two
// same-specificity color utilities on one element, and CSS resolves that by
// STYLESHEET order rather than className order — so the module hue won or lost
// non-deterministically. `` existed only to opt out of that. Emitting
// no color removes the axis and the race together.

function weightClass(weight: 400 | 500 | 600): string {
  return weight === 600 ? 'font-semibold' : weight === 500 ? 'font-medium' : 'font-normal';
}

// There is no `Eyebrow` and no `EyebrowBadge`. Nothing sits above a heading to
// introduce it — no kicker, no category chip, no `01 / 02 / 03` marker, and no
// <Badge> used as one either; the ban is on the SLOT, not the markup. Both
// components lived here with zero call sites, which is worse than a violation:
// a loaded gun the next person picks up in good faith. Hierarchy is scale,
// weight and color. The heading carries itself.

/**
 * Marketing display heading — sizes well past silica's Heading variants.
 * Brand guide §4: Geist 500, -0.025em to -0.035em tracking.
 *
 * `size`/`lineHeight` are the desktop MAX; Display clamps internally so the same
 * headline reads on a 320px phone and a 2560px monitor. The fluid `font-size` /
 * `line-height` are the one legitimately-dynamic inline style here (a computed
 * clamp per instance); everything static is a utility class.
 */
export function Display({
  children,
  size = 56,
  lineHeight,
  color,
  as: Tag = 'h2',
}: {
  children: React.ReactNode;
  size?: number;
  lineHeight?: number;
  color?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  const lhMax = lineHeight ?? Math.round(size * 0.92);
  const fontSize = `clamp(${Math.max(28, Math.round(size * 0.42))}px, ${(size / 12).toFixed(2)}vw, ${size}px)`;
  const lh = `clamp(${Math.max(30, Math.round(lhMax * 0.5))}px, ${(lhMax / 12).toFixed(2)}vw, ${lhMax}px)`;
  return (
    <Tag
      className={cx(
        'font-sans font-medium',
        size > 80 ? 'tracking-[-0.035em]' : 'tracking-[-0.025em]',
        color ? null : 'text-base-content'
      )}
      style={{ fontSize, lineHeight: lh, ...(color ? { color } : {}) }}
    >
      {children}
    </Tag>
  );
}

/**
 * Marketing body-copy primitive — the one place running text, labels, and
 * captions resolve their type + ink. `size` (px) maps to an editorial `text-*`
 * utility. It sets NO ink: color comes from the surface's own `-content`
 * pairing, so it flips inside a `data-theme="dark"` island by itself and a
 * caller-supplied hue never fights it. The 16px body floor lives in the scale
 * (`text-md` = 16); `text-sm` (14) is the ONLY step below it, for genuine
 * captions and labels.
 */
export function Text({
  children,
  size = 16,
  weight = 400,
  mono = false,
  color,
  as: Tag = 'p',
  className,
  style,
}: {
  children: React.ReactNode;
  /** Font size in px → nearest editorial `text-*` utility. Defaults to 16 (body floor). */
  size?: number;
  weight?: 400 | 500 | 600;
  /** Render in the mono face (hex/token/caption chips). */
  mono?: boolean;
  /** Escape hatch for a one-off ink expressed as a TOKEN (e.g. `var(--color-primary)`),
   *  not a literal hex. Emitted as an inline color only. */
  color?: string;
  as?: 'p' | 'span' | 'div' | 'li' | 'dt' | 'dd' | 'figcaption' | 'label' | 'small' | 'h3' | 'h4';
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Tag
      className={cx(
        mono ? 'font-mono' : 'font-sans',
        textSizeClass(size),
        weightClass(weight),
        className
      )}
      style={color ? { color, ...style } : style}
    >
      {children}
    </Tag>
  );
}

/**
 * Inline code/token chip — the mono pill used to name a CSS variable or symbol
 * inside running copy (e.g. `<Spark>`, `@sparx/brand`).
 */
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-base-content bg-base-200 rounded-sm px-[5px] py-px font-mono text-sm">
      {children}
    </code>
  );
}

/**
 * Bullet / decorative accent dot.
 *
 * `fill` is a FILL CLASS (`bg-primary`, `bg-module-crm`), not a color value —
 * `getModuleColor(m).bg` hands you the right literal. It used to take a
 * `var(--color-…)` string and paint via `style={{ backgroundColor }}`, which is
 * what forced ~100 call sites to mention `var()` at all: a component whose prop
 * is a color string makes every caller hand it one.
 *
 * `size` is quantised to literal classes for the same reason — the six sizes in
 * use are a known set, so nothing here needs an inline style. See DESIGN.md,
 * the Contract.
 */
/**
 * Dot sizes as literal classes. The doc below has claimed since it was written
 * that `size` "is quantised to literal classes ... so nothing here needs an
 * inline style" — it wasn't; the component stamped `style={{width,height}}` on
 * every one of the ~85 dots on the marketing site, which is what put
 * `width:8px;height:8px` in the rendered markup of every module page.
 *
 * Measured across `sparx/apps/web`, `<Dot>` is called with exactly five sizes (3, 6,
 * 7, 8, 9) plus the default. A literal map is therefore complete, not a
 * best-effort — and being literal strings, Tailwind's scanner emits all five.
 */
const DOT_SIZE_CLASS: Record<number, string> = {
  3: 'size-[3px]',
  6: 'size-[6px]',
  7: 'size-[7px]',
  8: 'size-[8px]',
  9: 'size-[9px]',
};

export function Dot({
  fill,
  color,
  size = 6,
}: {
  /**
   * PREFERRED — a fill CLASS (`bg-module-crm`, `bg-success`). Keeps the dot
   * tracking the token: re-point `@sparx/brand/theme.css` and it follows with no
   * edit here. `getModuleColor(m).bg` and `CapabilityArea.fill` both hand you one.
   */
  fill?: string;
  /**
   * LEGACY — a color VALUE (`var(--color-…)`). Still the shape most call sites
   * use; being migrated to `fill`. A component whose prop is a color string
   * forces every caller to hand it a `var()`, which is why ~100 sites mention one.
   * Ignored when `fill` is set.
   */
  color?: string;
  size?: number;
}) {
  const sizeClass = DOT_SIZE_CLASS[size] ?? DOT_SIZE_CLASS[6];
  return (
    <span
      aria-hidden
      className={cx(
        'inline-block shrink-0 rounded-full',
        sizeClass,
        fill ?? (color ? '' : 'bg-primary')
      )}
      // The ONLY remaining inline style, and only on the legacy `color` path:
      // a `var(--color-…)` VALUE cannot become a class, so a call site that
      // hands one over forces the paint. `fill` emits nothing here at all.
      // Migrate a call site by passing `getModuleColor(m).bg` instead of
      // `.color`, and this branch goes with the last one.
      style={!fill && color ? { backgroundColor: color } : undefined}
    />
  );
}

/**
 * Centered content container. Used inside `<Section>` automatically; exposed for
 * inline `<section>`/`<nav>`/`<footer>` that own their outer band but want the
 * standard 1280px content cap (`max-w-content`) + responsive page gutter.
 */
export function Container({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  /** Migration bridge for un-converted pages still passing layout inline.
   *  Converted pages use utilities and omit this. */
  style?: React.CSSProperties;
}) {
  return (
    <div className={cx('max-w-content mx-auto w-full', className)} style={style}>
      {children}
    </div>
  );
}

/**
 * Standard marketing section wrapper. The page gutter (`px-page`) is a token —
 * a horizontal inset tied to the container. The vertical rhythm is NOT: it is
 * the ordinary numeric scale (`py-20` / `py-28` / `py-32`), fluid on its own
 * because `--spacing` is re-pointed per breakpoint in globals.css.
 *
 * That replaced `py-section-md/lg/xl`, three hand-written clamps only sections
 * could use — so a section breathed with the viewport while every card, grid and
 * gap inside it stayed fixed. One multiplier now moves all of them together.
 *
 * `surface="dark"` is a themed island (`data-theme="dark"`): the whole
 * `--color-base-*` ramp flips to brand navy, so the surface, border, and every
 * descendant resolve on-brand with zero literal hexes. Pass `bleed` for sections
 * that must span gutter-to-gutter (rare).
 *
 * `primary` / `neutral` / `accent` are PAINTED tones, shared verbatim with
 * `<Band>` via `PAINTED_TONE_CLASS`. They exist because a page whose only tones
 * are `page` and `surface` is a grey → white → grey → white ladder, which is
 * what all eleven module pages were: /commerce ran six alternating sections in a
 * row and then two greys touching. A page is a tone SEQUENCE (DESIGN.md §2.4),
 * and this axis is what lets a module page write one.
 *
 * `surface="module" module="crm"` is LAYER 5 — the module's own registered hue,
 * painted, with its measured `-content` ink. It is the top of the depth ladder
 * in DESIGN.md §2.5 and is reserved for module pages: exactly one section, the
 * one that makes the argument only THAT module can make. `Section` had no way to
 * paint it at all until now, which is the mechanical reason all eleven module
 * pages topped out at layer 4 — the shell couldn't express their own identity.
 *
 * Two constraints, both load-bearing:
 *
 *   • A painted tone is a fill + ink, NOT a theme scope. Bare prose inherits the
 *     `-content` ink; a silica component paints itself from its own variables and
 *     never sees it, so an `outline`/`ghost` control inside one still inks from
 *     the LIGHT theme and lands near-black on a dark fill. Painted bands take
 *     SOLID controls, or a bare underlined `<a>` that inherits. DESIGN.md §3.0.
 *   • Any `bg-base-100` child inside a painted band must carry
 *     `text-base-content` too. Carrying only the fill leaves it inheriting the
 *     band's `-content` — i.e. white type on a white card, on `primary`.
 */
/**
 * `surface` and `module` as a DISCRIMINATED UNION, so a layer-5 section cannot
 * be written without naming its module. Left as two independent optional props,
 * `surface="module"` with no `module` compiles fine and renders an unpainted
 * band — a silent failure, and exactly the class of bug the `bg-*`-without-ink
 * note above documents.
 */
type SectionTone =
  | { surface?: 'page' | 'surface' | 'dark' | PaintedTone; module?: never }
  | { surface: 'module'; module: MarketingModule };

/**
 * The tone → fill+ink class for a section.
 *
 * A standalone function because narrowing has to happen on the UNION, not on
 * destructured bindings: pull `surface` and `module` out as separate consts and
 * TypeScript stops correlating them, so `surface === 'module'` no longer proves
 * `module` is defined. Taking the union whole means each branch narrows for
 * free, with no cast and no non-null assertion.
 */
function sectionToneClass(tone: SectionTone): string {
  if (tone.surface === 'module') return MODULE_TONE_CLASS[tone.module];
  const s = tone.surface ?? 'page';
  // `surface` and `dark` are the same fill token deliberately — `--color-base-100`
  // is white on the light theme and near-black inside the `data-theme` island.
  if (s === 'surface' || s === 'dark') return 'bg-base-100';
  if (s === 'page') return 'bg-base-200';
  return PAINTED_TONE_CLASS[s];
}

type SectionProps = SectionTone & {
  id?: string;
  children: React.ReactNode;
  padding?: 'md' | 'lg' | 'xl';
  bleed?: boolean;
  /** Keep a filled section flush to the viewport edge — no inset, no TOP radius.
   *  The standing exception is a HERO: a page's first section sits under the
   *  nav, and insetting it opens a 24px stripe of page background between the
   *  header and the content.
   *
   *  The BOTTOM corners still round. A hero is a layer and a layer has to end;
   *  square-bottomed it runs hard into the rounded section beneath it. Opt out
   *  with `className="rounded-b-none"` only when the next section is the SAME
   *  layer — then there is no boundary and the rounding belongs further down.
   *  Same rule and same reason as `<Band flush>`. */
  flush?: boolean;
  /** Extra utilities / surface-depth tier hook for the `.mkt-paneled` system. */
  className?: string;
  /** Migration bridge for un-converted pages still passing layout inline.
   *  Converted pages use utilities and omit this. */
  style?: React.CSSProperties;
};

export function Section(props: SectionProps) {
  // `surface`/`module` stay on `props` rather than being destructured out, so
  // `sectionToneClass` receives the union intact and narrows it itself — a
  // destructured `surface` is no longer correlated with `module`.
  const { id, children, padding = 'lg', bleed, flush, className, style } = props;
  const surface = props.surface ?? 'page';
  // A section that carries its own fill is INSET AND ROUNDED; one sitting on the
  // page background is not. That rule was already true of `<Band>` and of every
  // page built on it (/platform, /partners, /customers, /for/*, /tools) — but
  // `Section`, which the eleven module pages run on, drew the same filled bands
  // as square full-bleed stripes. A band that is rounded on /platform and square
  // on /commerce is two design systems, so both shells now share `FILLED_SHAPE`.
  //
  // The `border-t` goes with it. It was the separator BECAUSE the stripes were
  // flush and edge-to-edge; once a filled section floats on the page background
  // its own edge separates it, and a `base-300` hairline drawn across ember or
  // cyan is a seam rather than a divider.
  //
  // EVERY tone here is filled, `page` included — that is the part the first pass
  // got wrong. `page` is a misnomer inherited from this prop's original three
  // values: it does not mean "no fill", it paints `--color-base-200`. Measured,
  // the ground under these pages is `--color-base-300` (`#e6eaf2`, set on
  // `body`), and `base-200` is `#f3f5f9` — one step LIGHTER, i.e. elevated above
  // the ground exactly like `surface` and `dark` are. So it earns the same shape
  // for the same reason, and excluding it left /commerce with two square grey
  // sections between rounded neighbours.
  //
  // A section that genuinely wants to sit on the ground carries no background at
  // all (the FAQ does this — a bare `<section>`, measured transparent), or passes
  // `flush`. Note `<Band>`'s `page` is a different thing under the same name: it
  // emits NO fill, so it really is the bare ground.
  const filled = !flush;
  const surfaceClass = cx(
    sectionToneClass(props),
    // The hairline belongs to the FLUSH case only, which is why it isn't in the
    // tone map: a flush section is edge-to-edge and needs a separator, a filled
    // one floats and separates itself.
    (surface === 'surface' || surface === 'dark') && flush && 'border-base-300 border-t'
  );
  // The ordinary numeric scale, NOT the deleted `py-section-*` tokens. These are
  // fluid on their own because `--spacing` is re-pointed per breakpoint in
  // globals.css (0.2 / 0.25 / 0.3rem), so `py-28` is 89.6px on a phone and
  // 134.4px on a desktop with no clamp and no breakpoint here.
  //
  // If this ever reads `py-section-*` again, EVERY <Section> on the marketing
  // site silently loses its vertical padding — the class has no definition
  // behind it any more, so it emits nothing rather than failing loudly.
  const pyClass = padding === 'md' ? 'py-20' : padding === 'lg' ? 'py-28' : 'py-32';
  return (
    <section
      id={id}
      data-theme={surface === 'dark' ? 'dark' : undefined}
      className={cx(
        surfaceClass,
        pyClass,
        'px-page scroll-mt-20',
        filled ? FILLED_SHAPE : '',
        // A flush section still ends: bottom corners round even though the top
        // and sides run to the viewport edge. `page` paints nothing, so there is
        // no shape to give it.
        flush && surface !== 'page' ? FLUSH_SHAPE : '',
        className
      )}
      style={style}
    >
      {bleed ? children : <Container>{children}</Container>}
    </section>
  );
}

/**
 * Editorial section header — display headline (+ optional colored spark accent)
 * over a narrower lede. The headline caps at 960px so it wraps to a second line
 * at content width; the lede sits narrower (640px) for a clean rag.
 */
export function SectionHeader({
  headline,
  lede,
  accent,
  ledeColor,
}: {
  headline: React.ReactNode;
  lede?: React.ReactNode;
  /** @deprecated Dark sections are `data-theme="dark"` islands now; value ignored. */
  invert?: boolean;
  headlineSize?: number;
  headlineLineHeight?: number;
  /** Section identity — renders the closing "spark" period in this INK CLASS
   *  (`text-primary`, `text-module-crm`), not a color value. */
  accent?: string;
  /** Override the lede ink (token only) — e.g. over bright media. */
  ledeColor?: string;
}) {
  // Composes SILICA typography — `Heading` + `Text variant="lead"` — not the
  // app-local `Display`, which stamps a computed `clamp()` `fontSize`/`lineHeight`
  // inline on every section headline. Since every band on every page renders
  // through here, that one inline style was the largest remaining source of
  // px-driven type on the marketing site. `headlineSize`/`headlineLineHeight` are
  // now ignored: the size comes from the heading level, which is the point.
  return (
    <div className="flex flex-col items-start gap-6">
      <div className="max-w-[960px]">
        <SilicaHeading level={2}>
          {headline}
          {accent ? <Spark color={accent} /> : null}
        </SilicaHeading>
      </div>
      {lede ? (
        <SilicaText
          variant="lead"
          className="max-w-[640px] pt-2"
          style={ledeColor ? { color: ledeColor } : undefined}
        >
          {lede}
        </SilicaText>
      ) : null}
    </div>
  );
}

/**
 * Ember period — the recurring "spark" brand moment at the end of display
 * headlines.
 *
 * `ink` is an INK CLASS (`text-primary`, `text-module-crm`), not a color value;
 * `getModuleColor(m).ink` hands you the right literal. Previously a
 * `var(--color-…)` string painted inline, which is why ~113 call sites carried a
 * `var()` — the prop's type was the multiplier.
 */
export function Spark({ color }: { color?: string }) {
  // MIGRATION SHIM. `color` was specified as a color VALUE and every one of the
  // ~100 call sites hands it `var(--color-…)`, which forces the inline paint —
  // 13 of them on /crm alone, and `Spark` is the single largest remaining source
  // of `style="color:…"` in the rendered marketing markup.
  //
  // An INK CLASS (`text-module-crm`, from `getModuleColor(m).ink`) needs no
  // style at all, so this now accepts either and routes on the shape of the
  // string. That is deliberately forgiving rather than clever: it lets call
  // sites migrate one page at a time instead of requiring a single 143-site
  // commit across ~30 files, several of them pages nobody has audited yet.
  //
  // `SectionHeader`'s `accent` prop feeds straight into here and has always been
  // DOCUMENTED as taking a class — this is what finally makes that true.
  //
  // When the last `.color` call site is gone, delete the branch and rename the
  // prop to `ink`.
  const isValue = !!color && (color.startsWith('var(') || color.startsWith('#'));
  if (isValue) return <span style={{ color }}>.</span>;
  return <span className={color ?? 'text-primary'}>.</span>;
}
