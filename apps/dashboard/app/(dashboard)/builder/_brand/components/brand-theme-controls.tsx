'use client';

// Column 2 of the Brand & Theme center — every knob that drives the live
// showcase, grouped by category (identity, colour, type, shape, layout) the way
// a tenant thinks, not by which store owns it. Under the hood the two owners
// stay clean (docs/33 §3.6): brand-owned fields (identity, colour, type, shape,
// rhythm, effect) persist via the brand record; presentation-owned fields
// (surfaces, status, container, appearance) persist via the site config. The
// parent (theme-center) holds the state and the debounced savers; this file is
// the form + the small per-axis mutation helpers.
//
// Colours render as a compact swatch grid (docs/33 §3.1): each named colour is a
// FILL swatch plus its text/-content swatch (the "Sx" mark, drawn entirely in the
// content colour so you read it on the fill). Content swatches default to the
// auto-derived contrast colour so they are never blank; setting one is the
// override escape hatch.

import * as React from 'react';
import { Alert, Button, Input, Label, NativeSelect } from '@sparx/ui';
import {
  getThemePresetV2,
  type CompiledColorTokensV2,
  type ColorTokensV2,
  type PresentationColorOverlay,
  type PresentationOverlayV2,
} from '@sparx/site-themes';
import { Plus, X } from 'lucide-react';
import type { AppearancePolicy } from '../lib/types';
import { contrastRatio, rateContrast } from '../lib/brand-preview';
import {
  BORDER_OPTIONS,
  DEPTH_OPTIONS,
  RADIUS_SCALE,
  SIZE_SCALE,
  SPACING_OPTIONS,
  type BrandTokens,
} from '../lib/brand-feel';
import { BrandImageField } from './brand-image-field';
import { FieldControl } from './field-control';

export interface MediaState {
  id: string | null;
  url: string | null;
}

type Mode = 'light' | 'dark';
type SlotKey = keyof PresentationColorOverlay & keyof ColorTokensV2;
interface ColorPair {
  base: SlotKey;
  content: SlotKey | null;
  label: string;
}

const INHERIT = 'default';

// Surfaces are laid out as two stacks: the plain fills (Surface/Muted/Border) on
// the left, the fills that carry their own text colour (Page/Neutral) on the
// right. base-200/300 share base-content (shown once on Page), so they carry no
// own content swatch.
// The three base layers as a palette scale (DaisyUI-style base-100/200/300),
// not use-specific names. All share the single `baseContent` surface text colour
// (docs/33: base-200/300 share base-content) — so the "Sx" on every layer edits
// the one surface text colour, which makes that colour editable from each layer.
const BASE_LAYERS: ColorPair[] = [
  { base: 'base100', content: 'baseContent', label: 'Base-100' },
  { base: 'base200', content: 'baseContent', label: 'Base-200' },
  { base: 'base300', content: 'baseContent', label: 'Base-300' },
];
// Neutral is the UI-fill colour (with its own -content). There is no standalone
// border colour slot: borders draw in whichever palette role the component uses
// (primary/secondary/accent/base-*/neutral/status), so the tenant never sets a
// separate brand border colour.
const SURFACE_NEUTRAL: ColorPair = { base: 'neutral', content: 'neutralContent', label: 'Neutral' };

const STATUS_PAIRS: ColorPair[] = [
  { base: 'info', content: 'infoContent', label: 'Info' },
  { base: 'success', content: 'successContent', label: 'Success' },
  { base: 'warning', content: 'warningContent', label: 'Warning' },
  { base: 'danger', content: 'dangerContent', label: 'Danger' },
];

const CONTAINER_WIDTHS = [
  { key: 'narrow', label: 'Narrow' },
  { key: 'medium', label: 'Medium' },
  { key: 'wide', label: 'Wide' },
  { key: 'full', label: 'Full' },
] as const;

const POLICIES: { key: AppearancePolicy; label: string }[] = [
  { key: 'light-only', label: 'Light' },
  { key: 'dark-only', label: 'Dark' },
  { key: 'auto', label: 'Auto' },
  { key: 'toggle', label: 'Toggle' },
];

