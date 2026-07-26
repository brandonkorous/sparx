/**
 * Marketing-only primitives.
 *
 * apps/web is CLASS-BASED: these primitives emit `className` built from the
 * marketing utility vocabulary registered in app/globals.css (`@theme`) — the
 * editorial type scale (`text-body`/`text-lede`/`text-caption`…), the section
 * rhythm + page gutter (`py-section-lg`/`px-page`), the real-ink secondary
 * colors (`text-ink-muted`/`text-ink-subtle`), and silica's color utilities
 * (`text-base-content`/`bg-base-200`/`text-primary`). Appearance lives in CSS,
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
  },
  commerce: {
    color: 'var(--color-module-commerce)',
    bg: 'bg-module-commerce',
    ink: 'text-module-commerce',
  },
  cms: { color: 'var(--color-module-cms)', bg: 'bg-module-cms', ink: 'text-module-cms' },
  crm: { color: 'var(--color-module-crm)', bg: 'bg-module-crm', ink: 'text-module-crm' },
  invoicing: {
    color: 'var(--color-module-invoicing)',
    bg: 'bg-module-invoicing',
    ink: 'text-module-invoicing',
  },
  email: { color: 'var(--color-module-email)', bg: 'bg-module-email', ink: 'text-module-email' },
  b2b: { color: 'var(--color-module-b2b)', bg: 'bg-module-b2b', ink: 'text-module-b2b' },
  dropship: {
    color: 'var(--color-module-dropship)',
    bg: 'bg-module-dropship',
    ink: 'text-module-dropship',
  },
  inventory: {
    color: 'var(--color-module-inventory)',
    bg: 'bg-module-inventory',
    ink: 'text-module-inventory',
  },
  chat: { color: 'var(--color-module-chat)', bg: 'bg-module-chat', ink: 'text-module-chat' },
  scheduling: {
    color: 'var(--color-module-scheduling)',
    bg: 'bg-module-scheduling',
    ink: 'text-module-scheduling',
  },
  ai: { color: 'var(--color-module-ai)', bg: 'bg-module-ai', ink: 'text-module-ai' },
  // Free platform capabilities, not billable modules — no manifest and not in
  // ModuleSlug. SEO is always present; Automations unlocks with any one module.
  // They carry module hues because they ARE module-shaped to a visitor.
  seo: { color: 'var(--color-module-seo)', bg: 'bg-module-seo', ink: 'text-module-seo' },
  automations: {
    color: 'var(--color-module-automations)',
    bg: 'bg-module-automations',
    ink: 'text-module-automations',
  },
  // A real, independently-gated module (docs/133) that is simply priced at $0 —
  // unlike SEO/Automations above, which are platform capabilities, not ModuleSlugs.
  social: {
    color: 'var(--color-module-social)',
    bg: 'bg-module-social',
    ink: 'text-module-social',
  },
} as const;

export type MarketingModule = keyof typeof MODULE_COLORS;

export function getModuleColor(module: MarketingModule) {
  return MODULE_COLORS[module];
}

// ── Text scale mapping ───────────────────────────────────────────────────────
// A numeric px `size` maps to one of the editorial `text-*` utilities registered
// in globals.css (each carries its own paired line-height). Half-sizes round to
// the nearest step. Kept as a switch of LITERAL class names so Tailwind's scanner
// emits every one.
function textSizeClass(size: number): string {
  if (size < 11.5) return 'text-micro';
  if (size < 12.75) return 'text-mini';
  if (size < 13.75) return 'text-caption';
  if (size < 14.75) return 'text-small';
  if (size < 15.75) return 'text-body-sm';
  if (size < 16.75) return 'text-body';
  if (size < 17.75) return 'text-body-lg';
  if (size < 18.75) return 'text-lede';
  if (size < 19.75) return 'text-lede-lg';
  // Heading steps. Before these existed the ladder ended at `text-lede-lg`, so
  // ANY size ≥ 18.75 collapsed to 19px — `<Text as="h3" size={24}>` read as
  // correct in source and silently shrank in the browser. Past 26px hand back
  // to <Display>, which is fluid-clamped and owns the big end.
  if (size < 21) return 'text-h4';
  if (size < 23) return 'text-h3';
  if (size < 26) return 'text-h2';
  return 'text-h1';
}

/**
 * The ink axis. `none` emits NO color class at all — use it when the CALLER
 * supplies the color as a utility (a module ink, `text-warning`, …):
 *
 *   <Text tone="none" className={M.ink} mono size={11}>
 *
 * Without it, `<Text>` always stamped a tone class, so adding `M.ink` via
 * `className` put two same-specificity color utilities on one element — and CSS
 * resolves that by stylesheet order, not className order, so the module hue
 * could lose non-deterministically. That gap was pushing callers back to raw
 * hand-styled `<span>`s, which is exactly what these primitives exist to stop.
 */
