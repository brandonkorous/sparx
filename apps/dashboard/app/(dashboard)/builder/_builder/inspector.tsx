'use client';

// The inspector — the right pane. Each editable group is a collapsible CARD
// (icon + title + a one-line summary of its current values), presented for a
// business owner rather than a developer: content-first, plain language, no
// leaked internals (recipe / class / cardinality jargon). For a selected node,
// top to bottom:
//   1. Content  — what the block SAYS and where it goes: its own props (heading
//                 text, button label/link, …) plus the data source — a friendly
//                 "Type it in / Pull from your data" toggle (the binding picker).
//   2. Style    — Color + Emphasis (the recipe axes), written to `node.class`.
//   3. Layout   — containers only: Arrange as Row/Stack/Grid, spacing, alignment.
//   4. Motion   — how the block enters (collapsed by default).
//   5. Advanced — power-user box controls (size, display, position, corners,
//                 border, shadow, inner/outer spacing) + the raw `class` escape
//                 hatch (collapsed).
//
// Color/Layout/etc. still write Tailwind-native `class` utilities (docs/61); only
// the PRESENTATION changed here — the underlying control model is unchanged.

import * as React from 'react';
import {
  Box,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Crosshair,
  Database,
  ExternalLink,
  FileText,
  LayoutGrid,
  Link2,
  Mail,
  Maximize2,
  Palette,
  Plus,
  Search,
  Sparkles,
  SlidersHorizontal,
  Square,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Input, NativeSelect, Switch, Textarea, cn, useConfirm } from '@sparx/ui';
import {
  REF_KEY,
  bindSlotKey,
  collectBindingSlots,
  customKeyOf,
  isCustomType,
  isPropSlot,
  parseNavLinks,
  readComponentRef,
  type BindingCatalog,
  type ComponentDto,
  type MergeTag,
  type NavLink,
  type PropSpec as ComponentPropSpec,
} from '@sparx/builder-schemas';

import { CREATABLE_KINDS, type CreatableType } from './field-kinds';
import { TokenInput, TokenTextarea } from './token-field';

import { SeoScoreChip } from '@/components/seo/seo-score';

import { type BuilderNode, type PageSeo } from './model';
import { bindGroups, bindHint, itemBindPaths, type ScopeInfo } from './binding-catalog';
import { compatibleRetypeTargets, getDef, type ComponentDef, type EditorSurface } from './registry';
import { IconPicker } from './icon-picker';
import { ProseControl } from './prose-control';
import {
  ALIGN_ITEMS_CONTROL,
  ARRANGEMENT_CONTEXTS,
  ASPECT_CONTROL,
  BORDER_CONTROL,
  BORDER_COLOR_CONTROL,
  BORDER_STYLE_CONTROL,
  BOX_DISPLAY_CONTROL,
  COLOR_CONTROL,
  DIRECTION_CONTROL,
  DISPLAY_CONTROL,
  FONT_FAMILY_CONTROL,
  FONT_SIZE_CONTROL,
  FONT_WEIGHT_CONTROL,
  GAP_CONTROL,
  JUSTIFY_CONTROL,
  LEADING_CONTROL,
  OVERFLOW_CONTROL,
  POSITION_CONTROL,
  RADIUS_CONTROL,
  SHADOW_CONTROL,
  SKIN_CONTEXTS,
  STYLE_CONTROLS,
  STAGGER_CONTROL,
  TEXT_ALIGN_CONTROL,
  TEXT_CASE_CONTROL,
  TEXT_COLOR_CONTROL,
  TRACKING_CONTROL,
  TRANSITION_CONTROL,
  VARIANT_CONTROL,
  Z_INDEX_CONTROL,
  MOTION_ENTRANCES,
  MOTION_TRIGGERS,
  activeValue,
  applyValue,
  applyValueGroup,
  applyMotion,
  contextPrefix,
  ensureArchetypeDefaults,
  lengthDisplay,
  lengthSuffix,
  readMotion,
  readValueGroup,
  skinControlsFor,
  type ClassControl,
  type MotionState,
  type StyleContext,
} from './class-controls';

// ── Shared controls ──────────────────────────────────────────────────────────

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="bx-field">
      <span className="bx-field__label">{label}</span>
      {children}
      {hint ? <span className="bx-field__hint">{hint}</span> : null}
    </label>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="bx-seg" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="bx-seg__btn"
          data-on={o.value === value}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// A collapsible section card (docs UI redesign): an icon chip + title + a
// one-line `summary` of the group's current values, shown only while collapsed
// so you can see what's inside without opening it. Native <details> for free
// keyboard + a11y; `open` is synced through onToggle so React doesn't fight the
// browser's own toggling. The everyday cards default open; rarer ones (Motion,
// Advanced) pass `defaultOpen={false}`.
function Card({
  icon: Icon,
  title,
  summary,
  caption,
  defaultOpen = true,
  muted = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** Current-value preview shown while collapsed (e.g. "Indigo · Soft"). */
  summary?: string;
  /** Optional lead text inside the open body. */
  caption?: string;
  defaultOpen?: boolean;
  /** Quieter icon treatment for the Advanced card. */
  muted?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <details
      className={cn('bx-card', muted && 'bx-card--muted')}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="bx-card__head">
        <span className="bx-card__icon">
          <Icon aria-hidden />
        </span>
        <span className="bx-card__titles">
          <span className="bx-card__title">{title}</span>
          {summary ? <span className="bx-card__summary">{summary}</span> : null}
        </span>
        <ChevronDown className="bx-card__chev" aria-hidden />
      </summary>
      <div className="bx-card__body">
        {caption ? <p className="bx-card__caption">{caption}</p> : null}
        {children}
      </div>
    </details>
  );
}

// The settings-panel header (no-selection view) — same identity treatment as a
// selected node: a tinted icon + title + plain subtitle, in place of the old
// monospace kind badge.
function PanelHead({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="bx-ins-head">
      <div className="bx-ins-head__row">
        <span className="bx-ins-head__icon">
          <Icon aria-hidden />
        </span>
        <div className="bx-ins-head__titles">
          <h3>{title}</h3>
          <span className="bx-ins-head__sub">{subtitle}</span>
        </div>
      </div>
    </header>
  );
}

// ── Summaries (the collapsed-card value preview) ───────────────────────────────
// Plain-language one-liners derived from the node's current class / props, so a
// closed card still tells you what it holds.

/** The label for a control's active value on a node (e.g. Color → "Indigo"), or
 *  null when unset. */
function activeLabel(node: BuilderNode, control: ClassControl): string | null {
  const v = activeValue(node.class, control);
  return v ? (control.options.find((o) => o.value === v)?.label ?? null) : null;
}

function styleSummary(node: BuilderNode): string {
  const parts = [activeLabel(node, COLOR_CONTROL), activeLabel(node, VARIANT_CONTROL)].filter(
    Boolean
  );
  return parts.length ? parts.join(' · ') : 'Default';
}

function layoutSummary(node: BuilderNode): string {
  const arrange = ARRANGE_OPTIONS.find((o) => o.value === readArrangeAs(node.class))?.label;
  const spacing = activeLabel(node, JUSTIFY_CONTROL);
  return [arrange, spacing].filter(Boolean).join(' · ') || 'Default';
}

function motionSummary(node: BuilderNode): string {
  const m = readMotion(node.class);
  if (!m.entrance) return 'None';
  return MOTION_ENTRANCES.find((o) => o.value === m.entrance)?.label ?? 'On';
}

function contentSummary(node: BuilderNode, def: ComponentDef): string {
  if (node.binding?.path) return 'From your data';
  // The first text-ish prop makes the most recognizable preview.
  for (const spec of def.props) {
    if (spec.control === 'text' || spec.control === 'textarea') {
      const v = node.props[spec.key];
      if (typeof v === 'string' && v.trim()) {
        return v.length > 32 ? `${v.slice(0, 32)}…` : v;
      }
    }
  }
  return def.bindable ? 'Typed in' : 'No content yet';
}

// ── Arrange-as (Row / Stack / Grid) ────────────────────────────────────────────
// One friendly control over the two underlying class groups: display (flex|grid)
// + flex direction. Row = flex-row, Stack = flex-col, Grid = grid. Reading picks
// Grid when display is grid, else the flex direction (defaulting to Stack). This
// is purely a presentation merge — it writes the same DISPLAY_CONTROL /
// DIRECTION_CONTROL tokens the old two selects did.

const ARRANGE_OPTIONS: { value: 'row' | 'stack' | 'grid'; label: string }[] = [
  { value: 'row', label: 'Row' },
  { value: 'stack', label: 'Stack' },
  { value: 'grid', label: 'Grid' },
];

function readArrangeAs(classStr: string | undefined, prefix = ''): 'row' | 'stack' | 'grid' {
  if (activeValue(classStr, DISPLAY_CONTROL, prefix) === 'grid') return 'grid';
  return activeValue(classStr, DIRECTION_CONTROL, prefix) === 'row' ? 'row' : 'stack';
}

/** Apply an Arrange-as choice → the new class string (sets display + direction at
 *  the given responsive `prefix`). */
function applyArrangeAs(
  classStr: string | undefined,
  value: 'row' | 'stack' | 'grid',
  prefix = ''
): string {
  if (value === 'grid') {
    // Grid: set display:grid and clear the (now meaningless) flex direction.
    return applyValue(
      applyValue(classStr, DISPLAY_CONTROL, 'grid', prefix),
      DIRECTION_CONTROL,
      null,
      prefix
    );
  }
  return applyValue(
    applyValue(classStr, DISPLAY_CONTROL, 'flex', prefix),
    DIRECTION_CONTROL,
    value === 'row' ? 'row' : 'col',
    prefix
  );
}