export interface SocialLink {
  platform: string;
  url: string;
}

export interface BrandThemeControlsProps {
  // Identity — the active SITE (docs/49): its customer-facing name + own socials.
  siteName: string;
  setSiteName: (v: string) => void;
  // True when the active site is the tenant's primary — drives the Identity hint
  // (a non-primary site's brand edits are its own override, not the tenant base).
  isPrimarySite: boolean;
  socials: SocialLink[];
  setSocials: React.Dispatch<React.SetStateAction<SocialLink[]>>;
  tagline: string;
  setTagline: (v: string) => void;
  logoLight: MediaState;
  setLogoLight: (v: MediaState) => void;
  logoDark: MediaState;
  setLogoDark: (v: MediaState) => void;
  favicon: MediaState;
  setFavicon: (v: MediaState) => void;
  colorPrimary: string | null;
  setColorPrimary: (v: string | null) => void;
  colorPrimaryForeground: string | null;
  setColorPrimaryForeground: (v: string | null) => void;
  colorAccent: string | null;
  setColorAccent: (v: string | null) => void;
  colorAccentForeground: string | null;
  setColorAccentForeground: (v: string | null) => void;
  colorSecondary: string | null;
  setColorSecondary: (v: string | null) => void;
  colorSecondaryForeground: string | null;
  setColorSecondaryForeground: (v: string | null) => void;
  // Last-saved identity colours: a swatch shows its "revert" control only while
  // it differs from these (so the control clears once the edit is saved).
  savedBrandColors: {
    colorPrimary: string | null;
    colorPrimaryForeground: string | null;
    colorAccent: string | null;
    colorAccentForeground: string | null;
    colorSecondary: string | null;
    colorSecondaryForeground: string | null;
  };
  fontHeading: string | null;
  setFontHeading: (v: string | null) => void;
  fontBody: string | null;
  setFontBody: (v: string | null) => void;
  tokens: BrandTokens;
  setTokens: React.Dispatch<React.SetStateAction<BrandTokens>>;

  // Presentation (config-owned), edited for the mode the preview is showing
  themeKey: string;
  mode: Mode;
  // The fully-resolved colours for the active mode — used as the display value
  // for every swatch (so derived -content colours are never blank).
  compiledColors: CompiledColorTokensV2;
  presentation: PresentationOverlayV2;
  onPresentationChange: (next: PresentationOverlayV2) => void;
  policy: AppearancePolicy;
  onPolicyChange: (p: AppearancePolicy) => void;
}

