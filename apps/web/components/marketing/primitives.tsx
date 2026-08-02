/**
 * Marketing-only primitives.
 *
 * apps/web is CLASS-BASED: these primitives emit `className` built from the
 * marketing utility vocabulary registered in app/globals.css (`@theme`) — the
 * editorial type scale (`text-md`/`text-lg`/`text-sm`…), the section
 * rhythm + page gutter (`py-section-lg`/`px-page`), and silica's own color
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
} as const;

export type MarketingModule = keyof typeof MODULE_COLORS;

export function getModuleColor(module: MarketingModule) {
  return MODULE_COLORS[module];
}

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
 * `fill` is a FILL CLASS (`bg-primary`, `bg-module-crm`), not a colour value —
 * `getModuleColor(m).bg` hands you the right literal. It used to take a
 * `var(--color-…)` string and paint via `style={{ backgroundColor }}`, which is
 * what forced ~100 call sites to mention `var()` at all: a component whose prop
 * is a colour string makes every caller hand it one.
 *
 * `size` is quantised to literal classes for the same reason — the six sizes in
 * use are a known set, so nothing here needs an inline style. See DESIGN.md,
 * the Contract.
 */
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
   * LEGACY — a colour VALUE (`var(--color-…)`). Still the shape most call sites
   * use; being migrated to `fill`. A component whose prop is a colour string
   * forces every caller to hand it a `var()`, which is why ~100 sites mention one.
   * Ignored when `fill` is set.
   */
  color?: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className={cx('inline-block shrink-0 rounded-full', fill)}
      style={
        fill
          ? { width: size, height: size }
          : { width: size, height: size, backgroundColor: color ?? 'var(--color-primary)' }
      }
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
 * Standard marketing section wrapper. Page gutter (`px-page`) and vertical rhythm
 * (`py-section-*`) are clamp()-fluid utilities, so the section breathes from a
 * 320px phone to a 2560px monitor with no per-component breakpoints.
 *
 * `surface="dark"` is a themed island (`data-theme="dark"`): the whole
 * `--color-base-*` ramp flips to brand navy, so the surface, border, and every
 * descendant resolve on-brand with zero literal hexes. Pass `bleed` for sections
 * that must span gutter-to-gutter (rare).
 */
export function Section({
  id,
  children,
  surface = 'page',
  padding = 'lg',
  bleed,
  className,
  style,
}: {
  id?: string;
  children: React.ReactNode;
  surface?: 'page' | 'surface' | 'dark';
  padding?: 'md' | 'lg' | 'xl';
  bleed?: boolean;
  /** Extra utilities / surface-depth tier hook for the `.mkt-paneled` system. */
  className?: string;
  /** Migration bridge for un-converted pages still passing layout inline.
   *  Converted pages use utilities and omit this. */
  style?: React.CSSProperties;
}) {
  const surfaceClass =
    surface === 'surface'
      ? 'bg-base-100 border-t border-base-300'
      : surface === 'dark'
        ? 'bg-base-100 border-t border-base-300'
        : 'bg-base-200';
  const pyClass =
    padding === 'md' ? 'py-section-md' : padding === 'lg' ? 'py-section-lg' : 'py-section-xl';
  return (
    <section
      id={id}
      data-theme={surface === 'dark' ? 'dark' : undefined}
      className={cx(surfaceClass, pyClass, 'px-page scroll-mt-20', className)}
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
   *  (`text-primary`, `text-module-crm`), not a colour value. */
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
 * `ink` is an INK CLASS (`text-primary`, `text-module-crm`), not a colour value;
 * `getModuleColor(m).ink` hands you the right literal. Previously a
 * `var(--color-…)` string painted inline, which is why ~113 call sites carried a
 * `var()` — the prop's type was the multiplier.
 */
export function Spark({ color }: { color?: string }) {
  return (
    <span className={color ? undefined : 'text-primary'} style={color ? { color } : undefined}>
      .
    </span>
  );
}