type TextTone = 'default' | 'muted' | 'subtle' | 'none';

const TONE_CLASS: Record<TextTone, string | null> = {
  default: 'text-base-content',
  muted: 'text-ink-muted',
  subtle: 'text-ink-subtle',
  none: null,
};

function weightClass(weight: 400 | 500 | 600): string {
  return weight === 600 ? 'font-semibold' : weight === 500 ? 'font-medium' : 'font-normal';
}

/**
 * Editorial eyebrow label — small uppercase tag. (Deprecated brand-wide; kept
 * for the handful of un-migrated callers.)
 */
export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className={cx(
        'text-micro font-sans font-medium tracking-[0.08em] uppercase',
        color ? null : 'text-ink-muted'
      )}
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
}

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
 * utility; `tone` maps to a real-ink color utility. Both are DRIFT-PROOF: the
 * ink tones mix into `--color-base-100` (never `transparent`), so the no-faded-
 * text rule holds, and they flip inside a `data-theme="dark"` island on their
 * own — there is deliberately no "invert" tone. The 16px body floor lives in the
 * scale (`text-body` = 16); smaller steps are for genuine captions/labels.
 */
export function Text({
  children,
  size = 16,
  tone = 'muted',
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
  /** Ink axis — every value resolves to real ink, never transparent. */
  tone?: TextTone;
  weight?: 400 | 500 | 600;
  /** Render in the mono face (hex/token/caption chips). */
  mono?: boolean;
  /** Escape hatch for a one-off ink expressed as a TOKEN (e.g. `var(--color-primary)`),
   *  not a literal hex. Wins over `tone`; emitted as an inline color only. */
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
        color ? null : TONE_CLASS[tone],
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
    <code className="text-mini text-base-content bg-base-200 rounded-sm px-[5px] py-px font-mono">
      {children}
    </code>
  );
}

/**
 * Ember dot used as a bullet/decorative accent. Size + color are per-instance
 * dynamic, so they stay inline; structure is utilities.
 */
export function Dot({
  color = 'var(--color-primary)',
  size = 6,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
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
  /** @deprecated Eyebrows are removed brand-wide; value ignored. Use `accent`. */
  eyebrow?: React.ReactNode;
  /** @deprecated see `eyebrow`. */
  eyebrowColor?: string;
  headline: React.ReactNode;
  lede?: React.ReactNode;
  /** @deprecated Dark sections are `data-theme="dark"` islands now; value ignored. */
  invert?: boolean;
  headlineSize?: number;
  headlineLineHeight?: number;
  /** Section identity — renders the closing "spark" period in this color. */
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
 * Colored eyebrow chip — dot + uppercase label inside a tinted pill. The pill
 * fill + label ink are module-specific (dynamic), so they stay inline; structure
 * is utilities.
 */
export function EyebrowBadge({
  children,
  color,
  background,
  text,
}: {
  children: React.ReactNode;
  color: string;
  background: string;
  text: string;
}) {
  return (
    <span
      className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-[5px]"
      style={{ backgroundColor: background }}
    >
      <Dot color={color} />
      <span
        className="text-micro font-sans font-medium tracking-[0.05em] uppercase"
        style={{ color: text }}
      >
        {children}
      </span>
    </span>
  );
}

/**
 * Ember period — the recurring "spark" brand moment at the end of display
 * headlines. Defaults to the primary hue via `text-primary`; a passed `color`
 * (a token) renders inline for section-accent sparks.
 */
export function Spark({ color }: { color?: string }) {
  return (
    <span className={color ? undefined : 'text-primary'} style={color ? { color } : undefined}>
      .
    </span>
  );
}