export function BrandThemeControls(props: BrandThemeControlsProps) {
  const {
    siteName,
    setSiteName,
    isPrimarySite,
    socials,
    setSocials,
    tagline,
    setTagline,
    logoLight,
    setLogoLight,
    logoDark,
    setLogoDark,
    favicon,
    setFavicon,
    colorPrimary,
    setColorPrimary,
    colorPrimaryForeground,
    setColorPrimaryForeground,
    colorAccent,
    setColorAccent,
    colorAccentForeground,
    setColorAccentForeground,
    colorSecondary,
    setColorSecondary,
    colorSecondaryForeground,
    setColorSecondaryForeground,
    savedBrandColors,
    fontHeading,
    setFontHeading,
    fontBody,
    setFontBody,
    tokens,
    setTokens,
    themeKey,
    mode,
    compiledColors,
    presentation,
    onPresentationChange,
    policy,
    onPolicyChange,
  } = props;

  // ── Presentation slot helpers (write into the per-mode overlay) ─────────────
  const preset = getThemePresetV2(themeKey);
  const overlay: PresentationColorOverlay = presentation[mode] ?? {};
  const onSlot = (key: SlotKey, value: string) =>
    onPresentationChange({ ...presentation, v: 2, [mode]: { ...overlay, [key]: value } });
  const containerValue = presentation.containerWidth ?? preset.shared.containerWidth;
  const onContainer = (value: string) =>
    onPresentationChange({ ...presentation, v: 2, containerWidth: value });

  // A presentation colour tile (fill + optional text swatch), reading its display
  // colours from the resolved set and writing edits into the overlay.
  const renderSwatch = (s: ColorPair) => (
    <ColorSwatch
      key={s.base}
      label={s.label}
      color={compiledColors[s.base]}
      onChange={(v) => onSlot(s.base, v)}
      content={
        s.content
          ? { color: compiledColors[s.content], onChange: (v) => onSlot(s.content!, v) }
          : undefined
      }
    />
  );

  // ── Brand shape/rhythm/effect knobs (map preset keys ↔ token doc) ──────────
  // Corners are dialed per-axis (daisyUI parity): boxes / fields / selectors each
  // own a radius token, so the value IS the token value (no preset round-trip).
  const boxKey = tokens.shape?.radiusBox ?? INHERIT;
  const fieldKey = tokens.shape?.radiusField ?? INHERIT;
  const selectorKey = tokens.shape?.radiusSelector ?? INHERIT;
  const borderKey = tokens.shape?.borderWidth ?? INHERIT;
  const spacingKey = tokens.rhythm?.spaceBase ?? INHERIT;
  // Sizes are dialed per-group too (daisyUI parity): field vs selector base unit.
  const fieldSizeKey = tokens.rhythm?.sizeField ?? INHERIT;
  const selectorSizeKey = tokens.rhythm?.sizeSelector ?? INHERIT;
  const depthKey = tokens.effect?.depth != null ? String(tokens.effect.depth) : INHERIT;

  // One radius axis → its token; "Auto" (INHERIT) clears just that axis and leaves
  // the other shape knobs intact (mirrors setBorder).
  const setRadius = (axis: 'radiusBox' | 'radiusField' | 'radiusSelector') => (key: string) =>
    setTokens((t) => {
      const next = { ...t.shape };
      if (key === INHERIT) delete next[axis];
      else next[axis] = key;
      return { ...t, shape: Object.keys(next).length ? next : undefined };
    });
  const setBox = setRadius('radiusBox');
  const setField = setRadius('radiusField');
  const setSelector = setRadius('radiusSelector');
  const setBorder = (key: string) =>
    setTokens((t) => {
      const next = { ...t.shape };
      if (key === INHERIT) delete next.borderWidth;
      else next.borderWidth = key;
      return { ...t, shape: Object.keys(next).length ? next : undefined };
    });
  const setSpacing = (key: string) =>
    setTokens((t) => {
      const next = { ...t.rhythm };
      if (key === INHERIT) delete next.spaceBase;
      else next.spaceBase = key;
      return { ...t, rhythm: Object.keys(next).length ? next : undefined };
    });
  // One size axis → its base-unit token; "Auto" clears just that axis (mirrors
  // setSpacing). Every field/selector component multiplies its own base unit.
  const setSizeAxis = (axis: 'sizeField' | 'sizeSelector') => (key: string) =>
    setTokens((t) => {
      const next = { ...t.rhythm };
      if (key === INHERIT) delete next[axis];
      else next[axis] = key;
      return { ...t, rhythm: Object.keys(next).length ? next : undefined };
    });
  const setFieldSize = setSizeAxis('sizeField');
  const setSelectorSize = setSizeAxis('sizeSelector');
  const setDepth = (key: string) =>
    setTokens((t) => ({ ...t, effect: key === INHERIT ? undefined : { depth: Number(key) } }));

  const modeLabel = mode === 'light' ? 'light' : 'dark';

  // On-primary readability — surfaced compactly under the brand swatches.
  const onPrimaryRatio =
    colorPrimary && colorPrimaryForeground
      ? contrastRatio(colorPrimaryForeground, colorPrimary)
      : null;
  const onPrimaryRating = onPrimaryRatio === null ? null : rateContrast(onPrimaryRatio);
  const lowContrast = onPrimaryRating === 'Fail' || onPrimaryRating === 'AA Large';

  return (
    <div className="flex flex-col gap-6">
      <Section title="Identity">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-name">Site name</Label>
          <Input
            id="site-name"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="Acme Co."
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            The name customers see on this site — its title, header, and emails. Your tenant&apos;s
            legal/billing name lives in Settings → General.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-tagline">Tagline</Label>
          <Input
            id="brand-tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Parts that keep you running"
          />
        </div>
        {!isPrimarySite ? (
          <Alert color="info" variant="soft" size="sm">
            You&apos;re editing a secondary site. Its brand below overrides your main brand — any
            value you leave untouched keeps inheriting from it.
          </Alert>
        ) : null}
      </Section>

      <Section title="Social links" hint="Shown in this site's footer. Each site has its own.">
        <SocialLinksEditor socials={socials} setSocials={setSocials} />
      </Section>

      <Section title="Logo & favicon">
        <BrandImageField
          label="Logo (light backgrounds)"
          value={logoLight.id}
          previewUrl={logoLight.url}
          onChange={(id, url) => setLogoLight({ id, url })}
          help="Shown on light surfaces."
        />
        <BrandImageField
          label="Logo (dark backgrounds)"
          value={logoDark.id}
          previewUrl={logoDark.url}
          onChange={(id, url) => setLogoDark({ id, url })}
          help="A light/reversed logo for dark surfaces. Falls back to the light logo."
          dark
        />
        <BrandImageField
          label="Favicon"
          value={favicon.id}
          previewUrl={favicon.url}
          onChange={(id, url) => setFavicon({ id, url })}
          help="Square icon for browser tabs."
        />
      </Section>

      {/* Brand-owned colour identity — applies across the site, email, and CMS. */}
      <Section title="Brand colors" hint="The Sx mark previews the text colour on each fill.">
        <div className="grid grid-cols-2 gap-2.5">
          <ColorSwatch
            label="Primary"
            color={colorPrimary ?? compiledColors.primary}
            onChange={setColorPrimary}
            canClear={
              colorPrimary !== savedBrandColors.colorPrimary ||
              colorPrimaryForeground !== savedBrandColors.colorPrimaryForeground
            }
            onClear={() => {
              setColorPrimary(savedBrandColors.colorPrimary);
              setColorPrimaryForeground(savedBrandColors.colorPrimaryForeground);
            }}
            warn={onPrimaryRating === 'Fail'}
            content={{
              color: colorPrimaryForeground ?? compiledColors.primaryContent,
              onChange: setColorPrimaryForeground,
            }}
          />
          <ColorSwatch
            label="Secondary"
            color={colorSecondary ?? compiledColors.secondary}
            onChange={setColorSecondary}
            canClear={
              colorSecondary !== savedBrandColors.colorSecondary ||
              colorSecondaryForeground !== savedBrandColors.colorSecondaryForeground
            }
            onClear={() => {
              setColorSecondary(savedBrandColors.colorSecondary);
              setColorSecondaryForeground(savedBrandColors.colorSecondaryForeground);
            }}
            content={{
              color: colorSecondaryForeground ?? compiledColors.secondaryContent,
              onChange: setColorSecondaryForeground,
            }}
          />
          <ColorSwatch
            label="Accent"
            color={colorAccent ?? compiledColors.accent}
            onChange={setColorAccent}
            canClear={
              colorAccent !== savedBrandColors.colorAccent ||
              colorAccentForeground !== savedBrandColors.colorAccentForeground
            }
            onClear={() => {
              setColorAccent(savedBrandColors.colorAccent);
              setColorAccentForeground(savedBrandColors.colorAccentForeground);
            }}
            content={{
              color: colorAccentForeground ?? compiledColors.accentContent,
              onChange: setColorAccentForeground,
            }}
          />
        </div>
        {lowContrast && onPrimaryRatio !== null ? (
          <p className="text-xs text-[var(--color-warning-text)]">
            On-primary text is {onPrimaryRating === 'Fail' ? 'hard to read' : 'a little low'} on
            primary ({onPrimaryRatio.toFixed(1)}:1). Aim for 4.5:1 or higher.
          </p>
        ) : null}
      </Section>

      {/* Presentation-owned surfaces, edited per mode. */}
      <Section title="Surfaces" hint={`Editing ${modeLabel} mode — switch it in the preview.`}>
        {/* The base scale (base-100/200/300) plus the neutral UI fill, two per
            row. The Sx on each base layer previews — and edits — the shared
            surface text colour; Neutral wraps onto the next row beside Base-300. */}
        <div className="grid grid-cols-2 gap-2.5">
          {BASE_LAYERS.map(renderSwatch)}
          {renderSwatch(SURFACE_NEUTRAL)}
        </div>
      </Section>

      <Section title="Status colors">
        <div className="grid grid-cols-2 gap-2.5">{STATUS_PAIRS.map(renderSwatch)}</div>
      </Section>

      <Section title="Typography">
        <FieldControl
          field={{ key: 'fontHeading', label: 'Heading font', type: 'font' }}
          value={fontHeading ?? ''}
          onChange={(v) => setFontHeading((v as string) || null)}
        />
        <FieldControl
          field={{ key: 'fontBody', label: 'Body font', type: 'font' }}
          value={fontBody ?? ''}
          onChange={(v) => setFontBody((v as string) || null)}
        />
      </Section>

      {/* Brand-owned shape/rhythm/effect (docs/33). Segmented, so every option is
          visible and one tap away — no dropdowns. "Auto" clears the brand
          override and follows the theme preset. */}
      <Section title="Shape & feel">
        {/* Corners, daisyUI-style: three independent radius tokens. Every site-ui
            component reads its matching --st-radius-* token, so each control
            cascades site-wide; per-node `rounded-*` still overrides. */}
        <Segmented
          label="Box corners"
          help="Cards, modals, alerts, media."
          value={boxKey}
          options={RADIUS_SCALE}
          onChange={setBox}
          includeAuto
        />
        <Segmented
          label="Field corners"
          help="Buttons, inputs, selects, tabs."
          value={fieldKey}
          options={RADIUS_SCALE}
          onChange={setField}
          includeAuto
        />
        <Segmented
          label="Selector corners"
          help="Checkboxes, toggles, badges."
          value={selectorKey}
          options={RADIUS_SCALE}
          onChange={setSelector}
          includeAuto
        />
        <Segmented
          label="Border weight"
          value={borderKey}
          options={BORDER_OPTIONS}
          onChange={setBorder}
          includeAuto
        />
        <Segmented
          label="Spacing"
          help="Overall density of the layout."
          value={spacingKey}
          options={SPACING_OPTIONS}
          onChange={setSpacing}
          includeAuto
        />
        {/* Sizes, daisyUI-style: independent field / selector base units. Field
            components (button/input/select/tab) and selector components
            (checkbox/toggle/badge) each multiply their own; per-element `--sz-*`
            classes still set relative steps on top. */}
        <Segmented
          label="Field size"
          help="Buttons, inputs, selects, tabs."
          value={fieldSizeKey}
          options={SIZE_SCALE}
          onChange={setFieldSize}
          includeAuto
        />
        <Segmented
          label="Selector size"
          help="Checkboxes, toggles, badges."
          value={selectorSizeKey}
          options={SIZE_SCALE}
          onChange={setSelectorSize}
          includeAuto
        />
        <Segmented
          label="Depth"
          help="Shadow strength on cards and menus."
          value={depthKey}
          options={DEPTH_OPTIONS}
          onChange={setDepth}
          includeAuto
        />
      </Section>

      <Section title="Layout">
        <Segmented
          label="Content width"
          help="Maximum width of page content."
          value={containerValue}
          options={CONTAINER_WIDTHS}
          onChange={onContainer}
        />
        <Segmented
          label="Appearance"
          help="How the site chooses light or dark for shoppers."
          value={policy}
          options={POLICIES}
          onChange={(v) => onPolicyChange(v as AppearancePolicy)}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
        {hint ? <p className="text-xs text-[var(--color-text-muted)]">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

// A named-colour tile: a FILL swatch and (optionally) its text/-content swatch,
// with the name under. `color` is the resolved colour the block shows. When
// `onClear` + `canClear` are set, a corner "revert" control appears — shown only
// while the swatch has an unsaved edit (canClear), so it clears once saved.
function ColorSwatch({
  label,
  color,
  onChange,
  onClear,
  canClear,
  warn,
  content,
}: {
  label: string;
  color: string;
  onChange: (color: string) => void;
  onClear?: () => void;
  canClear?: boolean;
  warn?: boolean;
  content?: { color: string; onChange: (color: string) => void };
}) {
  // A fill-only tile (Surface/Muted/Border) has no paired text swatch, so it
  // gets the column's full width as a rounded rectangle; tiles that pair a fill
  // with their -content "Sx" swatch read better as two rounded squares.
  const single = !content;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative flex gap-1 ${single ? 'w-full' : ''}`}>
        <SwatchInput fill={color} onChange={onChange} ariaLabel={label} warn={warn} wide={single} />
        {content ? (
          <SwatchInput
            fill={color}
            ink={content.color}
            onChange={content.onChange}
            ariaLabel={`${label} text`}
          />
        ) : null}
        {onClear && canClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Discard unsaved ${label} change`}
            title="Discard unsaved change"
            className="absolute -top-1.5 -right-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-0.5 shadow-sm"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        ) : null}
      </div>
      <span className="text-center text-[11px] leading-tight text-[var(--color-text-secondary)]">
        {label}
      </span>
    </div>
  );
}