// Lenient normalization for the nav-link EDITOR — keeps empty-label rows (so a
// row doesn't vanish mid-edit) and converts a legacy hand-typed string into rows
// on first edit. The storefront renderer's coerceNavLinks does the strict pass
// (dropping empties); this is the editable mirror.
function editableNavRows(value: unknown): NavLink[] {
  if (Array.isArray(value)) {
    return value.map((it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      const href =
        typeof o.href === 'string' && o.href.length > 0
          ? o.href
          : typeof o.url === 'string'
            ? o.url
            : '';
      return {
        label: typeof o.label === 'string' ? o.label : '',
        href,
        openInNewTab: o.openInNewTab === true || o.open_in_new_tab === true,
      };
    });
  }
  if (typeof value === 'string' && value.trim()) return parseNavLinks(value);
  return [];
}

// The NavMenu node's link editor (docs/57). Site navigation is Builder-owned site
// chrome, authored here per site — label + target + new-tab, with reorder and
// remove. Fully controlled: it normalizes the stored prop into editable rows and
// writes the whole array back on every change (the editor autosaves, like the
// textarea control). dnd reorder is a polish follow-on; up/down is functional.
function NavLinksControl({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (links: NavLink[]) => void;
}) {
  const confirm = useConfirm();
  const rows = editableNavRows(value);

  const patch = (i: number, p: Partial<NavLink>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const add = () => onChange([...rows, { label: '', href: '/' }]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    onChange(next);
  };
  const remove = async (i: number) => {
    const current = rows[i]?.label;
    const name = current && current.length > 0 ? current : 'this link';
    const ok = await confirm({
      title: `Remove “${name}”?`,
      description: 'Removes the navigation link. You can add it back manually.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) onChange(rows.filter((_, idx) => idx !== i));
  };

  return (
    <div className="bx-navlinks">
      {rows.map((row, i) => (
        <div key={i} className="bx-navlinks__row">
          <Input
            value={row.label}
            placeholder="Label"
            onChange={(e) => patch(i, { label: e.target.value })}
          />
          <Input
            value={row.href}
            placeholder="/page or https://…"
            onChange={(e) => patch(i, { href: e.target.value })}
          />
          <div className="bx-navlinks__foot">
            <span className="bx-navlinks__newtab">
              <Switch
                checked={Boolean(row.openInNewTab)}
                onCheckedChange={(v) => patch(i, { openInNewTab: v })}
                aria-label="Open this link in a new tab"
              />
              New tab
            </span>
            <div className="bx-navlinks__actions">
              <button
                type="button"
                className="bx-navlinks__icon"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ChevronUp aria-hidden />
              </button>
              <button
                type="button"
                className="bx-navlinks__icon"
                aria-label="Move down"
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
              >
                <ChevronDown aria-hidden />
              </button>
              <button
                type="button"
                className="bx-navlinks__icon"
                aria-label="Remove link"
                onClick={() => void remove(i)}
              >
                <X aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="bx-navlinks__add" onClick={add}>
        <Plus aria-hidden /> Add link
      </button>
    </div>
  );
}

// Change a node's type in place (Card→Section, Button→Badge). Offers the
// same-kind targets valid on this surface; the current type sits at the top,
// disabled. The editor's onRetype carries name / box / binding / recipe across and
// confirms if the change would drop nested items (registry.retypeNode).
function RetypeControl({
  def,
  surface,
  onRetype,
}: {
  def: ComponentDef;
  surface: EditorSurface;
  onRetype: (targetType: string) => void;
}) {
  const targets = compatibleRetypeTargets(def, surface);
  if (targets.length === 0) return null;
  return (
    <NativeSelect
      size="sm"
      className="bx-ins-retype"
      aria-label="Change block type"
      value={def.type}
      onChange={(e) => {
        if (e.target.value !== def.type) onRetype(e.target.value);
      }}
    >
      <option value={def.type} disabled>
        {def.label} — change to…
      </option>
      {targets.map((t) => (
        <option key={t.type} value={t.type}>
          {t.label}
        </option>
      ))}
    </NativeSelect>
  );
}

// One recipe-axis selector (Color / Variant / Size). Writing a value also
// backfills the node's archetype base + defaults for any unset axis, so styling a
// component authored before class-first (no `sf-btn` base) doesn't collapse it to
// a bare element (docs/47). Shared by the everyday Style panel and the collapsed
// Advanced panel so both write identically.
function StyleControlField({
  node,
  def,
  control,
  prefix = '',
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  control: ClassControl;
  /** The context layer this control writes into (`hover:`, `@lg:`, …); '' = base. */
  prefix?: string;
  onClass: (value: string) => void;
}) {
  return (
    <Field label={control.label}>
      <NativeSelect
        size="sm"
        value={activeValue(node.class, control, prefix) ?? ''}
        onChange={(e) =>
          onClass(
            ensureArchetypeDefaults(
              applyValue(node.class, control, e.target.value || null, prefix),
              def.defaults.class
            )
          )
        }
      >
        {/* Empty = clear the group → inherit the archetype's own value. Distinct
            from an explicit "None"/"Square"/"Flat" option, which force-overrides
            it (the util-box classes win in the utilities layer). */}
        <option value="">Default</option>
        {control.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

// Which responsive / state / theme LAYER the card's controls write into (docs/61
// §5.2 / §7). Picking a screen size or "Hover" re-targets every control below it
// at that variant; "Every screen" is the default look. Kept as a quiet pill so it
// reads as a secondary control, not a primary one. Grouped so the (up to 11)
// options stay scannable.
function ContextSelect({
  contexts,
  value,
  onChange,
}: {
  contexts: StyleContext[];
  value: string;
  onChange: (v: string) => void;
}) {
  const states = contexts.filter((c) => ['hover', 'focus', 'active'].includes(c.value));
  const dark = contexts.find((c) => c.value === 'dark');
  const breakpoints = contexts.filter((c) => c.prefix.startsWith('@'));
  const active = contexts.find((c) => c.value === value);
  return (
    <div className="bx-resp">
      <Field label="Editing for">
        <NativeSelect size="sm" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="base">Every screen</option>
          {states.length ? (
            <optgroup label="When">
              {states.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          {dark ? (
            <optgroup label="Theme">
              <option value={dark.value}>Dark mode</option>
            </optgroup>
          ) : null}
          {breakpoints.length ? (
            <optgroup label="Screen size">
              {breakpoints.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </NativeSelect>
      </Field>
      <p className="bx-resp__hint">
        {value === 'base'
          ? 'Applies everywhere by default.'
          : `Only changes ${active?.label}. Everything else keeps its normal look.`}
      </p>
    </div>
  );
}

// How a CONTAINER arranges its children (docs/61 §5.2): the page-builder's
// structural surface. The friendly "Arrange as Row / Stack / Grid" merges the
// underlying display + direction class groups; Grid then reveals Columns. Gap /
// alignment follow. Padding lives in the Spacing card (so it isn't offered twice).
// Responsive via the "Editing for" pill — pick a screen size to set that layer
// (`@lg:grid-cols-3`). Containers only.
// Grid columns — fluid by default rather than a hardcoded breakpoint ramp.
// "Auto-fit (fluid)" emits `grid-cols-[repeat(auto-fit,minmax(<min>,1fr))]`: the
// grid fits as many columns of at least <min> as the row allows and wraps the rest
// — no `@2xl:grid-cols-2 @4xl:grid-cols-4` to maintain. Fixed counts (1–6) are
// still available; picking a fluid mode at the base layer clears any hardcoded
// responsive ramp so it actually takes effect. Per-breakpoint counts are still
// possible via the "Editing for" pill (writes that layer only).
function ColumnsField({
  node,
  prefix,
  commit,
}: {
  node: BuilderNode;
  prefix: string;
  commit: (cls: string) => void;
}) {
  const current = readValueGroup(node.class, 'grid-cols', prefix);
  const kind = current?.startsWith('[repeat(auto-fit')
    ? 'auto-fit'
    : current?.startsWith('[repeat(auto-fill')
      ? 'auto-fill'
      : null;
  const fluid = kind !== null;
  const mode = kind ?? current ?? '';
  const minMatch = current ? /minmax\(([^,]+),\s*1fr\)/.exec(current) : null;
  const minSeed = minMatch ? minMatch[1]!.replace(/_/g, ' ') : '16rem';
  const [minText, setMinText] = React.useState(minSeed);
  React.useEffect(() => setMinText(minSeed), [minSeed]);

  // The hardcoded responsive ramp (seeded at @2xl/@4xl) lives in these layers.
  const bpPrefixes = ARRANGEMENT_CONTEXTS.filter((c) => c.prefix.startsWith('@')).map(
    (c) => c.prefix
  );
  const fluidSuffix = (k: 'auto-fit' | 'auto-fill', min: string): string => {
    const t = min.trim();
    const m = /^\d+(\.\d+)?$/.test(t) ? `${t}px` : t.replace(/\s+/g, '');
    return `[repeat(${k},minmax(${m || '16rem'},1fr))]`;
  };
  const write = (suffix: string | null, clearRamp: boolean) => {
    let c = node.class ?? '';
    if (clearRamp) bpPrefixes.forEach((bp) => (c = applyValueGroup(c, 'grid-cols', null, bp)));
    commit(applyValueGroup(c, 'grid-cols', suffix, prefix));
  };

  return (
    <div className="bx-field">
      <span className="bx-field__label">Columns</span>
      <NativeSelect
        size="sm"
        value={mode}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'auto-fit' || v === 'auto-fill') write(fluidSuffix(v, minText), prefix === '');
          else write(v || null, false);
        }}
      >
        <option value="">—</option>
        <option value="auto-fit">Auto-fit (fluid)</option>
        <option value="auto-fill">Auto-fill</option>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <option key={n} value={String(n)}>
            {n}
          </option>
        ))}
      </NativeSelect>
      {fluid ? (
        <>
          <Input
            size="sm"
            value={minText}
            placeholder="Min column width — e.g. 16rem or 240px"
            onChange={(e) => setMinText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            onBlur={() => write(fluidSuffix(kind ?? 'auto-fit', minText), false)}
          />
          <span className="bx-field__hint">
            Columns fill the row and wrap as it narrows — no fixed breakpoints.
          </span>
        </>
      ) : null}
    </div>
  );
}

function LayoutCard({
  node,
  def,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
}) {
  const [ctx, setCtx] = React.useState('base');
  const prefix = contextPrefix(ARRANGEMENT_CONTEXTS, ctx);
  const arrange = readArrangeAs(node.class, prefix);
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  const setArrange = (v: 'row' | 'stack' | 'grid') => commit(applyArrangeAs(node.class, v, prefix));
  // Columns get the richer fluid control (below); gap/alignment are simple enums.
  const detailControls = [GAP_CONTROL, JUSTIFY_CONTROL, ALIGN_ITEMS_CONTROL];
  return (
    <Card
      icon={LayoutGrid}
      title="Layout"
      summary={layoutSummary(node)}
      caption="How the blocks inside line up. Pick a screen size to make it responsive."
    >
      <ContextSelect contexts={ARRANGEMENT_CONTEXTS} value={ctx} onChange={setCtx} />
      <Field label="Arrange as">
        <Segmented value={arrange} options={ARRANGE_OPTIONS} onChange={setArrange} />
      </Field>
      {arrange === 'grid' ? <ColumnsField node={node} prefix={prefix} commit={commit} /> : null}
      {detailControls.map((control) => (
        <StyleControlField
          key={control.id}
          node={node}
          def={def}
          control={control}
          prefix={prefix}
          onClass={onClass}
        />
      ))}
    </Card>
  );
}

// The component builder's full Appearance surface (docs/61 §5.2, Phase 3): free
// background / text color, type, corners / border / shadow, and motion — each
// writable at a chosen context (a screen size, an interaction state, or Dark).
// Gated to the component builder; on the page builder a component skins via its
// recipe (the Style panel), never per-instance here.
function AppearanceCard({
  node,
  def,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
}) {
  const [ctx, setCtx] = React.useState('base');
  const prefix = contextPrefix(SKIN_CONTEXTS, ctx);
  const controls = skinControlsFor();
  return (
    <Card
      icon={Palette}
      title="Appearance"
      caption="Colors, type, edges, and motion. Pick a context to style that layer — a screen size, a state like Hover, or Dark."
    >
      <ContextSelect contexts={SKIN_CONTEXTS} value={ctx} onChange={setCtx} />
      {controls.map((control) => (
        <StyleControlField
          key={control.id}
          node={node}
          def={def}
          control={control}
          prefix={prefix}
          onClass={onClass}
        />
      ))}
    </Card>
  );
}

// Motion (docs/61 §9): how an element ENTERS — what plays, and when. Available on
// BOTH surfaces (an entrance is safe-because-visible like arrangement, not silent
// re-skin — §5.2). Scroll plays it as the reader reaches it (the MotionController
// island); load/hover are pure CSS. Containers also get a child Stagger. Reduced
// motion is always respected (REDUCED_MOTION_CSS), so there's no a11y opt-in.
function MotionCard({
  node,
  def,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
}) {
  const motion = readMotion(node.class);
  const setMotion = (next: MotionState) =>
    onClass(ensureArchetypeDefaults(applyMotion(node.class, next), def.defaults.class));
  return (
    <Card
      icon={Sparkles}
      title="Motion"
      summary={motionSummary(node)}
      defaultOpen={false}
      caption="How this block appears. “On scroll” plays it as the reader reaches it. Reduced motion is always respected."
    >
      <Field label="When it appears">
        <NativeSelect
          size="sm"
          value={motion.entrance ?? ''}
          onChange={(e) => setMotion({ entrance: e.target.value || null, trigger: motion.trigger })}
        >
          <option value="">Nothing — just show it</option>
          {MOTION_ENTRANCES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {motion.entrance ? (
        <Field label="Play it">
          <NativeSelect
            size="sm"
            value={motion.trigger}
            onChange={(e) => setMotion({ entrance: motion.entrance, trigger: e.target.value })}
          >
            {MOTION_TRIGGERS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      {def.kind === 'container' ? (
        <StyleControlField node={node} def={def} control={STAGGER_CONTROL} onClass={onClass} />
      ) : null}
    </Card>
  );
}

// ── Power-user value controls ──────────────────────────────────────────────────
// Beyond the enum selects, the style sections need OPEN-ENDED value inputs (a
// scale step, a keyword, or an arbitrary `[20px]`). These primitives read/write
// the Tailwind value GROUPS via readValueGroup/applyValueGroup, and commit through
// `commit` (which the card wraps with ensureArchetypeDefaults, so styling a node
// never collapses its recipe base).

interface LengthPreset {
  label: string;
  suffix: string;
}

// A length value: a named preset + a "Custom…" escape to any CSS value. Bare
// numbers stay Tailwind scale steps (4); units/percents become arbitrary
// (20px → top-[20px]). The custom field commits on blur, like the app's other
// text inputs, so typing doesn't round-trip per keystroke.
function LengthField({
  label,
  node,
  prefix,
  presets,
  hint,
  commit,
}: {
  label: string;
  node: BuilderNode;
  prefix: string;
  presets: LengthPreset[];
  hint?: string;
  commit: (cls: string) => void;
}) {
  const current = readValueGroup(node.class, prefix);
  const isPreset = presets.some((p) => p.suffix === current);
  const [forceCustom, setForceCustom] = React.useState(false);
  const custom = forceCustom || (current !== null && !isPreset);
  const [text, setText] = React.useState(lengthDisplay(current));
  React.useEffect(() => setText(lengthDisplay(current)), [current, custom]);

  return (
    <div className="bx-field">
      <span className="bx-field__label">{label}</span>
      <NativeSelect
        size="sm"
        value={custom ? '__custom' : (current ?? '')}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__custom') setForceCustom(true);
          else {
            setForceCustom(false);
            commit(applyValueGroup(node.class, prefix, v || null));
          }
        }}
      >
        <option value="">—</option>
        {presets.map((p) => (
          <option key={p.suffix} value={p.suffix}>
            {p.label}
          </option>
        ))}
        <option value="__custom">Custom…</option>
      </NativeSelect>
      {custom ? (
        <Input
          size="sm"
          value={text}
          placeholder="e.g. 320px or 50%"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={() => commit(applyValueGroup(node.class, prefix, lengthSuffix(text)))}
        />
      ) : null}
      {hint ? <span className="bx-field__hint">{hint}</span> : null}
    </div>
  );
}

// One side of the box-model widget — a small value field committing on blur.
function SideInput({
  value,
  placeholder,
  onCommit,
}: {
  value: string | null;
  placeholder: string;
  onCommit: (suffix: string | null) => void;
}) {
  const [text, setText] = React.useState(lengthDisplay(value));
  React.useEffect(() => setText(lengthDisplay(value)), [value]);
  return (
    <input
      className="bx-box__side"
      value={text}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={() => onCommit(lengthSuffix(text))}
    />
  );
}

// The 4-side box-model widget (padding / margin) with a link-all toggle. Linked
// writes the shorthand (`p-4`) and clears the per-side tokens; unlinked writes the
// per-side tokens (`pt-4` …) and clears the shorthand — so the two never fight.
function BoxSidesField({
  label,
  node,
  shorthand,
  sides,
  hint,
  commit,
}: {
  label: string;
  node: BuilderNode;
  shorthand: string;
  /** [top, right, bottom, left] prefixes, e.g. ['pt','pr','pb','pl']. */
  sides: [string, string, string, string];
  hint?: string;
  commit: (cls: string) => void;
}) {
  const shVal = readValueGroup(node.class, shorthand);
  const sideVals = sides.map((s) => readValueGroup(node.class, s)) as [
    string | null,
    string | null,
    string | null,
    string | null,
  ];
  const anySide = sideVals.some((v) => v !== null);
  const [linked, setLinked] = React.useState(!anySide);
  const display = linked ? ([shVal, shVal, shVal, shVal] as const) : sideVals;

  const commitLinked = (suffix: string | null) => {
    let c = node.class ?? '';
    sides.forEach((s) => (c = applyValueGroup(c, s, null)));
    commit(applyValueGroup(c, shorthand, suffix));
  };
  const commitSide = (i: number, suffix: string | null) => {
    let c = applyValueGroup(node.class, shorthand, null);
    c = applyValueGroup(c, sides[i]!, suffix);
    commit(c);
  };
  const toggleLink = () => {
    let c = node.class ?? '';
    if (linked) {
      const v = shVal;
      c = applyValueGroup(c, shorthand, null);
      sides.forEach((s) => (c = applyValueGroup(c, s, v)));
      commit(c);
      setLinked(false);
    } else {
      const v = sideVals[0];
      sides.forEach((s) => (c = applyValueGroup(c, s, null)));
      commit(applyValueGroup(c, shorthand, v));
      setLinked(true);
    }
  };

  return (
    <div className="bx-field">
      <span className="bx-field__label">{label}</span>
      <div className="bx-box">
        <div className="bx-box__t">
          <SideInput
            key={`t${linked}`}
            value={display[0]}
            placeholder="Top"
            onCommit={(s) => (linked ? commitLinked(s) : commitSide(0, s))}
          />
        </div>
        <div className="bx-box__l">
          <SideInput
            key={`l${linked}`}
            value={display[3]}
            placeholder="Left"
            onCommit={(s) => (linked ? commitLinked(s) : commitSide(3, s))}
          />
        </div>
        <button
          type="button"
          className="bx-box__link"
          data-on={linked}
          aria-pressed={linked}
          title={linked ? 'Sides linked — edit one, all change' : 'Sides independent'}
          onClick={toggleLink}
        >
          <Link2 aria-hidden />
        </button>
        <div className="bx-box__r">
          <SideInput
            key={`r${linked}`}
            value={display[1]}
            placeholder="Right"
            onCommit={(s) => (linked ? commitLinked(s) : commitSide(1, s))}
          />
        </div>
        <div className="bx-box__b">
          <SideInput
            key={`b${linked}`}
            value={display[2]}
            placeholder="Bottom"
            onCommit={(s) => (linked ? commitLinked(s) : commitSide(2, s))}
          />
        </div>
      </div>
      {hint ? <span className="bx-field__hint">{hint}</span> : null}
    </div>
  );
}

// Opacity — a slider + live readout, on the Tailwind opacity scale (steps of 5).
// 100 clears the class (fully opaque is the default).
function OpacitySlider({ node, commit }: { node: BuilderNode; commit: (cls: string) => void }) {
  const raw = readValueGroup(node.class, 'opacity');
  const value = raw && /^\d+$/.test(raw) ? Number(raw) : 100;
  return (
    <div className="bx-field">
      <span className="bx-field__label">Opacity</span>
      <div className="bx-slider">
        <input
          className="bx-range"
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          aria-label="Opacity"
          onChange={(e) => {
            const n = Number(e.target.value);
            commit(applyValueGroup(node.class, 'opacity', n === 100 ? null : String(n)));
          }}
        />
        <output className="bx-slider__out">{value}%</output>
      </div>
    </div>
  );
}

// A nested disclosure inside a card (e.g. "Min & max" under Size) — keeps the
// less-common controls tucked without spawning another top-level card.
function Subgroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="bx-subgroup">
      <summary className="bx-subgroup__head">
        <span>{title}</span>
        <ChevronDown className="bx-subgroup__chev" aria-hidden />
      </summary>
      <div className="bx-subgroup__body">{children}</div>
    </details>
  );
}

// ── Length presets (curated common values; "Custom…" covers everything else) ────
const WIDTH_PRESETS: LengthPreset[] = [
  { label: 'Auto', suffix: 'auto' },
  { label: 'Full (100%)', suffix: 'full' },
  { label: 'Half', suffix: '1/2' },
  { label: 'Third', suffix: '1/3' },
  { label: 'Fit content', suffix: 'fit' },
];
const HEIGHT_PRESETS: LengthPreset[] = [
  { label: 'Auto', suffix: 'auto' },
  { label: 'Full (100%)', suffix: 'full' },
  { label: 'Screen', suffix: 'screen' },
];
const MINW_PRESETS: LengthPreset[] = [
  { label: 'None', suffix: '0' },
  { label: 'Full', suffix: 'full' },
];
const MAXW_PRESETS: LengthPreset[] = [
  { label: 'None (fill)', suffix: 'none' },
  { label: 'Site width', suffix: 'site' },
  { label: 'Prose (65ch)', suffix: 'prose' },
  { label: 'Small', suffix: 'sm' },
  { label: 'Medium', suffix: 'md' },
  { label: 'Large', suffix: 'lg' },
  { label: 'XL', suffix: 'xl' },
  { label: 'Screen', suffix: 'screen' },
];
const MINH_PRESETS: LengthPreset[] = [
  { label: 'None', suffix: '0' },
  { label: 'Full', suffix: 'full' },
  { label: 'Screen', suffix: 'screen' },
];
const MAXH_PRESETS: LengthPreset[] = [
  { label: 'None', suffix: 'none' },
  { label: 'Full', suffix: 'full' },
  { label: 'Screen', suffix: 'screen' },
];
const OFFSET_PRESETS: LengthPreset[] = [{ label: 'Edge (0)', suffix: '0' }];
const SCALE_PRESETS: LengthPreset[] = [
  { label: '90%', suffix: '90' },
  { label: '95%', suffix: '95' },
  { label: '100%', suffix: '100' },
  { label: '105%', suffix: '105' },
  { label: '110%', suffix: '110' },
];
const ROTATE_PRESETS: LengthPreset[] = [
  { label: '0°', suffix: '0' },
  { label: '3°', suffix: '3' },
  { label: '6°', suffix: '6' },
  { label: '12°', suffix: '12' },
  { label: '45°', suffix: '45' },
  { label: '90°', suffix: '90' },
];
const MOVE_PRESETS: LengthPreset[] = [{ label: 'None', suffix: '0' }];

// ── Section summaries (collapsed-card previews) ─────────────────────────────────
function sizeSummary(node: BuilderNode): string {
  const w = lengthDisplay(readValueGroup(node.class, 'w'));
  const h = lengthDisplay(readValueGroup(node.class, 'h'));
  return [w && `W ${w}`, h && `H ${h}`].filter(Boolean).join(' · ') || 'Auto';
}
function spacingSummary(node: BuilderNode): string {
  const p =
    readValueGroup(node.class, 'p') ??
    ['pt', 'pr', 'pb', 'pl'].map((s) => readValueGroup(node.class, s)).find(Boolean);
  const m =
    readValueGroup(node.class, 'm') ??
    ['mt', 'mr', 'mb', 'ml'].map((s) => readValueGroup(node.class, s)).find(Boolean);
  return [p && 'padding', m && 'margin'].filter(Boolean).join(' + ') || 'None';
}
function positionSummary(node: BuilderNode): string {
  return activeLabel(node, POSITION_CONTROL) ?? 'In flow';
}
function bordersSummary(node: BuilderNode): string {
  return (
    [activeLabel(node, BORDER_CONTROL), activeLabel(node, RADIUS_CONTROL)]
      .filter(Boolean)
      .join(' · ') || 'None'
  );
}
function typographySummary(node: BuilderNode): string {
  return (
    [activeLabel(node, FONT_SIZE_CONTROL), activeLabel(node, TEXT_ALIGN_CONTROL)]
      .filter(Boolean)
      .join(' · ') || 'Inherited'
  );
}

// ── Power-user style sections ───────────────────────────────────────────────────

// Size — width / height (preset + Custom), a Min & max reveal, aspect, overflow.
// Leaves also get Display (block/inline/hidden); a container's display is the
// Layout card's "Arrange as".
function SizeCard({
  node,
  def,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
}) {
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  return (
    <Card icon={Maximize2} title="Size" summary={sizeSummary(node)} defaultOpen={false}>
      {def.kind === 'leaf' ? (
        <StyleControlField node={node} def={def} control={BOX_DISPLAY_CONTROL} onClass={onClass} />
      ) : null}
      <div className="bx-row2">
        <LengthField label="Width" node={node} prefix="w" presets={WIDTH_PRESETS} commit={commit} />
        <LengthField
          label="Height"
          node={node}
          prefix="h"
          presets={HEIGHT_PRESETS}
          commit={commit}
        />
      </div>
      <Subgroup title="Min & max">
        <div className="bx-row2">
          <LengthField
            label="Min width"
            node={node}
            prefix="min-w"
            presets={MINW_PRESETS}
            commit={commit}
          />
          <LengthField
            label="Max width"
            node={node}
            prefix="max-w"
            presets={MAXW_PRESETS}
            commit={commit}
          />
        </div>
        <div className="bx-row2">
          <LengthField
            label="Min height"
            node={node}
            prefix="min-h"
            presets={MINH_PRESETS}
            commit={commit}
          />
          <LengthField
            label="Max height"
            node={node}
            prefix="max-h"
            presets={MAXH_PRESETS}
            commit={commit}
          />
        </div>
      </Subgroup>
      <div className="bx-row2">
        <StyleControlField node={node} def={def} control={ASPECT_CONTROL} onClass={onClass} />
        <StyleControlField node={node} def={def} control={OVERFLOW_CONTROL} onClass={onClass} />
      </div>
    </Card>
  );
}

// Spacing — padding (inner) + margin (outer) as 4-side box-model widgets.
function SpacingCard({
  node,
  def,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
}) {
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  return (
    <Card icon={Box} title="Spacing" summary={spacingSummary(node)} defaultOpen={false}>
      <BoxSidesField
        label="Inner spacing (padding)"
        node={node}
        shorthand="p"
        sides={['pt', 'pr', 'pb', 'pl']}
        hint="A step (4 = 1rem) or a value (16px). Link applies one value to all sides."
        commit={commit}
      />
      <BoxSidesField
        label="Outer spacing (margin)"
        node={node}
        shorthand="m"
        sides={['mt', 'mr', 'mb', 'ml']}
        commit={commit}
      />
    </Card>
  );
}

// Position — static/relative/absolute/sticky, cascading to offsets + layer when
// not in normal flow (the dependency the discipline expects).
function PositionCard({
  node,
  def,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
}) {
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  const positioned = activeValue(node.class, POSITION_CONTROL) !== null;
  return (
    <Card icon={Crosshair} title="Position" summary={positionSummary(node)} defaultOpen={false}>
      <StyleControlField node={node} def={def} control={POSITION_CONTROL} onClass={onClass} />
      {positioned ? (
        <div className="bx-reveal">
          <span className="bx-field__label">Offsets</span>
          <div className="bx-row2">
            <LengthField
              label="Top"
              node={node}
              prefix="top"
              presets={OFFSET_PRESETS}
              commit={commit}
            />
            <LengthField
              label="Right"
              node={node}
              prefix="right"
              presets={OFFSET_PRESETS}
              commit={commit}
            />
          </div>
          <div className="bx-row2">
            <LengthField
              label="Bottom"
              node={node}
              prefix="bottom"
              presets={OFFSET_PRESETS}
              commit={commit}
            />
            <LengthField
              label="Left"
              node={node}
              prefix="left"
              presets={OFFSET_PRESETS}
              commit={commit}
            />
          </div>
          <StyleControlField node={node} def={def} control={Z_INDEX_CONTROL} onClass={onClass} />
        </div>
      ) : null}
    </Card>
  );
}

// Borders — width / style / color / corners. Page builder only (the component
// builder's Appearance card already owns the full skin set).
function BordersCard({
  node,
  def,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
}) {
  return (
    <Card icon={Square} title="Borders" summary={bordersSummary(node)} defaultOpen={false}>
      <div className="bx-row2">
        <StyleControlField node={node} def={def} control={BORDER_CONTROL} onClass={onClass} />
        <StyleControlField node={node} def={def} control={BORDER_STYLE_CONTROL} onClass={onClass} />
      </div>
      <StyleControlField node={node} def={def} control={BORDER_COLOR_CONTROL} onClass={onClass} />
      <StyleControlField node={node} def={def} control={RADIUS_CONTROL} onClass={onClass} />
    </Card>
  );
}

// Effects — opacity, shadow, transform (scale / rotate / move), transition. Page
// builder only (skin lives in the component builder's Appearance card).
// Style — the everyday "how it looks" card: the recipe axes (Color + Emphasis),
// then the effects (opacity / shadow / transform / transition). `showEffects` is
// off in the component builder, whose Appearance card already owns the full skin
// set (with responsive/state layers) — so they aren't offered twice.
function StyleCard({
  node,
  def,
  onClass,
  showEffects,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
  showEffects: boolean;
}) {
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  return (
    <Card icon={Palette} title="Style" summary={styleSummary(node)}>
      {STYLE_CONTROLS.map((control) => (
        <StyleControlField
          key={control.id}
          node={node}
          def={def}
          control={control}
          onClass={onClass}
        />
      ))}
      {showEffects ? (
        <>
          <OpacitySlider node={node} commit={commit} />
          <StyleControlField node={node} def={def} control={SHADOW_CONTROL} onClass={onClass} />
          <StyleControlField node={node} def={def} control={TRANSITION_CONTROL} onClass={onClass} />
          <Subgroup title="Transform">
            <div className="bx-row2">
              <LengthField
                label="Scale"
                node={node}
                prefix="scale"
                presets={SCALE_PRESETS}
                commit={commit}
              />
              <LengthField
                label="Rotate"
                node={node}
                prefix="rotate"
                presets={ROTATE_PRESETS}
                commit={commit}
              />
            </div>
            <div className="bx-row2">
              <LengthField
                label="Move X"
                node={node}
                prefix="translate-x"
                presets={MOVE_PRESETS}
                commit={commit}
              />
              <LengthField
                label="Move Y"
                node={node}
                prefix="translate-y"
                presets={MOVE_PRESETS}
                commit={commit}
              />
            </div>
          </Subgroup>
        </>
      ) : null}
    </Card>
  );
}

// Typography — font / size / weight / line-height / spacing / alignment / case /
// color. Page builder only; shown for text-bearing leaves.
function TypographyCard({
  node,
  def,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
}) {
  return (
    <Card icon={Type} title="Typography" summary={typographySummary(node)} defaultOpen={false}>
      <div className="bx-row2">
        <StyleControlField node={node} def={def} control={FONT_FAMILY_CONTROL} onClass={onClass} />
        <StyleControlField node={node} def={def} control={FONT_SIZE_CONTROL} onClass={onClass} />
      </div>
      <div className="bx-row2">
        <StyleControlField node={node} def={def} control={FONT_WEIGHT_CONTROL} onClass={onClass} />
        <StyleControlField node={node} def={def} control={LEADING_CONTROL} onClass={onClass} />
      </div>
      <div className="bx-row2">
        <StyleControlField node={node} def={def} control={TEXT_ALIGN_CONTROL} onClass={onClass} />
        <StyleControlField node={node} def={def} control={TRACKING_CONTROL} onClass={onClass} />
      </div>
      <div className="bx-row2">
        <StyleControlField node={node} def={def} control={TEXT_CASE_CONTROL} onClass={onClass} />
        <StyleControlField node={node} def={def} control={TEXT_COLOR_CONTROL} onClass={onClass} />
      </div>
    </Card>
  );
}

// Custom CSS — the raw class escape hatch (the final power-user out).
function CustomCssCard({ node, onClass }: { node: BuilderNode; onClass: (value: string) => void }) {
  return (
    <Card
      icon={SlidersHorizontal}
      title="Custom CSS"
      summary="Raw classes"
      defaultOpen={false}
      muted
    >
      <Field
        label="Custom classes"
        hint="Advanced escape hatch — any Tailwind utility. Compiles through the same engine. Most people never need this."
      >
        <Textarea
          rows={2}
          value={node.class ?? ''}
          placeholder="e.g. backdrop-blur-sm mix-blend-multiply"
          aria-label="Custom classes"
          onChange={(e) => onClass(e.target.value)}
        />
      </Field>
    </Card>
  );
}

// ── Binding box ──────────────────────────────────────────────────────────────

const UNBOUND = '__none';

// Inline "+ New field" (docs/51 keystone) — the quick path to add a field to the
// page's content type and bind this node to it in one step, without leaving for
// the Fields tab. Shown only on a collection template that targets a content
// type. The bound path follows the node's scope: an in-scope (iterating) node
// reads `item.<key>`; otherwise it reads the per-record `<typeKey>.<key>` (the
// bare record source a collection template renders against).
function InlineFieldAdd({
  contentTypeKey,
  scope,
  onAddField,
  onBind,
}: {
  contentTypeKey: string;
  scope: ScopeInfo;
  onAddField: (label: string, kind: CreatableType) => Promise<string | null>;
  onBind: (path: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [kind, setKind] = React.useState<CreatableType>('text');
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setBusy(true);
    const key = await onAddField(trimmed, kind);
    setBusy(false);
    if (!key) return;
    onBind(scope.inScope ? `item.${key}` : `${contentTypeKey}.${key}`);
    setLabel('');
    setKind('text');
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className="bx-bind__addfield" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> New field
      </button>
    );
  }

  return (
    <div className="bx-bind__addform">
      <Input
        size="sm"
        value={label}
        placeholder="Field label"
        aria-label="New field label"
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <NativeSelect
        size="sm"
        value={kind}
        aria-label="New field type"
        onChange={(e) => setKind(e.target.value as CreatableType)}
      >
        {CREATABLE_KINDS.map((k) => (
          <option key={k.type} value={k.type}>
            {k.label}
          </option>
        ))}
      </NativeSelect>
      <div className="bx-bind__addactions">
        <button
          type="button"
          className="bx-fieldrow__btn"
          disabled={busy || !label.trim()}
          onClick={() => void submit()}
        >
          <Check aria-hidden /> Add &amp; bind
        </button>
        <button type="button" className="bx-fieldrow__btn" onClick={() => setOpen(false)}>
          <X aria-hidden /> Cancel
        </button>
      </div>
    </div>
  );
}

// The data source — folded INTO the Content card (no longer a cryptic "DATA"
// group). A plain "Type it in" / "Pull from your data" toggle: static content is
// typed in the fields above; "Pull from your data" reveals the picker so the block
// shows live content (a product name, a price, a post title). Returns null for a
// non-bindable block (its content is always typed). In the component editor a
// binding can also become a per-placement field (the slot state).
function DataSource({
  node,
  catalog,
  scope,
  contentTypeKey,
  onAddField,
  onBind,
  slotEditor,
}: {
  node: BuilderNode;
  catalog: BindingCatalog;
  scope: ScopeInfo;
  contentTypeKey?: string | null;
  onAddField?: (label: string, kind: CreatableType) => Promise<string | null>;
  onBind: (path: string | null) => void;
  /** Present only in the component editor — lets a node's data binding become an
   *  instance field (docs/53 4b). */
  slotEditor?: SlotEditor;
}) {
  const def = getDef(node.type)!;
  const path = node.binding?.path ?? '';
  // Local toggle so "Pull from your data" can reveal the picker before a path is
  // chosen. Seeded from the node (which remounts per selection), so it's correct.
  const [mode, setMode] = React.useState<'static' | 'data'>(path ? 'data' : 'static');

  if (!def.bindable) return null;

  // In the component editor a node's data can be turned into a per-placement field
  // (a `$bind:<key>` slot). When it is, show the slot state instead of the picker.
  const slotKey = bindSlotKey(path);
  if (slotKey !== null && slotEditor) {
    return (
      <div className="bx-bind bx-bind--slot">
        <div className="bx-bind__top">
          <span className="bx-bind__path">
            <span className="bx-bind__dot" />
            field · {slotKey}
          </span>
        </div>
        <p className="bx-bind__hint">
          Filled per placement — each page that uses this component chooses the data shown here.
        </p>
        <button
          type="button"
          className="bx-fieldrow__btn"
          onClick={() => slotEditor.onUnbindData()}
        >
          <X aria-hidden /> Use direct data
        </button>
      </div>
    );
  }

  const groups = bindGroups(catalog);
  const itemPaths = itemBindPaths(scope);
  const showPicker = mode === 'data';
  // A container binds to REPEAT its subtree per record; a leaf binds to REPLACE
  // its content with a value — so the framing differs.
  const isContainer = def.kind === 'container';

  return (
    <div className="bx-source">
      <span className="bx-field__label">{isContainer ? 'Repeat content' : 'Content'}</span>
      <div className="bx-seg" role="group">
        <button
          type="button"
          className="bx-seg__btn"
          data-on={mode === 'static'}
          aria-pressed={mode === 'static'}
          onClick={() => {
            setMode('static');
            if (path) onBind(null);
          }}
        >
          {isContainer ? 'Show once' : 'Type it in'}
        </button>
        <button
          type="button"
          className="bx-seg__btn"
          data-on={mode === 'data'}
          aria-pressed={mode === 'data'}
          onClick={() => setMode('data')}
        >
          {isContainer ? 'Repeat for each…' : 'Pull from your data'}
        </button>
      </div>
      {showPicker ? (
        <div className="bx-source__picker">
          <NativeSelect
            size="sm"
            aria-label={isContainer ? 'Choose what to repeat' : 'Choose what to show'}
            value={path || UNBOUND}
            onChange={(e) => onBind(e.target.value === UNBOUND ? null : e.target.value)}
          >
            <option value={UNBOUND}>
              {isContainer ? '— Choose what to repeat —' : '— Choose what to show —'}
            </option>
            {groups.map((grp) => (
              <optgroup key={grp.module} label={grp.module.toUpperCase()}>
                {grp.paths.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
            {scope.inScope ? (
              <optgroup label={scope.label ? `From each ${scope.label}` : 'From each item'}>
                {itemPaths.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </NativeSelect>
          {path ? <p className="bx-source__hint">{bindHint(catalog, scope, path)}</p> : null}
          {contentTypeKey && onAddField ? (
            <InlineFieldAdd
              contentTypeKey={contentTypeKey}
              scope={scope}
              onAddField={onAddField}
              onBind={onBind}
            />
          ) : null}
          {slotEditor ? (
            <button
              type="button"
              className="bx-makefield"
              onClick={() => slotEditor.onBindData(node.binding?.path ?? null)}
            >
              <Boxes aria-hidden /> Make instance field
            </button>
          ) : null}
        </div>
      ) : (
        <p className="bx-source__hint">
          {isContainer
            ? 'Shows the blocks inside once. Switch to “Repeat for each…” to repeat them for every product, post, or record.'
            : 'Uses the content you type above. Switch to “Pull from your data” to show something live, like a product name or price.'}
        </p>
      )}
    </div>
  );
}

// ── Component props ──────────────────────────────────────────────────────────

/** Slot authoring (docs/53 §5, P-D) — present ONLY in the component editor. Lets a
 *  node's text prop be turned INTO a configurable field: each placement then fills
 *  it (per-instance), and the expander substitutes the value. */
export interface SlotEditor {
  /** Turn the selected node's prop into a field (creates the slot, binds it). */
  onBind: (
    propKey: string,
    propLabel: string,
    control: ComponentDef['props'][number]['control']
  ) => void;
  /** Unbind: drop the slot reference back to a plain (empty) literal. */
  onUnbind: (propKey: string) => void;
  /** Turn the selected node's DATA BINDING into an instance field (docs/53 4b): a
   *  `$bind:<key>` slot each placement maps to its own data path. `currentPath` is
   *  the node's existing binding (used to seed the slot key). */
  onBindData: (currentPath: string | null) => void;
  /** Clear the binding slot back to a normal (unbound) data binding. */
  onUnbindData: () => void;
}

// The node's own props (heading text, button label/link, …) — rendered inside the
// Content card (no Group wrapper of its own). Returns null when the block has no
// props (e.g. a Divider), so the Content card can fall back to just the data source.
function PropsFields({
  node,
  onProp,
  slotEditor,
  tokens,
}: {
  node: BuilderNode;
  onProp: (key: string, value: unknown) => void;
  /** When set (component editor), text props gain a "Make a field" affordance. */
  slotEditor?: SlotEditor;
  /** Merge tags for inline `{{` autocomplete (email surface only). Absent ⇒ plain
   *  text controls. */
  tokens?: MergeTag[];
}) {
  const def = getDef(node.type)!;
  if (def.props.length === 0) return null;
  return (
    <>
      {def.props.map((spec) => {
        const value = node.props[spec.key];
        // A prop already wired to a field (component editor): show the link + an
        // unlink, instead of the literal control.
        if (slotEditor && isPropSlot(value)) {
          return (
            <div key={spec.key} className="bx-slotrow">
              <span className="bx-field__label">{spec.label}</span>
              <span className="bx-slotrow__tag">field · {value.$prop}</span>
              <button
                type="button"
                className="bx-fieldrow__btn"
                onClick={() => slotEditor.onUnbind(spec.key)}
              >
                <X aria-hidden /> Unlink
              </button>
            </div>
          );
        }
        // "Make a field" is offered for free-text props only (the common slot case).
        const makeField =
          slotEditor && (spec.control === 'text' || spec.control === 'textarea') ? (
            <button
              type="button"
              className="bx-makefield"
              onClick={() => slotEditor.onBind(spec.key, spec.label, spec.control)}
            >
              <Boxes aria-hidden /> Make a field
            </button>
          ) : null;

        if (spec.control === 'buttongroup' && spec.options) {
          return (
            <Field key={spec.key} label={spec.label}>
              <Segmented
                value={(value as string) ?? spec.options[0]?.value}
                options={spec.options}
                onChange={(v) => onProp(spec.key, v)}
              />
            </Field>
          );
        }
        if (spec.control === 'select' && spec.options) {
          return (
            <Field key={spec.key} label={spec.label}>
              <NativeSelect
                size="sm"
                value={(value as string) ?? ''}
                onChange={(e) => onProp(spec.key, e.target.value)}
              >
                {spec.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          );
        }
        if (spec.control === 'textarea') {
          return (
            <Field key={spec.key} label={spec.label}>
              {tokens ? (
                <TokenTextarea
                  rows={3}
                  value={(value as string) ?? ''}
                  placeholder={spec.placeholder}
                  tags={tokens}
                  onValueChange={(v) => onProp(spec.key, v)}
                />
              ) : (
                <Textarea
                  rows={3}
                  value={(value as string) ?? ''}
                  placeholder={spec.placeholder}
                  onChange={(e) => onProp(spec.key, e.target.value)}
                />
              )}
              {makeField}
            </Field>
          );
        }
        if (spec.control === 'switch') {
          return (
            <div key={spec.key} className="bx-row">
              <span className="bx-field__label">{spec.label}</span>
              <Switch checked={Boolean(value)} onCheckedChange={(v) => onProp(spec.key, v)} />
            </div>
          );
        }
        if (spec.control === 'richtext') {
          // Free-form authored body (docs/52 §9) — the full TipTap editor, edited
          // in place. The doc is stored on the prop; renderers serialize it to HTML.
          return (
            <Field key={spec.key} label={spec.label}>
              <ProseControl
                value={value}
                onChange={(doc) => onProp(spec.key, doc)}
                placeholder={spec.placeholder}
              />
            </Field>
          );
        }
        if (spec.control === 'icon') {
          return (
            <Field key={spec.key} label={spec.label}>
              <IconPicker
                value={(value as string) ?? ''}
                onChange={(name) => onProp(spec.key, name)}
              />
            </Field>
          );
        }
        if (spec.control === 'navlinks') {
          // Site navigation is Builder-owned (docs/57) — author the links here,
          // per site, instead of in the CMS module.
          return (
            <Field key={spec.key} label={spec.label}>
              <NavLinksControl value={value} onChange={(links) => onProp(spec.key, links)} />
            </Field>
          );
        }
        return (
          <Field key={spec.key} label={spec.label}>
            {tokens ? (
              <TokenInput
                value={(value as string) ?? ''}
                placeholder={spec.placeholder}
                tags={tokens}
                onValueChange={(v) => onProp(spec.key, v)}
              />
            ) : (
              <Input
                value={(value as string) ?? ''}
                placeholder={spec.placeholder}
                onChange={(e) => onProp(spec.key, e.target.value)}
              />
            )}
            {makeField}
          </Field>
        );
      })}
    </>
  );
}

// ── Settings panels (shown when no node is selected) ─────────────────────────
// Each surface supplies its own (page settings vs. layout settings) via the
// Inspector's `settings` slot; both reuse the inspector's Card/Field controls.

export function PageSettings({
  pageId,
  name,
  slug,
  kind,
  recordType,
  isDefault = false,
  catalog,
  seo,
  onSlug,
  onSeo,
  onRetarget,
  onMakeDefault,
}: {
  pageId: string;
  name: string;
  slug: string | null;
  kind: 'singleton' | 'collection';
  /** A collection template's target — the content type / source it renders per
   *  record (docs/51 §6). Undefined for singletons. */
  recordType?: string | null;
  /** Whether this collection template is the DEFAULT for its recordType — the
   *  per-type winner the storefront renders absent a per-record override. */
  isDefault?: boolean;
  catalog: BindingCatalog;
  seo: PageSeo;
  onSlug: (slug: string) => void;
  onSeo: (patch: Partial<PageSeo>) => void;
  onRetarget: (recordType: string | null) => void;
  onMakeDefault: () => void;
}) {
  const [draft, setDraft] = React.useState(slug ?? '');
  // Resync when the active page changes (slug prop is the source of truth).
  React.useEffect(() => setDraft(slug ?? ''), [slug]);

  return (
    <div className="bx-inspector">
      <PanelHead
        icon={kind === 'collection' ? Database : FileText}
        title={name}
        subtitle={kind === 'collection' ? 'Renders every record of a type' : 'A page on your site'}
      />
      <div className="bx-ins-stack">
        {kind === 'collection' ? (
          <Card
            icon={Database}
            title="Renders"
            caption="A collection template renders once per record — its search details come from each record (the product or entry it shows), not the template."
          >
            <Field
              label="Content type"
              hint="Every record of this type renders through this template. Editing the type’s fields affects every page that uses it."
            >
              <NativeSelect
                size="sm"
                value={recordType ?? ''}
                aria-label="Content type this template renders"
                onChange={(e) => onRetarget(e.target.value || null)}
              >
                <option value="">— Choose a content type —</option>
                {catalog.sources
                  .filter((s) => s.cardinality === 'array')
                  .map((s) => (
                    <option key={s.key} value={s.key}>
                      {`${s.module.toUpperCase()} · ${s.label}`}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            {recordType ? (
              <div className="bx-default">
                {isDefault ? (
                  <span className="bx-default__on">✓ Default template for this type</span>
                ) : (
                  <button type="button" className="bx-default__set" onClick={onMakeDefault}>
                    Make default for this type
                  </button>
                )}
                <p className="bx-default__hint">
                  {isDefault
                    ? 'Records of this type render through this template unless an individual record overrides it.'
                    : 'Until this is the default (or pinned to a record), published records of this type keep rendering through the current default.'}
                </p>
              </div>
            ) : null}
          </Card>
        ) : (
          <>
            <Card icon={FileText} title="Page">
              <Field
                label="Web address"
                hint={
                  draft.trim()
                    ? `Published, this page is at /${draft.trim()}`
                    : 'Set an address to publish this page on your site.'
                }
              >
                <Input
                  value={draft}
                  placeholder="e.g. about"
                  aria-label="Page slug"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  onBlur={() => {
                    if ((draft.trim() || null) !== (slug ?? null)) onSlug(draft);
                  }}
                />
              </Field>
            </Card>
            <PageSeoPanel pageId={pageId} seo={seo} onSeo={onSeo} />
          </>
        )}
      </div>
      <p className="bx-inspector__tip">Select a layer to edit it.</p>
    </div>
  );
}

// The SEO panel for a singleton page (docs/50): title / description / canonical /
// social image + an index toggle. Text fields keep a local draft and commit on
// blur (like the slug field) so typing doesn't round-trip per keystroke; the
// switch commits immediately. Blank fields fall back to the page name on the
// storefront.
function PageSeoPanel({
  pageId,
  seo,
  onSeo,
}: {
  pageId: string;
  seo: PageSeo;
  onSeo: (patch: Partial<PageSeo>) => void;
}) {
  const [title, setTitle] = React.useState(seo.title);
  const [description, setDescription] = React.useState(seo.description);
  const [canonical, setCanonical] = React.useState(seo.canonical);
  const [ogImage, setOgImage] = React.useState(seo.ogImage);
  // Resync when the active page changes (seo prop is the source of truth).
  React.useEffect(() => {
    setTitle(seo.title);
    setDescription(seo.description);
    setCanonical(seo.canonical);
    setOgImage(seo.ogImage);
  }, [seo.title, seo.description, seo.canonical, seo.ogImage]);

  return (
    <Card
      icon={Search}
      title="Search & sharing"
      caption="How this page reads in search results and link previews. Leave a field blank to fall back to the page name."
    >
      <div className="bx-row">
        <span className="bx-field__label">Search health — hover for the report</span>
        <SeoScoreChip type="builder_page" id={pageId} />
      </div>
      <Field label="Title" hint={`${title.length}/60 recommended`}>
        <Input
          value={title}
          placeholder="Title shown in search results"
          aria-label="SEO title"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== seo.title && onSeo({ title })}
        />
      </Field>
      <Field label="Description" hint={`${description.length}/160 recommended`}>
        <Textarea
          rows={3}
          value={description}
          placeholder="One- or two-sentence summary for search results"
          aria-label="Meta description"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== seo.description && onSeo({ description })}
        />
      </Field>
      <Field
        label="Canonical URL"
        hint="Only if this page duplicates another — the absolute URL of the original."
      >
        <Input
          value={canonical}
          placeholder="https://…"
          aria-label="Canonical URL"
          onChange={(e) => setCanonical(e.target.value)}
          onBlur={() => canonical !== seo.canonical && onSeo({ canonical })}
        />
      </Field>
      <Field
        label="Social image"
        hint="Shown when the page is shared (Open Graph). A full image URL."
      >
        <Input
          value={ogImage}
          placeholder="https://…/cover.jpg"
          aria-label="Social share image URL"
          onChange={(e) => setOgImage(e.target.value)}
          onBlur={() => ogImage !== seo.ogImage && onSeo({ ogImage })}
        />
      </Field>
      <div className="bx-row">
        <span className="bx-field__label">Allow search engines to index this page</span>
        <Switch checked={!seo.noindex} onCheckedChange={(v) => onSeo({ noindex: !v })} />
      </div>
    </Card>
  );
}

export function LayoutSettings({ name }: { name: string }) {
  return (
    <div className="bx-inspector">
      <PanelHead icon={LayoutGrid} title={name} subtitle="The chrome that wraps every page" />
      <div className="bx-ins-stack">
        <Card icon={LayoutGrid} title="Site layout">
          <p className="bx-card__caption">
            The header and footer that wrap every page. The <strong>Page content</strong> block
            marks where each routed page renders; everything around it persists across navigation.
          </p>
        </Card>
      </div>
      <p className="bx-inspector__tip">Select a layer to edit it.</p>
    </div>
  );
}

// The no-selection panel for the Email Builder (docs/52): the document-level
// subject + inbox preheader. Both keep a local draft and commit on blur (like the
// page slug field) so typing doesn't round-trip per keystroke.
export function EmailSettings({
  name,
  subject,
  preheader,
  tokens,
  onSubject,
  onPreheader,
}: {
  name: string;
  subject: string;
  preheader: string | null;
  /** Merge tags for the subject/preview `{{` autocomplete (docs/52 §7). */
  tokens?: MergeTag[];
  onSubject: (value: string) => void;
  onPreheader: (value: string) => void;
}) {
  const [subjectDraft, setSubjectDraft] = React.useState(subject);
  const [preheaderDraft, setPreheaderDraft] = React.useState(preheader ?? '');
  // Resync when the active email changes (props are the source of truth).
  React.useEffect(() => setSubjectDraft(subject), [subject]);
  React.useEffect(() => setPreheaderDraft(preheader ?? ''), [preheader]);

  return (
    <div className="bx-inspector">
      <PanelHead icon={Mail} title={name} subtitle="The email you're composing" />
      <div className="bx-ins-stack">
        <Card
          icon={Mail}
          title="Message"
          caption="Your wordmark header and the legal footer wrap this body automatically. You compose the content; the branded frame is added on send."
        >
          <Field
            label="Subject"
            hint="The subject line shown in the inbox. Type {{ to insert a merge tag like {{site.name}}."
          >
            {tokens ? (
              <TokenInput
                value={subjectDraft}
                placeholder="e.g. Welcome to {{site.name}}"
                aria-label="Email subject"
                tags={tokens}
                onValueChange={setSubjectDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={() => subjectDraft !== subject && onSubject(subjectDraft)}
              />
            ) : (
              <Input
                value={subjectDraft}
                placeholder="e.g. Welcome to the shop"
                aria-label="Email subject"
                onChange={(e) => setSubjectDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={() => subjectDraft !== subject && onSubject(subjectDraft)}
              />
            )}
          </Field>
          <Field
            label="Preview text"
            hint="The short teaser shown after the subject in most inboxes. Optional."
          >
            {tokens ? (
              <TokenTextarea
                rows={2}
                value={preheaderDraft}
                placeholder="A short teaser shown next to the subject"
                aria-label="Email preheader"
                tags={tokens}
                onValueChange={setPreheaderDraft}
                onBlur={() => preheaderDraft !== (preheader ?? '') && onPreheader(preheaderDraft)}
              />
            ) : (
              <Textarea
                rows={2}
                value={preheaderDraft}
                placeholder="A short teaser shown next to the subject"
                aria-label="Email preheader"
                onChange={(e) => setPreheaderDraft(e.target.value)}
                onBlur={() => preheaderDraft !== (preheader ?? '') && onPreheader(preheaderDraft)}
              />
            )}
          </Field>
        </Card>
      </div>
      <p className="bx-inspector__tip">Select a layer to edit it.</p>
    </div>
  );
}

// ── Custom-component placement (docs/53 P-B + P-D) ────────────────────────────
// A selected `custom:*` placement: the component's name + a rename, its
// configurable fields (per-instance values written to node.props), the pinned
// version, and a link to edit the component itself. Has no Style / Layout panels —
// a component owns its own structure + styling; the placement only carries data.

function CustomPropField({
  spec,
  value,
  onChange,
}: {
  spec: ComponentPropSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (spec.kind === 'boolean') {
    return (
      <div className="bx-row">
        <span className="bx-field__label">{spec.label}</span>
        <Switch checked={Boolean(value)} onCheckedChange={(v) => onChange(v)} />
      </div>
    );
  }
  if (spec.kind === 'richtext') {
    return (
      <Field label={spec.label}>
        <Textarea
          rows={3}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    );
  }
  if (spec.kind === 'number') {
    return (
      <Field label={spec.label}>
        <Input
          type="number"
          value={typeof value === 'number' || typeof value === 'string' ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Field>
    );
  }
  // text / url / image — a plain string slot.
  return (
    <Field
      label={spec.label}
      hint={
        spec.kind === 'image' ? 'An image URL.' : spec.kind === 'url' ? 'A link URL.' : undefined
      }
    >
      <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function CustomNodeInspector({
  node,
  component,
  surface,
  catalog,
  scope,
  onBack,
  onName,
  onProp,
}: {
  node: BuilderNode;
  component?: ComponentDto;
  surface: EditorSurface;
  catalog: BindingCatalog;
  scope: ScopeInfo;
  onBack: () => void;
  onName: (name: string) => void;
  onProp: (key: string, value: unknown) => void;
}) {
  const key = customKeyOf(node.type) ?? '';
  const ref = readComponentRef(node.props);
  const pinned = ref?.version ?? null;
  const latest = component?.latestVersion ?? null;
  // The component's per-placement binding slots (docs/53 4b), derived from its
  // latest tree. Each maps to a real data path under props.$ref.bindings.
  const bindingSlots = component ? collectBindingSlots(component.tree) : [];
  const instanceBindings = ref?.bindings ?? {};
  const setBinding = (slotKey: string, path: string | null) => {
    const next = { ...instanceBindings };
    if (path) next[slotKey] = path;
    else delete next[slotKey];
    onProp(REF_KEY, {
      ...(ref ?? { version: latest ?? 1 }),
      bindings: Object.keys(next).length > 0 ? next : undefined,
    });
  };
  const bindGroupsForCatalog = bindGroups(catalog);
  const inScopePaths = itemBindPaths(scope);
  // The component has moved on since this placement was pinned (docs/53 P-E) —
  // offer a one-click re-pin. Publish always expands the PINNED version, so a page
  // never changes under the author until they choose to update.
  const canUpgrade = pinned != null && latest != null && pinned < latest;
  const backLabel =
    surface === 'site' ? 'Site settings' : surface === 'email' ? 'Email settings' : 'Page settings';

  return (
    <div className="bx-inspector">
      <button type="button" className="bx-ins-back" onClick={onBack}>
        <ChevronLeft aria-hidden />
        {backLabel}
      </button>
      <header className="bx-ins-head">
        <div className="bx-ins-head__row">
          <span className="bx-ins-head__icon">
            <Boxes aria-hidden />
          </span>
          <div className="bx-ins-head__titles">
            <h3>{component?.name ?? key}</h3>
            <span className="bx-ins-head__sub">Reusable component</span>
          </div>
        </div>
        <Input
          value={node.name ?? ''}
          placeholder={`${component?.name ?? 'Component'} name`}
          onChange={(e) => onName(e.target.value)}
        />
      </header>

      <div className="bx-ins-stack">
        {!component ? (
          <Card icon={Boxes} title="Unavailable">
            <p className="bx-card__caption">
              This component (<span className="bx-mono">custom:{key}</span>) is no longer available.
              Remove it from the Layers panel.
            </p>
          </Card>
        ) : (
          <>
            {component.propSpec.length > 0 ? (
              <Card
                icon={Type}
                title="Content"
                caption="Fill this placement’s fields. Leave one blank to use the component’s default."
              >
                {component.propSpec.map((spec) => (
                  <CustomPropField
                    key={spec.key}
                    spec={spec}
                    value={node.props[spec.key]}
                    onChange={(v) => onProp(spec.key, v)}
                  />
                ))}
              </Card>
            ) : (
              <Card
                icon={Type}
                title={component.name}
                caption={`${
                  component.description ??
                  'This component has no configurable fields — every placement renders the same.'
                } Edit the component to change it everywhere it’s used.`}
              />
            )}

            {bindingSlots.length > 0 ? (
              <Card
                icon={Database}
                title="Data"
                caption="Point this component’s data fields at your content for this placement."
              >
                {bindingSlots.map((slot) => {
                  const current = instanceBindings[slot.key] ?? '';
                  return (
                    <Field key={slot.key} label={slot.label}>
                      <NativeSelect
                        size="sm"
                        value={current || UNBOUND}
                        onChange={(e) =>
                          setBinding(slot.key, e.target.value === UNBOUND ? null : e.target.value)
                        }
                      >
                        <option value={UNBOUND}>— Not set —</option>
                        {bindGroupsForCatalog.map((grp) => (
                          <optgroup key={grp.module} label={grp.module.toUpperCase()}>
                            {grp.paths.map((p) => (
                              <option key={p.path} value={p.path}>
                                {p.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        {scope.inScope ? (
                          <optgroup
                            label={scope.label ? `From each ${scope.label}` : 'From each item'}
                          >
                            {inScopePaths.map((p) => (
                              <option key={p.path} value={p.path}>
                                {p.label}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </NativeSelect>
                    </Field>
                  );
                })}
              </Card>
            ) : null}

            <Card icon={Boxes} title="Component">
              <Field label="Source">
                <span className="bx-mono">
                  custom:{key}
                  {pinned ? ` · v${pinned}` : ''}
                </span>
              </Field>
              {canUpgrade ? (
                <div className="bx-upgrade">
                  <p className="bx-upgrade__note">
                    This component is now at v{latest}. This placement renders v{pinned} until you
                    update it — the canvas shows the latest as a preview.
                  </p>
                  <button
                    type="button"
                    className="bx-upgrade__btn"
                    onClick={() => onProp(REF_KEY, { version: latest })}
                  >
                    Update to v{latest}
                  </button>
                </div>
              ) : null}
              <a className="bx-ins-editlink" href={`/builder/components/${key}`}>
                <ExternalLink aria-hidden /> Edit component
              </a>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// ── The inspector ────────────────────────────────────────────────────────────

export interface InspectorProps {
  node: BuilderNode | null;
  catalog: BindingCatalog;
  scope: ScopeInfo;
  /** Which editor surface (page/site) — scopes the retype targets. */
  surface: EditorSurface;
  /** Rendered when no node is selected — the surface's settings panel. */
  settings: React.ReactNode;
  /** Tenant components keyed by key (docs/53 P-B) — resolves the panel for a
   *  selected `custom:*` placement (its name, version, and configurable fields). */
  components?: ReadonlyMap<string, ComponentDto>;
  /** The active template's content-type key — enables the binding picker's inline
   *  "+ New field" (docs/51 keystone). Null/undefined hides it. */
  contentTypeKey?: string | null;
  /** Add a field to `contentTypeKey`, resolving its key so the picker binds the
   *  node to the new field. */
  onAddField?: (label: string, kind: CreatableType) => Promise<string | null>;
  /** "Save as component" (docs/53 P-C): turn the selected subtree into a reusable
   *  tenant component, replacing it with a placement. Omitted ⇒ the action is
   *  hidden (e.g. inside the component editor itself — no nesting). */
  onSaveAsComponent?: (node: BuilderNode) => void;
  /** Slot authoring (docs/53 P-D) — present only in the component editor: lets a
   *  node's text prop become a configurable field. */
  slotEditor?: SlotEditor;
  /** Merge tags for inline `{{` autocomplete in text props (email surface only). */
  tokens?: MergeTag[];
  /** Clear the selection — returns the inspector to the `settings` panel (page /
   *  site settings). Powers the "‹ Page settings" back control. */
  onBack: () => void;
  onName: (name: string) => void;
  onClass: (value: string) => void;
  onBind: (path: string | null) => void;
  onProp: (key: string, value: unknown) => void;
  onRetype: (targetType: string) => void;
}

export function Inspector({
  node,
  catalog,
  scope,
  surface,
  settings,
  components,
  contentTypeKey,
  onAddField,
  onSaveAsComponent,
  slotEditor,
  tokens,
  onBack,
  onName,
  onClass,
  onBind,
  onProp,
  onRetype,
}: InspectorProps) {
  if (!node) {
    return <>{settings}</>;
  }
  // A `custom:*` placement (docs/53 P-B) has its own panel — identity, version
  // pin, configurable fields, and a link to edit the component itself.
  if (isCustomType(node.type)) {
    return (
      <CustomNodeInspector
        node={node}
        component={components?.get(customKeyOf(node.type) ?? '')}
        surface={surface}
        catalog={catalog}
        scope={scope}
        onBack={onBack}
        onName={onName}
        onProp={onProp}
      />
    );
  }
  const def = getDef(node.type);
  if (!def) return null;

  const TypeIcon = def.icon;
  const hasContent = def.props.length > 0 || def.bindable;
  // `key={node.id}` resets each card's open-state + the data-source toggle when a
  // different node is selected (so defaults are consistent per selection), while
  // edits to the SAME node preserve them.
  return (
    <div className="bx-inspector" key={node.id}>
      {/* Selecting a node replaces the page/site settings panel; this returns to
          it without leaving the editor (the canvas's click-empty / Esc are easy
          to miss when the page fills the canvas). */}
      <button type="button" className="bx-ins-back" onClick={onBack}>
        <ChevronLeft aria-hidden />
        {surface === 'site'
          ? 'Site settings'
          : surface === 'email'
            ? 'Email settings'
            : 'Page settings'}
      </button>
      <header className="bx-ins-head">
        <div className="bx-ins-head__row">
          <span className="bx-ins-head__icon">
            <TypeIcon aria-hidden />
          </span>
          <div className="bx-ins-head__titles">
            <h3>{def.label}</h3>
            <span className="bx-ins-head__sub">
              {def.kind === 'container' ? 'Holds other blocks' : 'A single element'}
            </span>
          </div>
        </div>
        <Input
          value={node.name ?? ''}
          placeholder={`${def.label} name`}
          onChange={(e) => onName(e.target.value)}
        />
        <RetypeControl def={def} surface={surface} onRetype={onRetype} />
        {onSaveAsComponent ? (
          <button
            type="button"
            className="bx-ins-saveas"
            onClick={() => onSaveAsComponent(node)}
            title="Turn this block into a reusable component"
          >
            <Boxes aria-hidden /> Save as component
          </button>
        ) : null}
      </header>

      <div className="bx-ins-stack">
        {/* Content first — what the block SAYS and where it comes from. */}
        {hasContent ? (
          <Card icon={Type} title="Content" summary={contentSummary(node, def)}>
            <PropsFields node={node} onProp={onProp} slotEditor={slotEditor} tokens={tokens} />
            <DataSource
              node={node}
              catalog={catalog}
              scope={scope}
              contentTypeKey={contentTypeKey}
              onAddField={onAddField}
              onBind={onBind}
              slotEditor={slotEditor}
            />
          </Card>
        ) : null}

        {/* Style — Color + Emphasis, plus the effects (opacity/shadow/transform/
            transition) on the page builder. In the component builder the Appearance
            card owns the skin set, so Style stays Color + Emphasis (showEffects off). */}
        <StyleCard node={node} def={def} onClass={onClass} showEffects={!slotEditor} />

        {/* The full Appearance/skin surface (free color/type/edges + per
            breakpoint/state/dark context) authors only in the component builder
            (slotEditor present); on the page builder skin comes from the recipe,
            not per-instance re-skinning (docs/61 §5.2). */}
        {slotEditor ? <AppearanceCard node={node} def={def} onClass={onClass} /> : null}

        {/* Containers arrange their children (docs/61 §5.2). Leaves arrange
            nothing, so the card is hidden. */}
        {def.kind === 'container' ? <LayoutCard node={node} def={def} onClass={onClass} /> : null}

        {/* Power-user style sections — collapsed by default. Size / Spacing /
            Position apply everywhere; Typography / Borders only on the page builder
            (the component builder's Appearance card owns the full skin set, so they'd
            duplicate it there). Effects now live in the Style card. */}
        <SizeCard node={node} def={def} onClass={onClass} />
        <SpacingCard node={node} def={def} onClass={onClass} />
        <PositionCard node={node} def={def} onClass={onClass} />
        {!slotEditor && def.kind === 'leaf' ? (
          <TypographyCard node={node} def={def} onClass={onClass} />
        ) : null}
        {!slotEditor ? <BordersCard node={node} def={def} onClass={onClass} /> : null}

        {/* Motion (docs/61 §9) — entrance on every node. Hidden on the email
            surface (mail clients strip classes, so an entrance is inert there). */}
        {surface !== 'email' ? <MotionCard node={node} def={def} onClass={onClass} /> : null}

        <CustomCssCard node={node} onClass={onClass} />
      </div>
    </div>
  );
}