// One clickable swatch backed by the OS colour picker. With `ink`, it renders
// the "Sx" mark in that colour over the fill (previewing the text colour) and
// edits the -content colour; otherwise it edits the fill.
function SwatchInput({
  fill,
  ink,
  onChange,
  ariaLabel,
  warn,
  wide,
}: {
  fill: string;
  ink?: string;
  onChange: (color: string) => void;
  ariaLabel: string;
  warn?: boolean;
  // Fill the column as a rounded rectangle (single fill-only tiles) instead of
  // the default fixed rounded square.
  wide?: boolean;
}) {
  return (
    <label
      className={`relative flex h-14 cursor-pointer items-center justify-center overflow-hidden rounded-lg border ${
        wide ? 'w-full min-w-0 flex-1' : 'w-14'
      } ${
        warn
          ? 'border-[var(--color-danger-text)] ring-1 ring-[var(--color-danger-text)]'
          : 'border-[var(--color-border-default)]'
      }`}
      style={{ backgroundColor: fill }}
    >
      {ink ? (
        <span className="text-base leading-none font-bold" style={{ color: ink }} aria-hidden>
          Sx
        </span>
      ) : null}
      <input
        type="color"
        value={toInputHex(ink ?? fill)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}

// Coerce any stored colour to the `#rrggbb` the native picker requires.
function toInputHex(v: string): string {
  const s = v.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return '#' + s.slice(1).replace(/./g, (ch) => ch + ch);
  return '#000000';
}

// A segmented control — the inline, all-options-visible replacement for a feel
// dropdown. Built from the sanctioned Button toggle pattern (soft = selected,
// ghost = not), wrapped in a bordered track so the set reads as one control. It
// wraps to a second row when the options don't fit, so it stays clean at any
// count or column width. `includeAuto` prepends an "Auto" chip mapping to
// INHERIT (clear the override → follow the theme preset).
function Segmented({
  label,
  help,
  value,
  options,
  onChange,
  includeAuto = false,
}: {
  label: string;
  help?: string;
  value: string;
  options: readonly { key: string; label: string }[];
  onChange: (key: string) => void;
  includeAuto?: boolean;
}) {
  const items = includeAuto ? [{ key: INHERIT, label: 'Auto' }, ...options] : options;
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1 rounded-md border border-[var(--color-border-default)] p-1"
      >
        {items.map((o) => {
          const active = value === o.key;
          return (
            <Button
              key={o.key}
              type="button"
              size="xs"
              role="radio"
              aria-checked={active}
              color={active ? 'primary' : 'neutral'}
              variant={active ? 'soft' : 'ghost'}
              onClick={() => onChange(o.key)}
            >
              {o.label}
            </Button>
          );
        })}
      </div>
      {help ? <p className="text-xs text-[var(--color-text-muted)]">{help}</p> : null}
    </div>
  );
}

// Per-site social links editor (docs/49 "full per-site brand"). An ordered list
// of { platform, url }; a known platform drives the storefront icon, "Other"
// carries a free-text label. Mirrors the Settings → General editor it replaces,
// but writes to the active SITE (the parent debounces the save).
const KNOWN_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourbrand' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourbrand' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/yourbrand' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourbrand' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourbrand' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourbrand' },
  { key: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/yourbrand' },
  { key: 'threads', label: 'Threads', placeholder: 'https://threads.com/@yourbrand' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/15551234567' },
  { key: 'bluesky', label: 'Bluesky', placeholder: 'https://bsky.app/profile/you.bsky.social' },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'https://snapchat.com/add/yourbrand' },
] as const;

const OTHER_PLATFORM = '__other__';
const KNOWN_KEYS = new Set<string>(KNOWN_PLATFORMS.map((p) => p.key));

function placeholderFor(platform: string): string {
  return KNOWN_PLATFORMS.find((p) => p.key === platform)?.placeholder ?? 'https://…';
}

function SocialLinksEditor({
  socials,
  setSocials,
}: {
  socials: SocialLink[];
  setSocials: React.Dispatch<React.SetStateAction<SocialLink[]>>;
}) {
  const usedKnown = new Set(socials.map((r) => r.platform).filter((p) => KNOWN_KEYS.has(p)));

  const addRow = () =>
    setSocials((rows) => {
      const used = new Set(rows.map((r) => r.platform).filter((p) => KNOWN_KEYS.has(p)));
      const next = KNOWN_PLATFORMS.find((p) => !used.has(p.key));
      return [...rows, { platform: next ? next.key : '', url: '' }];
    });
  const removeRow = (index: number) => setSocials((rows) => rows.filter((_, i) => i !== index));
  const patchRow = (index: number, patch: Partial<SocialLink>) =>
    setSocials((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-2.5">
      {socials.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">No links yet.</p>
      ) : (
        socials.map((row, index) => {
          const known = KNOWN_KEYS.has(row.platform);
          const selectValue = known ? row.platform : OTHER_PLATFORM;
          const options = KNOWN_PLATFORMS.filter(
            (p) => p.key === row.platform || !usedKnown.has(p.key)
          );
          return (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-md border border-[var(--color-border-default)] p-2.5 sm:flex-row sm:items-start"
            >
              <div className="flex flex-col gap-2 sm:w-36">
                <NativeSelect
                  aria-label="Platform"
                  value={selectValue}
                  onChange={(e) =>
                    patchRow(index, {
                      platform: e.target.value === OTHER_PLATFORM ? '' : e.target.value,
                    })
                  }
                >
                  {options.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                  <option value={OTHER_PLATFORM}>Other…</option>
                </NativeSelect>
                {selectValue === OTHER_PLATFORM ? (
                  <Input
                    aria-label="Custom platform label"
                    value={row.platform}
                    onChange={(e) => patchRow(index, { platform: e.target.value })}
                    placeholder="Label (e.g. Discord)"
                  />
                ) : null}
              </div>
              <Input
                aria-label="Link URL"
                type="url"
                inputMode="url"
                autoComplete="off"
                className="flex-1"
                value={row.url}
                onChange={(e) => patchRow(index, { url: e.target.value })}
                placeholder={placeholderFor(row.platform)}
              />
              <Button
                type="button"
                variant="ghost"
                color="neutral"
                size="sm"
                aria-label="Remove link"
                onClick={() => removeRow(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })
      )}
      <div>
        <Button
          type="button"
          variant="soft"
          color="neutral"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={addRow}
        >
          Add link
        </Button>
      </div>
    </div>
  );
}
