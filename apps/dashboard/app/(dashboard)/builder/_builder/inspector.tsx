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
  AlignCenter,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  AlignHorizontalSpaceAround,
  AlignHorizontalSpaceBetween,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceAround,
  AlignVerticalSpaceBetween,
  Aperture,
  Baseline,
  Box,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleDot,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Crosshair,
  Database,
  ExternalLink,
  FileText,
  Frame,
  LayoutGrid,
  Layers,
  Link2,
  Mail,
  Maximize2,
  MousePointerClick,
  Move3d,
  Palette,
  Pencil,
  Play,
  Plus,
  Replace,
  Rocket,
  RotateCw,
  Search,
  Sparkles,
  SlidersHorizontal,
  Spline,
  Square,
  StretchHorizontal,
  StretchVertical,
  Table,
  TextCursorInput,
  Trash2,
  Type,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  NativeSelect,
  Switch,
  Textarea,
  cn,
} from '@sparx/ui';
import {
  REF_KEY,
  bindSlotKey,
  collectBindingSlots,
  customKeyOf,
  isCustomType,
  isPropSlot,
  isRawElementType,
  rawTagOf,
  readComponentRef,
  type BindingCatalog,
  type ComponentDto,
  type MergeTag,
  type PropSpec as ComponentPropSpec,
} from '@sparx/builder-schemas';
import { BEHAVIOR_DESCRIPTORS, SX_ROLES, type BehaviorDescriptor } from '@sparx/builder-render';

import { CREATABLE_KINDS, type CreatableType } from './field-kinds';
import { TokenInput, TokenTextarea } from './token-field';

import { SeoScoreChip } from '@/components/seo/seo-score';

import { type Binding, type BuilderNode, type PageSeo } from './model';
import {
  bindGroups,
  bindHint,
  cmsTypesFromCatalog,
  itemBindPaths,
  type ScopeInfo,
} from './binding-catalog';
import {
  DataConnect,
  dataConnectMode,
  dataConnectSummary,
  hasRecordOrActionBinding,
} from './data-panel';
import {
  compatibleRetypeTargets,
  getDef,
  textPropKeyOf,
  type ComponentDef,
  type EditorSurface,
} from './registry';
import { IconPicker } from './icon-picker';
import { ProseControl } from './prose-control';
import { LinkTargetControl } from './link-target-control';
import { NODE_INSPECTORS } from './node-inspectors';
import {
  ACCENT_COLOR_CONTROL,
  ALIGN_CONTENT_CONTROL,
  ALIGN_ITEMS_CONTROL,
  ALIGN_SELF_CONTROL,
  ANIMATE_CONTROL,
  APPEARANCE_CONTROL,
  ARRANGEMENT_CONTEXTS,
  ASPECT_CONTROL,
  BACKDROP_BLUR_CONTROL,
  BACKDROP_GRAYSCALE_CONTROL,
  BASE_CONTEXT,
  BG_POSITION_CONTROL,
  BG_REPEAT_CONTROL,
  BG_SIZE_CONTROL,
  BG_SURFACE_CONTROL,
  BLUR_CONTROL,
  BORDER_CONTROL,
  BORDER_COLLAPSE_CONTROL,
  BORDER_COLOR_CONTROL,
  BORDER_SIDES,
  BORDER_STYLE_CONTROL,
  BOX_DISPLAY_CONTROL,
  CAPTION_SIDE_CONTROL,
  CARET_COLOR_CONTROL,
  COLOR_CONTROL,
  CURSOR_CONTROL,
  DECORATION_OFFSET_CONTROL,
  DECORATION_THICKNESS_CONTROL,
  DIRECTION_CONTROL,
  DISPLAY_CONTROL,
  DROP_SHADOW_CONTROL,
  EASE_CONTROL,
  FILL_CONTROL,
  FLEX_GROW_CONTROL,
  FLEX_SHRINK_CONTROL,
  FLEX_WRAP_CONTROL,
  FONT_FAMILY_CONTROL,
  FONT_SIZE_CONTROL,
  FONT_STYLE_CONTROL,
  FONT_WEIGHT_CONTROL,
  GAP_CONTROL,
  GRADIENT_DIRECTION_CONTROL,
  GRADIENT_FROM_CONTROL,
  GRADIENT_TO_CONTROL,
  GRADIENT_VIA_CONTROL,
  GRAYSCALE_CONTROL,
  GRID_FLOW_CONTROL,
  GRID_ROWS_CONTROL,
  HYPHENS_CONTROL,
  INVERT_CONTROL,
  JUSTIFY_CONTROL,
  JUSTIFY_ITEMS_CONTROL,
  LEADING_CONTROL,
  LINE_CLAMP_CONTROL,
  LIST_STYLE_POSITION_CONTROL,
  LIST_STYLE_TYPE_CONTROL,
  MIX_BLEND_CONTROL,
  OVERFLOW_CONTROL,
  POINTER_EVENTS_CONTROL,
  POSITION_CONTROL,
  RADIUS_CONTROL,
  RADIUS_CORNERS,
  RESIZE_CONTROL,
  RING_COLOR_CONTROL,
  RING_CONTROL,
  SCROLL_BEHAVIOR_CONTROL,
  SCROLL_SNAP_ALIGN_CONTROL,
  SCROLL_SNAP_TYPE_CONTROL,
  SEPIA_CONTROL,
  SHADOW_COLOR_CONTROL,
  SHADOW_CONTROL,
  SKIN_CONTEXTS,
  STROKE_CONTROL,
  STROKE_WIDTH_CONTROL,
  STYLE_CONTROLS,
  STAGGER_CONTROL,
  TABLE_LAYOUT_CONTROL,
  TEXT_ALIGN_CONTROL,
  TEXT_CASE_CONTROL,
  TEXT_COLOR_CONTROL,
  TEXT_DECORATION_CONTROL,
  TEXT_OVERFLOW_CONTROL,
  TOUCH_ACTION_CONTROL,
  TRACKING_CONTROL,
  TRANSFORM_ORIGIN_CONTROL,
  TRANSITION_CONTROL,
  USER_SELECT_CONTROL,
  VARIANT_CONTROL,
  VERTICAL_ALIGN_CONTROL,
  WHITESPACE_CONTROL,
  WILL_CHANGE_CONTROL,
  WORD_BREAK_CONTROL,
  Z_INDEX_CONTROL,
  MOTION_ENTRANCES,
  MOTION_TRIGGERS,
  activeValue,
  applyValue,
  applyValueGroup,
  applyMotion,
  borderSideControl,
  contextPrefix,
  ensureArchetypeDefaults,
  lengthDisplay,
  lengthSuffix,
  radiusCornerControl,
  readMotion,
  readValueGroup,
  type ClassControl,
  type MotionState,
  type StyleContext,
} from './class-controls';
import { ColorSwatchField, EmphasisSwatchField } from './color-swatch';
import { BackgroundFillField } from './background-fill';
import {
  IconChoiceField,
  PositionPadField,
  PreviewTile,
  PreviewTileField,
  SwitchField,
} from './picker-fields';
import { detectClassConflicts, resolveClassConflicts } from './class-conflicts';

// ── Shared controls ──────────────────────────────────────────────────────────

// Icon maps for the alignment IconChoiceFields (picker-fields.tsx). Keyed by the
// control's option VALUE; a value with no icon falls back to its text label
// (e.g. align-self 'auto', align-items 'baseline' when no clean glyph fits).
const TEXT_ALIGN_ICONS: Record<string, LucideIcon> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
  justify: AlignJustify,
};
const JUSTIFY_ICONS: Record<string, LucideIcon> = {
  start: AlignHorizontalJustifyStart,
  center: AlignHorizontalJustifyCenter,
  end: AlignHorizontalJustifyEnd,
  between: AlignHorizontalSpaceBetween,
  around: AlignHorizontalSpaceAround,
  evenly: AlignHorizontalDistributeCenter,
};
const ALIGN_ITEMS_ICONS: Record<string, LucideIcon> = {
  start: AlignStartHorizontal,
  center: AlignCenterHorizontal,
  end: AlignEndHorizontal,
  stretch: StretchVertical,
  baseline: Baseline,
};
const JUSTIFY_ITEMS_ICONS: Record<string, LucideIcon> = {
  start: AlignHorizontalJustifyStart,
  center: AlignHorizontalJustifyCenter,
  end: AlignHorizontalJustifyEnd,
  stretch: StretchHorizontal,
};
const ALIGN_CONTENT_ICONS: Record<string, LucideIcon> = {
  start: AlignVerticalJustifyStart,
  center: AlignVerticalJustifyCenter,
  end: AlignVerticalJustifyEnd,
  between: AlignVerticalSpaceBetween,
  around: AlignVerticalSpaceAround,
  stretch: StretchVertical,
};
const ALIGN_SELF_ICONS: Record<string, LucideIcon> = {
  start: AlignStartHorizontal,
  center: AlignCenterHorizontal,
  end: AlignEndHorizontal,
  stretch: StretchVertical,
};
// Gradient direction reads as a compass — each linear angle is its arrow; radial
// fills from the centre, conic sweeps around.
const GRADIENT_DIR_ICONS: Record<string, LucideIcon> = {
  r: ArrowRight,
  l: ArrowLeft,
  b: ArrowDown,
  t: ArrowUp,
  br: ArrowDownRight,
  bl: ArrowDownLeft,
  tr: ArrowUpRight,
  tl: ArrowUpLeft,
  radial: CircleDot,
  conic: RotateCw,
};

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
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="bx-seg" role="group">
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            className="bx-seg__btn"
            data-on={o.value === value}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {Icon ? <Icon className="bx-seg__ico" aria-hidden /> : null}
            {o.label}
          </button>
        );
      })}
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

// The Layout card (display / overflow / aspect) preview — distinct from the
// Flexbox & Grid arrangement summary above.
function generalLayoutSummary(node: BuilderNode): string {
  return (
    [
      activeLabel(node, BOX_DISPLAY_CONTROL),
      activeLabel(node, OVERFLOW_CONTROL),
      activeLabel(node, ASPECT_CONTROL),
    ]
      .filter(Boolean)
      .join(' · ') || 'Default'
  );
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

// Change a node's type in place (Card→Section, Button→Badge). Offers the
// same-kind targets valid on this surface; the current type sits at the top,
// disabled. The editor's onRetype carries name / box / binding / recipe across and
// confirms if the change would drop nested items (registry.retypeNode).
// One recipe-axis selector (Color / Variant / Size). Writing a value also
// backfills the node's archetype base + defaults for any unset axis, so styling a
// component authored before class-first (no `st-btn` base) doesn't collapse it to
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
  const fixed = !fluid && current && /^[1-6]$/.test(current) ? current : null;
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
    <div className="bx-field bx-swatchfield">
      <span className="bx-field__label">Columns</span>
      <div className="bx-sw-grid" data-density="comfortable" role="group" aria-label="Columns">
        <PreviewTile
          label="Default"
          selected={!fluid && !fixed}
          onSelect={() => write(null, false)}
          kind="columns"
          value={null}
        />
        {['1', '2', '3', '4', '5', '6'].map((n) => (
          <PreviewTile
            key={n}
            label={n}
            selected={fixed === n}
            onSelect={() => write(n, false)}
            kind="columns"
            value={n}
          />
        ))}
        {/* Fluid = auto-fit/fill: as many columns of >= the min width as fit, wrapping. */}
        <PreviewTile
          label="Fluid"
          selected={fluid}
          onSelect={() => write(fluidSuffix(kind ?? 'auto-fit', minText), prefix === '')}
          kind="columns"
          value="fluid"
        />
      </div>
      {fluid ? (
        <>
          <Segmented
            value={kind ?? 'auto-fit'}
            options={[
              { value: 'auto-fit', label: 'Auto-fit' },
              { value: 'auto-fill', label: 'Auto-fill' },
            ]}
            onChange={(v) => write(fluidSuffix(v, minText), prefix === '')}
          />
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

// Flexbox & Grid (Tailwind: Flexbox & Grid) — how a CONTAINER arranges its
// children (the page-builder's structural surface, docs/61 §5.2) PLUS how a
// flex/grid CHILD sizes & orders itself (grow / shrink / basis / order / self).
// The friendly "Arrange as Row / Stack / Grid" merges the underlying display +
// direction class groups; Grid then reveals Columns + grid detail. Gap /
// alignment / wrap follow. Padding lives in the Spacing card (so it isn't offered
// twice). Responsive via the "Editing for" pill — pick a screen size to set that
// layer (`@lg:grid-cols-3`). The arrangement half shows for containers only; the
// child-layout half shows for any node (harmless on a non-flex parent).
// Grid columns — fluid by default rather than a hardcoded breakpoint ramp.
// "Auto-fit (fluid)" emits `grid-cols-[repeat(auto-fit,minmax(<min>,1fr))]`: the
// grid fits as many columns of at least <min> as the row allows and wraps the rest
// — no `@2xl:grid-cols-2 @4xl:grid-cols-4` to maintain. Fixed counts (1–6) are
// still available; picking a fluid mode at the base layer clears any hardcoded
// responsive ramp so it actually takes effect. Per-breakpoint counts are still
// possible via the "Editing for" pill (writes that layer only).
function FlexGridCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  const arrange = readArrangeAs(node.class, prefix);
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  const setArrange = (v: 'row' | 'stack' | 'grid') => commit(applyArrangeAs(node.class, v, prefix));
  const isContainer = def.kind === 'container';
  return (
    <Card
      icon={LayoutGrid}
      title="Flexbox & Grid"
      summary={layoutSummary(node)}
      defaultOpen={isContainer}
      caption="How the blocks inside line up, and how this block sits inside its parent. Pick a screen size to make it responsive."
    >
      {selector}
      {isContainer ? (
        <>
          <Field label="Arrange as">
            <Segmented value={arrange} options={ARRANGE_OPTIONS} onChange={setArrange} />
          </Field>
          {arrange === 'grid' ? <ColumnsField node={node} prefix={prefix} commit={commit} /> : null}
          {/* Gap stays a size enum; distribution/alignment become icon toolbars. */}
          <StyleControlField
            node={node}
            def={def}
            control={GAP_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
          <IconChoiceField
            node={node}
            archetype={def.defaults.class}
            control={JUSTIFY_CONTROL}
            ctx={prefix}
            onClass={onClass}
            icons={JUSTIFY_ICONS}
          />
          <IconChoiceField
            node={node}
            archetype={def.defaults.class}
            control={ALIGN_ITEMS_CONTROL}
            ctx={prefix}
            onClass={onClass}
            icons={ALIGN_ITEMS_ICONS}
          />
          {arrange !== 'grid' ? (
            <StyleControlField
              node={node}
              def={def}
              control={FLEX_WRAP_CONTROL}
              prefix={prefix}
              onClass={onClass}
            />
          ) : null}
          {arrange === 'grid' ? (
            <Subgroup title="Grid detail">
              <GridRowsField node={node} prefix={prefix} commit={commit} />
              <StyleControlField
                node={node}
                def={def}
                control={GRID_FLOW_CONTROL}
                prefix={prefix}
                onClass={onClass}
              />
              <IconChoiceField
                node={node}
                archetype={def.defaults.class}
                control={JUSTIFY_ITEMS_CONTROL}
                ctx={prefix}
                onClass={onClass}
                icons={JUSTIFY_ITEMS_ICONS}
              />
              <IconChoiceField
                node={node}
                archetype={def.defaults.class}
                control={ALIGN_CONTENT_CONTROL}
                ctx={prefix}
                onClass={onClass}
                icons={ALIGN_CONTENT_ICONS}
              />
            </Subgroup>
          ) : null}
          <Subgroup title="Independent spacing">
            <div className="bx-row2">
              <LengthField
                label="Column gap"
                node={node}
                prefix="gap-x"
                ctx={prefix}
                presets={GAP_VALUE_PRESETS}
                commit={commit}
              />
              <LengthField
                label="Row gap"
                node={node}
                prefix="gap-y"
                ctx={prefix}
                presets={GAP_VALUE_PRESETS}
                commit={commit}
              />
            </div>
          </Subgroup>
        </>
      ) : null}
      {/* Child layout — how this block sizes / orders itself inside a flex or grid
          parent (grow, shrink, basis, order, align-self). Harmless on a non-flex
          parent, so shown for any node rather than threading the parent's display. */}
      <Subgroup title="As a child (in a flex/grid parent)">
        <div className="bx-row2">
          <StyleControlField
            node={node}
            def={def}
            control={FLEX_GROW_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
          <StyleControlField
            node={node}
            def={def}
            control={FLEX_SHRINK_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
        </div>
        <div className="bx-row2">
          <LengthField
            label="Basis"
            node={node}
            prefix="basis"
            ctx={prefix}
            presets={BASIS_PRESETS}
            commit={commit}
          />
          <LengthField
            label="Order"
            node={node}
            prefix="order"
            ctx={prefix}
            presets={ORDER_PRESETS}
            commit={commit}
          />
        </div>
        <IconChoiceField
          node={node}
          archetype={def.defaults.class}
          control={ALIGN_SELF_CONTROL}
          ctx={prefix}
          onClass={onClass}
          icons={ALIGN_SELF_ICONS}
        />
      </Subgroup>
    </Card>
  );
}

// Layout (Tailwind: Layout) — the box-level layout primitives that aren't flex/grid
// arrangement: display, overflow (clipping/scroll), and aspect ratio. Position +
// offsets + z-index keep their own card (the Position card) so the cascade reads
// cleanly. Per state / breakpoint via the pill. Shown for every node.
function LayoutCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  // A container's display is driven by the Flexbox & Grid card's "Arrange as"
  // (same token group); offering Display here too would fight it, so it's a
  // leaf-only control (matching the old SizeCard behavior).
  return (
    <Card
      icon={Frame}
      title="Layout"
      summary={generalLayoutSummary(node)}
      defaultOpen={false}
      caption="How the box itself behaves — display, clipping, and shape."
    >
      {selector}
      {def.kind === 'leaf' ? (
        <StyleControlField
          node={node}
          def={def}
          control={BOX_DISPLAY_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
      ) : null}
      <StyleControlField
        node={node}
        def={def}
        control={OVERFLOW_CONTROL}
        prefix={prefix}
        onClass={onClass}
      />
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={ASPECT_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="aspect"
      />
    </Card>
  );
}

// Grid row count — a plain enum (rows rarely need the fluid auto-fit treatment
// columns get). Reuses GRID_ROWS_CONTROL; the value writes `grid-rows-N` at the
// active layer.
function GridRowsField({
  node,
  prefix,
  commit,
}: {
  node: BuilderNode;
  prefix: string;
  commit: (cls: string) => void;
}) {
  return (
    <div className="bx-field">
      <span className="bx-field__label">{GRID_ROWS_CONTROL.label}</span>
      <NativeSelect
        size="sm"
        value={activeValue(node.class, GRID_ROWS_CONTROL, prefix) ?? ''}
        onChange={(e) =>
          commit(applyValue(node.class, GRID_ROWS_CONTROL, e.target.value || null, prefix))
        }
      >
        <option value="">Auto</option>
        {GRID_ROWS_CONTROL.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
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

// Behavior (docs/98 Pillar 5) — the ad-hoc authoring counterpart to the ready-made
// interactive composites. It marks a CONTAINER as a behavior ROOT (`props.behavior`)
// and/or any node as a structural PART (`props.sxRole`) of an enclosing behavior.
// The render walkers lower both to the controlled `data-sx-*` vocabulary the runtime
// reads — nothing here emits raw `data-*`. Web surfaces only (the runtime doesn't run
// in email). The composites bake these in; this card builds new ones by hand.
const SX_ROLE_LABELS: Record<string, string> = {
  track: 'Track (slide / marquee rail)',
  slide: 'Slide',
  prev: 'Previous button',
  next: 'Next button',
  dot: 'Dot (pagination)',
  dots: 'Dots container',
  trigger: 'Trigger (opens a panel)',
  panel: 'Panel (revealed content)',
  item: 'Item (one accordion row)',
  tab: 'Tab button',
  spy: 'Section link (scroll highlight)',
};

interface BehaviorSpec {
  type: string;
  [param: string]: string | number | boolean;
}

function readBehaviorSpec(node: BuilderNode): BehaviorSpec | null {
  const b = node.props.behavior;
  if (b && typeof b === 'object' && typeof (b as { type?: unknown }).type === 'string') {
    return b as BehaviorSpec;
  }
  return null;
}

function behaviorDefaults(desc: BehaviorDescriptor): BehaviorSpec {
  const spec: BehaviorSpec = { type: desc.name };
  for (const p of desc.params) spec[p.key] = p.default;
  return spec;
}

function behaviorSummary(node: BuilderNode): string | undefined {
  const spec = readBehaviorSpec(node);
  const role = typeof node.props.sxRole === 'string' ? node.props.sxRole : null;
  const parts: string[] = [];
  if (spec) parts.push(BEHAVIOR_DESCRIPTORS.find((d) => d.name === spec.type)?.label ?? spec.type);
  if (role) parts.push(SX_ROLE_LABELS[role] ?? role);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function BehaviorCard({
  node,
  def,
  onProp,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onProp: (key: string, value: unknown) => void;
}) {
  const spec = readBehaviorSpec(node);
  const desc = spec ? (BEHAVIOR_DESCRIPTORS.find((d) => d.name === spec.type) ?? null) : null;
  const role = typeof node.props.sxRole === 'string' ? node.props.sxRole : '';
  const isContainer = def.kind === 'container';

  const setType = (name: string) => {
    if (!name) {
      onProp('behavior', undefined);
      return;
    }
    const d = BEHAVIOR_DESCRIPTORS.find((x) => x.name === name);
    onProp('behavior', d ? behaviorDefaults(d) : { type: name });
  };
  const setParam = (key: string, value: string | number | boolean) => {
    if (spec) onProp('behavior', { ...spec, [key]: value });
  };

  return (
    <Card
      icon={Zap}
      title="Behavior"
      summary={behaviorSummary(node)}
      defaultOpen={false}
      caption="Make this an interactive component — a carousel, menu, accordion, tabs… driven by the same runtime the ready-made interactive blocks use. No code."
    >
      {isContainer ? (
        <>
          <Field label="This block is a">
            <NativeSelect
              size="sm"
              value={spec?.type ?? ''}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">— Not interactive —</option>
              {BEHAVIOR_DESCRIPTORS.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {desc ? (
            <>
              <p className="bx-inspector__tip">{desc.help}</p>
              {desc.params.map((p) =>
                p.kind === 'bool' ? (
                  <div key={p.key} className="bx-row">
                    <span className="bx-field__label">{p.label}</span>
                    <Switch
                      checked={Boolean(spec?.[p.key] ?? p.default)}
                      onCheckedChange={(v) => setParam(p.key, v)}
                    />
                  </div>
                ) : (
                  <Field key={p.key} label={p.label}>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={String(spec?.[p.key] ?? p.default)}
                      onChange={(e) => setParam(p.key, Number(e.target.value) || 0)}
                    />
                  </Field>
                )
              )}
            </>
          ) : null}
        </>
      ) : null}
      <Field label="Part of a behavior">
        <NativeSelect
          size="sm"
          value={role}
          onChange={(e) => onProp('sxRole', e.target.value || undefined)}
        >
          <option value="">— None —</option>
          {SX_ROLES.map((r) => (
            <option key={r} value={r}>
              {SX_ROLE_LABELS[r] ?? r}
            </option>
          ))}
        </NativeSelect>
      </Field>
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
  ctx = '',
  presets,
  hint,
  commit,
}: {
  label: string;
  node: BuilderNode;
  prefix: string;
  /** The responsive/state layer this value writes into (`@lg:`, `hover:`); '' = base. */
  ctx?: string;
  presets: LengthPreset[];
  hint?: string;
  commit: (cls: string) => void;
}) {
  const current = readValueGroup(node.class, prefix, ctx);
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
            commit(applyValueGroup(node.class, prefix, v || null, ctx));
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
          onBlur={() => commit(applyValueGroup(node.class, prefix, lengthSuffix(text), ctx))}
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
  ctx = '',
  hint,
  commit,
}: {
  label: string;
  node: BuilderNode;
  shorthand: string;
  /** [top, right, bottom, left] prefixes, e.g. ['pt','pr','pb','pl']. */
  sides: [string, string, string, string];
  /** The responsive layer this writes into (`@lg:`); '' = base. */
  ctx?: string;
  hint?: string;
  commit: (cls: string) => void;
}) {
  const shVal = readValueGroup(node.class, shorthand, ctx);
  const sideVals = sides.map((s) => readValueGroup(node.class, s, ctx)) as [
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
    sides.forEach((s) => (c = applyValueGroup(c, s, null, ctx)));
    commit(applyValueGroup(c, shorthand, suffix, ctx));
  };
  const commitSide = (i: number, suffix: string | null) => {
    let c = applyValueGroup(node.class, shorthand, null, ctx);
    c = applyValueGroup(c, sides[i]!, suffix, ctx);
    commit(c);
  };
  const toggleLink = () => {
    let c = node.class ?? '';
    if (linked) {
      const v = shVal;
      c = applyValueGroup(c, shorthand, null, ctx);
      sides.forEach((s) => (c = applyValueGroup(c, s, v, ctx)));
      commit(c);
      setLinked(false);
    } else {
      const v = sideVals[0];
      sides.forEach((s) => (c = applyValueGroup(c, s, null, ctx)));
      commit(applyValueGroup(c, shorthand, v, ctx));
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
function OpacitySlider({
  node,
  ctx = '',
  commit,
}: {
  node: BuilderNode;
  ctx?: string;
  commit: (cls: string) => void;
}) {
  const raw = readValueGroup(node.class, 'opacity', ctx);
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
            commit(applyValueGroup(node.class, 'opacity', n === 100 ? null : String(n), ctx));
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

// The per-card responsive/state layer state + its pill. A card calls this to get
// the active variant `prefix` and the ContextSelect to render; the prefix flows
// into every control below so a screen size / Hover / Dark edits that layer only
// (docs/builder/04 §2.3). `contexts` is surface-scoped by the Inspector — email
// collapses to [base] (mail clients strip state/breakpoint variants).
function useLayerContext(contexts: StyleContext[]): {
  prefix: string;
  selector: React.ReactNode;
} {
  const [ctx, setCtx] = React.useState('base');
  const prefix = contextPrefix(contexts, ctx);
  const selector =
    contexts.length > 1 ? (
      <ContextSelect contexts={contexts} value={ctx} onChange={setCtx} />
    ) : null;
  return { prefix, selector };
}

// A color utility with an optional opacity modifier (`text-primary/75`,
// docs/builder/04 §2.1). The color is an enum (`control`); the opacity is the
// Tailwind alpha scale. Writes through applyColorOpacity so the slash round-trips
// and the group stays single-token at its layer. Opacity is hidden until a color
// is chosen (there's nothing to fade otherwise).
// Colour + opacity (background / text / border). The themed swatch grid — real
// tenant colours, an opacity slider, and (for text) a live AA/AAA contrast badge —
// replaces the old colour/opacity `<select>` pair. Writing is unchanged: the same
// `applyColorOpacity` class-group writer, via ColorSwatchField's `withOpacity`.
function ColorOpacityField({
  node,
  def,
  control,
  ctx = '',
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  control: ClassControl;
  ctx?: string;
  onClass: (value: string) => void;
}) {
  const isText = control.id === TEXT_COLOR_CONTROL.id;
  return (
    <ColorSwatchField
      node={node}
      archetype={def.defaults.class}
      control={control}
      ctx={ctx}
      onClass={onClass}
      withOpacity
      mode={isText ? 'text' : 'fill'}
      showContrast={isText}
    />
  );
}

// A 4-edge enum widget (per-side border width / per-corner radius) with a link-all
// toggle, mirroring BoxSidesField but for ENUM groups. Linked → the shorthand
// control (`border` / `rounded`) drives all edges and the per-edge tokens are
// cleared; unlinked → each edge writes its own token and the shorthand is cleared,
// so the two never fight. Values map across by option `value` on link/unlink.
function QuadEnumField({
  label,
  node,
  def,
  ctx = '',
  shorthand,
  edges,
  onClass,
}: {
  label: string;
  node: BuilderNode;
  def: ComponentDef;
  ctx?: string;
  shorthand: ClassControl;
  /** [top/right/bottom/left] or [tl/tr/br/bl] controls, with display labels. */
  edges: { label: string; control: ClassControl }[];
  onClass: (value: string) => void;
}) {
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  const shVal = activeValue(node.class, shorthand, ctx);
  const edgeVals = edges.map((e) => activeValue(node.class, e.control, ctx));
  const anyEdge = edgeVals.some((v) => v !== null);
  const [linked, setLinked] = React.useState(!anyEdge);

  const setShorthand = (value: string | null) => {
    let c = node.class ?? '';
    edges.forEach((e) => (c = applyValue(c, e.control, null, ctx)));
    commit(applyValue(c, shorthand, value, ctx));
  };
  const setEdge = (i: number, value: string | null) => {
    let c = applyValue(node.class, shorthand, null, ctx);
    c = applyValue(c, edges[i]!.control, value, ctx);
    commit(c);
  };
  const toggleLink = () => {
    let c = node.class ?? '';
    if (linked) {
      edges.forEach((e) => (c = applyValue(c, e.control, shVal, ctx)));
      commit(applyValue(c, shorthand, null, ctx));
      setLinked(false);
    } else {
      const v = edgeVals[0] ?? null;
      edges.forEach((e) => (c = applyValue(c, e.control, null, ctx)));
      commit(applyValue(c, shorthand, v, ctx));
      setLinked(true);
    }
  };

  return (
    <div className="bx-field">
      <div className="bx-quad__head">
        <span className="bx-field__label">{label}</span>
        <button
          type="button"
          className="bx-quad__link"
          data-on={linked}
          aria-pressed={linked}
          title={linked ? 'Edges linked — edit one, all change' : 'Edges independent'}
          onClick={toggleLink}
        >
          <Link2 aria-hidden /> {linked ? 'Linked' : 'Per edge'}
        </button>
      </div>
      {linked ? (
        <NativeSelect
          size="sm"
          aria-label={label}
          value={shVal ?? ''}
          onChange={(e) => setShorthand(e.target.value || null)}
        >
          <option value="">Default</option>
          {shorthand.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <div className="bx-quad">
          {edges.map((e, i) => (
            <label key={e.label} className="bx-quad__edge">
              <span>{e.label}</span>
              <NativeSelect
                size="sm"
                aria-label={`${label} — ${e.label}`}
                value={edgeVals[i] ?? ''}
                onChange={(ev) => setEdge(i, ev.target.value || null)}
              >
                <option value="">—</option>
                {e.control.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// The static background IMAGE (docs/61) — authored as node PROPS (bgImage URL +
// fit / focal point / overlay), rendered to inline style by the canvas + live
// renderer's `backgroundStyleFor`. Deliberately NOT a class: an arbitrary
// bracketed CSS-url background utility is blocked by the compile allowlist
// (docs/61 §8 — exfiltration), so a media-backed image rides a prop instead,
// exactly as it already renders.
const BG_FOCAL_OPTIONS = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top-left', label: 'Top-left' },
  { value: 'top-right', label: 'Top-right' },
  { value: 'bottom-left', label: 'Bottom-left' },
  { value: 'bottom-right', label: 'Bottom-right' },
];
const BG_OVERLAY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'dark', label: 'Dark scrim' },
  { value: 'light', label: 'Light scrim' },
  { value: 'gradient', label: 'Gradient scrim' },
];
function BackgroundImageField({
  node,
  onProp,
}: {
  node: BuilderNode;
  onProp: (key: string, value: unknown) => void;
}) {
  const url = typeof node.props.bgImage === 'string' ? node.props.bgImage : '';
  const [text, setText] = React.useState(url);
  React.useEffect(() => setText(url), [url]);
  const fit = node.props.bgFit === 'contain' ? 'contain' : 'cover';
  const position = typeof node.props.bgPosition === 'string' ? node.props.bgPosition : 'center';
  const overlay = typeof node.props.bgOverlay === 'string' ? node.props.bgOverlay : 'none';
  return (
    <div className="bx-field">
      <span className="bx-field__label">Image</span>
      <Input
        size="sm"
        value={text}
        placeholder="Image URL — https://…/photo.jpg"
        aria-label="Background image URL"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={() => onProp('bgImage', text.trim() || undefined)}
      />
      {url ? (
        <div className="bx-row2">
          <Field label="Fit">
            <NativeSelect size="sm" value={fit} onChange={(e) => onProp('bgFit', e.target.value)}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </NativeSelect>
          </Field>
          <Field label="Focal point">
            <NativeSelect
              size="sm"
              value={position}
              onChange={(e) => onProp('bgPosition', e.target.value)}
            >
              {BG_FOCAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      ) : null}
      {url ? (
        <Field label="Overlay">
          <NativeSelect
            size="sm"
            value={overlay}
            onChange={(e) => onProp('bgOverlay', e.target.value)}
          >
            {BG_OVERLAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
    </div>
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
const INDENT_PRESETS: LengthPreset[] = [
  { label: 'None', suffix: '0' },
  { label: 'S', suffix: '4' },
  { label: 'M', suffix: '8' },
  { label: 'L', suffix: '12' },
];
const SCALE_PRESETS: LengthPreset[] = [
  { label: '90%', suffix: '90' },
  { label: '95%', suffix: '95' },
  { label: '100%', suffix: '100' },
  { label: '105%', suffix: '105' },
  { label: '110%', suffix: '110' },
];
// Signed rotate / translate (the Transforms card) — negatives ride the same value
// group (`-rotate-6` → suffix `-6`); a bare custom value covers anything else.
const ROTATE_SIGNED_PRESETS: LengthPreset[] = [
  { label: '-12°', suffix: '-12' },
  { label: '-6°', suffix: '-6' },
  { label: '0°', suffix: '0' },
  { label: '3°', suffix: '3' },
  { label: '6°', suffix: '6' },
  { label: '12°', suffix: '12' },
  { label: '45°', suffix: '45' },
  { label: '90°', suffix: '90' },
];
const MOVE_SIGNED_PRESETS: LengthPreset[] = [
  { label: '-2', suffix: '-2' },
  { label: '-1', suffix: '-1' },
  { label: 'None', suffix: '0' },
  { label: '1', suffix: '1' },
  { label: '2', suffix: '2' },
  { label: 'Full', suffix: 'full' },
];
// Hue rotate (degrees) — signed; the Filters card. Custom covers any angle.
const HUE_PRESETS: LengthPreset[] = [
  { label: '-90°', suffix: '-90' },
  { label: '-15°', suffix: '-15' },
  { label: '15°', suffix: '15' },
  { label: '30°', suffix: '30' },
  { label: '60°', suffix: '60' },
  { label: '90°', suffix: '90' },
  { label: '180°', suffix: '180' },
];
// Backdrop opacity (the Filters card backdrop family) — the Tailwind opacity scale.
const OPACITY_VALUE_PRESETS: LengthPreset[] = [
  { label: '10%', suffix: '10' },
  { label: '25%', suffix: '25' },
  { label: '50%', suffix: '50' },
  { label: '75%', suffix: '75' },
  { label: '90%', suffix: '90' },
];
// Spacing scale steps for the independent gap / filter-intensity value fields.
const GAP_VALUE_PRESETS: LengthPreset[] = [
  { label: 'None', suffix: '0' },
  { label: 'S', suffix: '2' },
  { label: 'M', suffix: '4' },
  { label: 'L', suffix: '6' },
  { label: 'XL', suffix: '8' },
];
const FILTER_PRESETS: LengthPreset[] = [
  { label: '50%', suffix: '50' },
  { label: '75%', suffix: '75' },
  { label: '100%', suffix: '100' },
  { label: '110%', suffix: '110' },
  { label: '125%', suffix: '125' },
  { label: '150%', suffix: '150' },
];
const SKEW_PRESETS: LengthPreset[] = [
  { label: '0°', suffix: '0' },
  { label: '3°', suffix: '3' },
  { label: '6°', suffix: '6' },
  { label: '12°', suffix: '12' },
];
const DURATION_PRESETS: LengthPreset[] = [
  { label: 'Fast (150ms)', suffix: '150' },
  { label: 'Default (300ms)', suffix: '300' },
  { label: 'Slow (500ms)', suffix: '500' },
  { label: 'Slower (700ms)', suffix: '700' },
];
const ORDER_PRESETS: LengthPreset[] = [
  { label: 'First', suffix: 'first' },
  { label: 'Last', suffix: 'last' },
  { label: 'None', suffix: 'none' },
];
const BASIS_PRESETS: LengthPreset[] = [
  { label: 'Auto', suffix: 'auto' },
  { label: 'Full', suffix: 'full' },
  { label: 'Half', suffix: '1/2' },
  { label: 'Third', suffix: '1/3' },
];

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
function backgroundSummary(node: BuilderNode): string {
  if (activeValue(node.class, GRADIENT_DIRECTION_CONTROL)) return 'Gradient';
  if (typeof node.props.bgImage === 'string' && node.props.bgImage) return 'Image';
  // A recipe fill reports colour + treatment (Primary · Soft); a flat surface tone
  // reports its name; nothing set → None.
  const color = activeLabel(node, COLOR_CONTROL);
  if (color) {
    const emphasis = activeLabel(node, VARIANT_CONTROL);
    return emphasis ? `${color} · ${emphasis}` : color;
  }
  return activeLabel(node, BG_SURFACE_CONTROL) ?? 'None';
}
function effectsSummary(node: BuilderNode): string {
  return (
    [
      activeLabel(node, SHADOW_CONTROL),
      activeLabel(node, RING_CONTROL),
      readValueGroup(node.class, 'opacity') ? 'Opacity' : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'None'
  );
}
function filtersSummary(node: BuilderNode): string {
  return (
    [
      activeLabel(node, BLUR_CONTROL) && 'Blur',
      readValueGroup(node.class, 'brightness') && 'Brightness',
      activeLabel(node, GRAYSCALE_CONTROL) === 'On' && 'Grayscale',
      activeLabel(node, DROP_SHADOW_CONTROL) && 'Drop shadow',
    ]
      .filter(Boolean)
      .join(' · ') || 'None'
  );
}
function transformsSummary(node: BuilderNode): string {
  return (
    [
      readValueGroup(node.class, 'scale') && 'Scale',
      readValueGroup(node.class, 'rotate') && 'Rotate',
      (readValueGroup(node.class, 'translate-x') ?? readValueGroup(node.class, 'translate-y')) &&
        'Move',
    ]
      .filter(Boolean)
      .join(' · ') || 'None'
  );
}
function transitionsSummary(node: BuilderNode): string {
  return (
    [activeLabel(node, TRANSITION_CONTROL), activeLabel(node, ANIMATE_CONTROL)]
      .filter(Boolean)
      .join(' · ') || 'None'
  );
}
function interactivitySummary(node: BuilderNode): string {
  return (
    [activeLabel(node, CURSOR_CONTROL), activeLabel(node, USER_SELECT_CONTROL)]
      .filter(Boolean)
      .join(' · ') || 'Default'
  );
}
function tablesSummary(node: BuilderNode): string {
  return (
    activeLabel(node, BORDER_COLLAPSE_CONTROL) ??
    activeLabel(node, TABLE_LAYOUT_CONTROL) ??
    'Default'
  );
}
function svgSummary(node: BuilderNode): string {
  return (
    [activeLabel(node, FILL_CONTROL), activeLabel(node, STROKE_CONTROL)]
      .filter(Boolean)
      .join(' · ') || 'Inherited'
  );
}

// ── Power-user style sections ───────────────────────────────────────────────────

// Sizing (Tailwind: Sizing) — width / height (preset + Custom) and a Min & max
// reveal. Display moved to the Layout card; aspect / overflow to Layout; the
// flex/grid child-sizing controls to the Flexbox & Grid card (Tailwind's home for
// them). Per-breakpoint via the "Editing for" pill (docs/builder/04 §2.3).
function SizeCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  return (
    <Card icon={Maximize2} title="Sizing" summary={sizeSummary(node)} defaultOpen={false}>
      {selector}
      <div className="bx-row2">
        <LengthField
          label="Width"
          node={node}
          prefix="w"
          ctx={prefix}
          presets={WIDTH_PRESETS}
          commit={commit}
        />
        <LengthField
          label="Height"
          node={node}
          prefix="h"
          ctx={prefix}
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
            ctx={prefix}
            presets={MINW_PRESETS}
            commit={commit}
          />
          <LengthField
            label="Max width"
            node={node}
            prefix="max-w"
            ctx={prefix}
            presets={MAXW_PRESETS}
            commit={commit}
          />
        </div>
        <div className="bx-row2">
          <LengthField
            label="Min height"
            node={node}
            prefix="min-h"
            ctx={prefix}
            presets={MINH_PRESETS}
            commit={commit}
          />
          <LengthField
            label="Max height"
            node={node}
            prefix="max-h"
            ctx={prefix}
            presets={MAXH_PRESETS}
            commit={commit}
          />
        </div>
      </Subgroup>
    </Card>
  );
}

// Spacing — padding (inner) + margin (outer) as 4-side box-model widgets, per
// breakpoint via the "Editing for" pill.
function SpacingCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  return (
    <Card icon={Box} title="Spacing" summary={spacingSummary(node)} defaultOpen={false}>
      {selector}
      <BoxSidesField
        label="Inner spacing (padding)"
        node={node}
        shorthand="p"
        sides={['pt', 'pr', 'pb', 'pl']}
        ctx={prefix}
        hint="A step (4 = 1rem) or a value (16px). Link applies one value to all sides."
        commit={commit}
      />
      <BoxSidesField
        label="Outer spacing (margin)"
        node={node}
        shorthand="m"
        sides={['mt', 'mr', 'mb', 'ml']}
        ctx={prefix}
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
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  const positioned = activeValue(node.class, POSITION_CONTROL, prefix) !== null;
  return (
    <Card icon={Crosshair} title="Position" summary={positionSummary(node)} defaultOpen={false}>
      {selector}
      <StyleControlField
        node={node}
        def={def}
        control={POSITION_CONTROL}
        prefix={prefix}
        onClass={onClass}
      />
      {positioned ? (
        <div className="bx-reveal">
          <span className="bx-field__label">Offsets</span>
          <div className="bx-row2">
            <LengthField
              label="Top"
              node={node}
              prefix="top"
              ctx={prefix}
              presets={OFFSET_PRESETS}
              commit={commit}
            />
            <LengthField
              label="Right"
              node={node}
              prefix="right"
              ctx={prefix}
              presets={OFFSET_PRESETS}
              commit={commit}
            />
          </div>
          <div className="bx-row2">
            <LengthField
              label="Bottom"
              node={node}
              prefix="bottom"
              ctx={prefix}
              presets={OFFSET_PRESETS}
              commit={commit}
            />
            <LengthField
              label="Left"
              node={node}
              prefix="left"
              ctx={prefix}
              presets={OFFSET_PRESETS}
              commit={commit}
            />
          </div>
          <StyleControlField
            node={node}
            def={def}
            control={Z_INDEX_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
        </div>
      ) : null}
    </Card>
  );
}

// Background — a free fill color (+ opacity), a gradient (direction + stops), a
// static image (props → inline style), and how it fits / positions / repeats.
// Per state / breakpoint via the pill (a hover or @lg background). The recipe
// (Style card) stays the everyday default; this is the escape from its ceiling.
function BackgroundCard({
  node,
  def,
  contexts,
  onClass,
  onProp,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
  onProp: (key: string, value: unknown) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  const hasGradient = activeValue(node.class, GRADIENT_DIRECTION_CONTROL, prefix) !== null;
  return (
    <Card icon={Palette} title="Background" summary={backgroundSummary(node)} defaultOpen={false}>
      {/* Fill = colour × Emphasis (recipe) or a flat surface tone. Base layer only
          (the recipe classes are static CSS, not per-breakpoint utilities), so it
          sits ABOVE the layer pill — which governs the gradient / image below. */}
      <BackgroundFillField node={node} archetype={def.defaults.class} onClass={onClass} />
      {selector}
      <Subgroup title="Gradient">
        <IconChoiceField
          node={node}
          archetype={def.defaults.class}
          control={GRADIENT_DIRECTION_CONTROL}
          ctx={prefix}
          onClass={onClass}
          icons={GRADIENT_DIR_ICONS}
        />
        {hasGradient ? (
          <>
            <ColorSwatchField
              node={node}
              archetype={def.defaults.class}
              control={GRADIENT_FROM_CONTROL}
              ctx={prefix}
              onClass={onClass}
              density="compact"
            />
            <ColorSwatchField
              node={node}
              archetype={def.defaults.class}
              control={GRADIENT_VIA_CONTROL}
              ctx={prefix}
              onClass={onClass}
              density="compact"
            />
            <ColorSwatchField
              node={node}
              archetype={def.defaults.class}
              control={GRADIENT_TO_CONTROL}
              ctx={prefix}
              onClass={onClass}
              density="compact"
            />
          </>
        ) : null}
      </Subgroup>
      <Subgroup title="Image">
        <BackgroundImageField node={node} onProp={onProp} />
        <div className="bx-row2">
          <StyleControlField
            node={node}
            def={def}
            control={BG_SIZE_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
          <StyleControlField
            node={node}
            def={def}
            control={BG_REPEAT_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
        </div>
        <PositionPadField
          node={node}
          archetype={def.defaults.class}
          control={BG_POSITION_CONTROL}
          ctx={prefix}
          onClass={onClass}
        />
      </Subgroup>
    </Card>
  );
}

// Borders — width / style / color (+ opacity) / corners, plus per-side width and
// per-corner radius widgets. Per state / breakpoint via the pill.
function BordersCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  return (
    <Card icon={Square} title="Borders" summary={bordersSummary(node)} defaultOpen={false}>
      {selector}
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={BORDER_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="border"
      />
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={BORDER_STYLE_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="borderStyle"
      />
      <ColorOpacityField
        node={node}
        def={def}
        control={BORDER_COLOR_CONTROL}
        ctx={prefix}
        onClass={onClass}
      />
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={RADIUS_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="radius"
      />
      <Subgroup title="Per edge & corner">
        <QuadEnumField
          label="Border width"
          node={node}
          def={def}
          ctx={prefix}
          shorthand={BORDER_CONTROL}
          edges={BORDER_SIDES.map((s) => ({ label: s.label, control: borderSideControl(s.key) }))}
          onClass={onClass}
        />
        <QuadEnumField
          label="Corner radius"
          node={node}
          def={def}
          ctx={prefix}
          shorthand={RADIUS_CONTROL}
          edges={RADIUS_CORNERS.map((c) => ({
            label: c.label,
            control: radiusCornerControl(c.key),
          }))}
          onClass={onClass}
        />
      </Subgroup>
    </Card>
  );
}

// Style — the everyday "how it looks" card: the recipe axes (Color + Emphasis),
// written to `node.class`. The recipe is the COMMON default and stays open; the
// free fills / type / edges / effects live in their own (collapsed) cards so the
// default view never crowds (docs/builder/04 §2.5). Identical on every surface.
function StyleCard({
  node,
  def,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
}) {
  // Both recipe axes render as visual swatch grids in real tenant colours: Colour
  // previews each slot in the node's current Emphasis; Emphasis previews the node's
  // current Colour in each treatment. They cross-preview, so the pair reads as one
  // "here's exactly what it'll look like" surface — no dropdowns.
  const emphasis = activeValue(node.class, VARIANT_CONTROL) ?? 'solid';
  return (
    <Card icon={Palette} title="Style" summary={styleSummary(node)}>
      {STYLE_CONTROLS.map((control) =>
        control.id === VARIANT_CONTROL.id ? (
          <EmphasisSwatchField
            key={control.id}
            node={node}
            archetype={def.defaults.class}
            control={control}
            onClass={onClass}
          />
        ) : (
          <ColorSwatchField
            key={control.id}
            node={node}
            archetype={def.defaults.class}
            control={control}
            mode="recipe"
            emphasisVariant={emphasis}
            onClass={onClass}
          />
        )
      )}
    </Card>
  );
}

// Effects (Tailwind: Effects) — opacity, shadow (+ color), ring (+ color), blend
// mode. Filters / Transforms / Transitions are their own Tailwind sections (their
// own cards below). Per state / breakpoint via the pill (a hover ring).
function EffectsCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  return (
    <Card icon={Sparkles} title="Effects" summary={effectsSummary(node)} defaultOpen={false}>
      {selector}
      <OpacitySlider node={node} ctx={prefix} commit={commit} />
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={SHADOW_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="shadow"
      />
      <ColorSwatchField
        node={node}
        archetype={def.defaults.class}
        control={SHADOW_COLOR_CONTROL}
        ctx={prefix}
        onClass={onClass}
        density="compact"
      />
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={RING_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="ring"
      />
      <ColorSwatchField
        node={node}
        archetype={def.defaults.class}
        control={RING_COLOR_CONTROL}
        ctx={prefix}
        onClass={onClass}
        density="compact"
      />
      <StyleControlField
        node={node}
        def={def}
        control={MIX_BLEND_CONTROL}
        prefix={prefix}
        onClass={onClass}
      />
    </Card>
  );
}

// Filters (Tailwind: Filters) — blur, brightness, contrast, saturate, grayscale,
// sepia, invert, hue-rotate, drop-shadow, plus the full backdrop-filter family
// (what shows THROUGH a translucent element — frosted glass). Per state /
// breakpoint via the pill. Shown for every node.
function FiltersCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  return (
    <Card icon={Aperture} title="Filters" summary={filtersSummary(node)} defaultOpen={false}>
      {selector}
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={BLUR_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="blur"
      />
      <div className="bx-row2">
        <LengthField
          label="Brightness"
          node={node}
          prefix="brightness"
          ctx={prefix}
          presets={FILTER_PRESETS}
          commit={commit}
        />
        <LengthField
          label="Contrast"
          node={node}
          prefix="contrast"
          ctx={prefix}
          presets={FILTER_PRESETS}
          commit={commit}
        />
      </div>
      <div className="bx-row2">
        <LengthField
          label="Saturation"
          node={node}
          prefix="saturate"
          ctx={prefix}
          presets={FILTER_PRESETS}
          commit={commit}
        />
        <LengthField
          label="Hue rotate"
          node={node}
          prefix="hue-rotate"
          ctx={prefix}
          presets={HUE_PRESETS}
          commit={commit}
        />
      </div>
      <SwitchField
        node={node}
        archetype={def.defaults.class}
        control={GRAYSCALE_CONTROL}
        ctx={prefix}
        onClass={onClass}
      />
      <SwitchField
        node={node}
        archetype={def.defaults.class}
        control={SEPIA_CONTROL}
        ctx={prefix}
        onClass={onClass}
      />
      <SwitchField
        node={node}
        archetype={def.defaults.class}
        control={INVERT_CONTROL}
        ctx={prefix}
        onClass={onClass}
      />
      <StyleControlField
        node={node}
        def={def}
        control={DROP_SHADOW_CONTROL}
        prefix={prefix}
        onClass={onClass}
      />
      <Subgroup title="Backdrop (behind a translucent element)">
        <StyleControlField
          node={node}
          def={def}
          control={BACKDROP_BLUR_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
        <div className="bx-row2">
          <LengthField
            label="Backdrop brightness"
            node={node}
            prefix="backdrop-brightness"
            ctx={prefix}
            presets={FILTER_PRESETS}
            commit={commit}
          />
          <LengthField
            label="Backdrop contrast"
            node={node}
            prefix="backdrop-contrast"
            ctx={prefix}
            presets={FILTER_PRESETS}
            commit={commit}
          />
        </div>
        <div className="bx-row2">
          <LengthField
            label="Backdrop saturation"
            node={node}
            prefix="backdrop-saturate"
            ctx={prefix}
            presets={FILTER_PRESETS}
            commit={commit}
          />
          <LengthField
            label="Backdrop opacity"
            node={node}
            prefix="backdrop-opacity"
            ctx={prefix}
            presets={OPACITY_VALUE_PRESETS}
            commit={commit}
          />
        </div>
        <StyleControlField
          node={node}
          def={def}
          control={BACKDROP_GRAYSCALE_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
      </Subgroup>
    </Card>
  );
}

// Transforms (Tailwind: Transforms) — scale (uniform + per-axis), rotate,
// translate, skew, and transform-origin. These pair naturally with a Hover /
// Focus context for interactive effects. Per state / breakpoint via the pill.
function TransformsCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  return (
    <Card icon={Move3d} title="Transforms" summary={transformsSummary(node)} defaultOpen={false}>
      {selector}
      <div className="bx-row2">
        <LengthField
          label="Scale"
          node={node}
          prefix="scale"
          ctx={prefix}
          presets={SCALE_PRESETS}
          commit={commit}
        />
        <LengthField
          label="Rotate"
          node={node}
          prefix="rotate"
          ctx={prefix}
          presets={ROTATE_SIGNED_PRESETS}
          commit={commit}
        />
      </div>
      <div className="bx-row2">
        <LengthField
          label="Scale X"
          node={node}
          prefix="scale-x"
          ctx={prefix}
          presets={SCALE_PRESETS}
          commit={commit}
        />
        <LengthField
          label="Scale Y"
          node={node}
          prefix="scale-y"
          ctx={prefix}
          presets={SCALE_PRESETS}
          commit={commit}
        />
      </div>
      <div className="bx-row2">
        <LengthField
          label="Move X"
          node={node}
          prefix="translate-x"
          ctx={prefix}
          presets={MOVE_SIGNED_PRESETS}
          commit={commit}
        />
        <LengthField
          label="Move Y"
          node={node}
          prefix="translate-y"
          ctx={prefix}
          presets={MOVE_SIGNED_PRESETS}
          commit={commit}
        />
      </div>
      <div className="bx-row2">
        <LengthField
          label="Skew X"
          node={node}
          prefix="skew-x"
          ctx={prefix}
          presets={SKEW_PRESETS}
          commit={commit}
        />
        <LengthField
          label="Skew Y"
          node={node}
          prefix="skew-y"
          ctx={prefix}
          presets={SKEW_PRESETS}
          commit={commit}
        />
      </div>
      <StyleControlField
        node={node}
        def={def}
        control={TRANSFORM_ORIGIN_CONTROL}
        prefix={prefix}
        onClass={onClass}
      />
    </Card>
  );
}

// Transitions & Animation (Tailwind: Transitions & Animation) — what transitions,
// how long, the easing curve, the delay, and a raw animation (animate-*). The
// entrance Motion card (docs/61 §9) stays separate — it's the friendly,
// cross-surface "how this block appears"; this is the raw Tailwind surface. Per
// state / breakpoint via the pill.
function TransitionsCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  return (
    <Card
      icon={Play}
      title="Transitions & Animation"
      summary={transitionsSummary(node)}
      defaultOpen={false}
    >
      {selector}
      <div className="bx-row2">
        <StyleControlField
          node={node}
          def={def}
          control={TRANSITION_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
        <StyleControlField
          node={node}
          def={def}
          control={EASE_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
      </div>
      <div className="bx-row2">
        <LengthField
          label="Duration"
          node={node}
          prefix="duration"
          ctx={prefix}
          presets={DURATION_PRESETS}
          commit={commit}
        />
        <LengthField
          label="Delay"
          node={node}
          prefix="delay"
          ctx={prefix}
          presets={DURATION_PRESETS}
          commit={commit}
        />
      </div>
      <StyleControlField
        node={node}
        def={def}
        control={ANIMATE_CONTROL}
        prefix={prefix}
        onClass={onClass}
      />
    </Card>
  );
}

// Interactivity (Tailwind: Interactivity) — cursor, text selection, pointer
// events, resize, scroll behavior + snap, native appearance, touch action,
// will-change, and the caret / accent token colors. Per state / breakpoint via
// the pill. Shown for every node.
function InteractivityCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  return (
    <Card
      icon={MousePointerClick}
      title="Interactivity"
      summary={interactivitySummary(node)}
      defaultOpen={false}
    >
      {selector}
      <div className="bx-row2">
        <StyleControlField
          node={node}
          def={def}
          control={CURSOR_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
        <StyleControlField
          node={node}
          def={def}
          control={USER_SELECT_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
      </div>
      <div className="bx-row2">
        <StyleControlField
          node={node}
          def={def}
          control={POINTER_EVENTS_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
        <StyleControlField
          node={node}
          def={def}
          control={RESIZE_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
      </div>
      <ColorSwatchField
        node={node}
        archetype={def.defaults.class}
        control={CARET_COLOR_CONTROL}
        ctx={prefix}
        onClass={onClass}
        density="compact"
      />
      <ColorSwatchField
        node={node}
        archetype={def.defaults.class}
        control={ACCENT_COLOR_CONTROL}
        ctx={prefix}
        onClass={onClass}
        density="compact"
      />
      <Subgroup title="Scrolling & touch">
        <div className="bx-row2">
          <StyleControlField
            node={node}
            def={def}
            control={SCROLL_BEHAVIOR_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
          <StyleControlField
            node={node}
            def={def}
            control={SCROLL_SNAP_TYPE_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
        </div>
        <div className="bx-row2">
          <StyleControlField
            node={node}
            def={def}
            control={SCROLL_SNAP_ALIGN_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
          <StyleControlField
            node={node}
            def={def}
            control={TOUCH_ACTION_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
        </div>
      </Subgroup>
      <Subgroup title="Advanced">
        <div className="bx-row2">
          <StyleControlField
            node={node}
            def={def}
            control={APPEARANCE_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
          <StyleControlField
            node={node}
            def={def}
            control={WILL_CHANGE_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
        </div>
      </Subgroup>
    </Card>
  );
}

// Tables (Tailwind: Tables) — border model, column sizing, border spacing, caption
// side. Only meaningful on table-family elements; the inspector reveals it for
// el:table/thead/tbody/tfoot/tr/td/th. Per state / breakpoint via the pill.
const TABLE_TAGS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption']);
function isTableNode(node: BuilderNode): boolean {
  const tag = rawTagOf(node.type);
  return tag !== null && TABLE_TAGS.has(tag);
}
function TablesCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  const commit = (c: string) => onClass(ensureArchetypeDefaults(c, def.defaults.class));
  return (
    <Card icon={Table} title="Tables" summary={tablesSummary(node)} defaultOpen={false}>
      {selector}
      <div className="bx-row2">
        <StyleControlField
          node={node}
          def={def}
          control={BORDER_COLLAPSE_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
        <StyleControlField
          node={node}
          def={def}
          control={TABLE_LAYOUT_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
      </div>
      <div className="bx-row2">
        <LengthField
          label="Border spacing"
          node={node}
          prefix="border-spacing"
          ctx={prefix}
          presets={GAP_VALUE_PRESETS}
          commit={commit}
        />
        <StyleControlField
          node={node}
          def={def}
          control={CAPTION_SIDE_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
      </div>
    </Card>
  );
}

// SVG (Tailwind: SVG) — fill, stroke (token colors), stroke width. Only meaningful
// on an svg / svg-child element; the inspector reveals it for those raw elements.
// Per state / breakpoint via the pill.
const SVG_TAGS = new Set([
  'svg',
  'path',
  'g',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'use',
  'text',
  'tspan',
]);
function isSvgNode(node: BuilderNode): boolean {
  const tag = rawTagOf(node.type);
  return tag !== null && SVG_TAGS.has(tag);
}
function SvgCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  return (
    <Card icon={Spline} title="SVG" summary={svgSummary(node)} defaultOpen={false}>
      {selector}
      <div className="bx-row2">
        <StyleControlField
          node={node}
          def={def}
          control={FILL_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
        <StyleControlField
          node={node}
          def={def}
          control={STROKE_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
      </div>
      <StyleControlField
        node={node}
        def={def}
        control={STROKE_WIDTH_CONTROL}
        prefix={prefix}
        onClass={onClass}
      />
    </Card>
  );
}

// Typography — font / size / weight / line-height / spacing / alignment / case /
// color (+ opacity), plus decoration / clamp / wrapping. Per state / breakpoint
// via the pill. Shown for text-bearing nodes.
function TypographyCard({
  node,
  def,
  contexts,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  contexts: StyleContext[];
  onClass: (value: string) => void;
}) {
  const { prefix, selector } = useLayerContext(contexts);
  return (
    <Card icon={Type} title="Typography" summary={typographySummary(node)} defaultOpen={false}>
      {selector}
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={FONT_FAMILY_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="family"
      />
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={FONT_SIZE_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="size"
      />
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={FONT_WEIGHT_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="weight"
      />
      <IconChoiceField
        node={node}
        archetype={def.defaults.class}
        control={TEXT_ALIGN_CONTROL}
        ctx={prefix}
        onClass={onClass}
        icons={TEXT_ALIGN_ICONS}
      />
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={LEADING_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="leading"
      />
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={TRACKING_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="tracking"
      />
      <PreviewTileField
        node={node}
        archetype={def.defaults.class}
        control={TEXT_CASE_CONTROL}
        ctx={prefix}
        onClass={onClass}
        kind="case"
      />
      <StyleControlField
        node={node}
        def={def}
        control={FONT_STYLE_CONTROL}
        prefix={prefix}
        onClass={onClass}
      />
      <StyleControlField
        node={node}
        def={def}
        control={VERTICAL_ALIGN_CONTROL}
        prefix={prefix}
        onClass={onClass}
      />
      {/* Full-width so the text-colour swatches size like the recipe Color grid. */}
      <ColorOpacityField
        node={node}
        def={def}
        control={TEXT_COLOR_CONTROL}
        ctx={prefix}
        onClass={onClass}
      />
      <Subgroup title="Decoration">
        <PreviewTileField
          node={node}
          archetype={def.defaults.class}
          control={TEXT_DECORATION_CONTROL}
          ctx={prefix}
          onClass={onClass}
          kind="decoration"
        />
        <StyleControlField
          node={node}
          def={def}
          control={DECORATION_THICKNESS_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
        <StyleControlField
          node={node}
          def={def}
          control={DECORATION_OFFSET_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
      </Subgroup>
      <Subgroup title="Wrapping & overflow">
        <div className="bx-row2">
          <StyleControlField
            node={node}
            def={def}
            control={WHITESPACE_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
          <StyleControlField
            node={node}
            def={def}
            control={WORD_BREAK_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
        </div>
        <div className="bx-row2">
          <StyleControlField
            node={node}
            def={def}
            control={LINE_CLAMP_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
          <StyleControlField
            node={node}
            def={def}
            control={TEXT_OVERFLOW_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
        </div>
        <StyleControlField
          node={node}
          def={def}
          control={HYPHENS_CONTROL}
          prefix={prefix}
          onClass={onClass}
        />
      </Subgroup>
      <Subgroup title="Lists & indent">
        <div className="bx-row2">
          <StyleControlField
            node={node}
            def={def}
            control={LIST_STYLE_TYPE_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
          <StyleControlField
            node={node}
            def={def}
            control={LIST_STYLE_POSITION_CONTROL}
            prefix={prefix}
            onClass={onClass}
          />
        </div>
        <LengthField
          label="Text indent"
          node={node}
          prefix="indent"
          ctx={prefix}
          presets={INDENT_PRESETS}
          commit={(c) => onClass(ensureArchetypeDefaults(c, def.defaults.class))}
        />
      </Subgroup>
    </Card>
  );
}

// Custom CSS — the raw class escape hatch (the final power-user out), now a
// ROUND-TRIPPING tool (docs/builder/04 §2.4): it shows the same `node.class` the
// structured controls read/write, flags tokens that fight a structured group, and
// offers a one-click tidy that dedupes those groups while preserving every
// unrecognized class exactly.
function CustomCssCard({ node, onClass }: { node: BuilderNode; onClass: (value: string) => void }) {
  const conflicts = detectClassConflicts(node.class);
  return (
    <Card
      icon={SlidersHorizontal}
      title="Custom CSS"
      summary={
        conflicts.length
          ? `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}`
          : 'Raw classes'
      }
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
      {conflicts.length ? (
        <div className="bx-conflicts" role="status">
          <p className="bx-conflicts__head">
            These classes fight a control above — the structured controls win:
          </p>
          <ul className="bx-conflicts__list">
            {conflicts.map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
          </ul>
          <button
            type="button"
            className="bx-conflicts__fix"
            onClick={() => onClass(resolveClassConflicts(node.class))}
          >
            Tidy up — keep the first of each
          </button>
        </div>
      ) : null}
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
  typeItIn,
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
  /** The node's typed-content field (e.g. the Heading text input) — shown in the
   *  "Type it in" branch so it only appears when you're authoring it directly, not
   *  when the content is pulled from data. */
  typeItIn?: React.ReactNode;
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
      <span className="bx-field__label">{isContainer ? 'Repeat content' : 'Source'}</span>
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
      ) : isContainer ? (
        <p className="bx-source__hint">
          Shows the blocks inside once. Switch to “Repeat for each…” to repeat them for every
          product, post, or record.
        </p>
      ) : (
        <>
          {typeItIn}
          <p className="bx-source__hint">
            Switch to “Pull from your data” to show something live instead, like a product name or
            price.
          </p>
        </>
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
  omitKey,
  onlyKey,
}: {
  node: BuilderNode;
  onProp: (key: string, value: unknown) => void;
  /** When set (component editor), text props gain a "Make a field" affordance. */
  slotEditor?: SlotEditor;
  /** Merge tags for inline `{{` autocomplete (email surface only). Absent ⇒ plain
   *  text controls. */
  tokens?: MergeTag[];
  /** Render every prop EXCEPT this key — used to keep the primary text/content prop
   *  out of the structural list (it moves under the "Type it in" source branch). */
  omitKey?: string;
  /** Render ONLY this prop — the inverse, for the typed-content field itself. */
  onlyKey?: string;
}) {
  const def = getDef(node.type)!;
  const specs = def.props.filter((p) =>
    onlyKey ? p.key === onlyKey : omitKey ? p.key !== omitKey : true
  );
  if (specs.length === 0) return null;
  return (
    <>
      {specs.map((spec) => {
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
        if (spec.control === 'linktarget') {
          // The shared target picker (docs/57 §10): type an href, or Browse a
          // searchable, module-gated list of real destinations / pages / products
          // / content, each resolved to its live storefront url.
          return (
            <Field key={spec.key} label={spec.label}>
              <LinkTargetControl
                value={value}
                placeholder={spec.placeholder}
                onChange={(next) => onProp(spec.key, next)}
              />
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

/** A layout in the catalog, reduced to what the settings panel needs. */
export interface LayoutSettingsItem {
  id: string;
  name: string;
  isActive: boolean;
  published: boolean;
}

// The Site-layout zone's settings home (docs/builder/07 §1) — the layout CATALOG
// the unified studio folds in from the retired /builder/site editor: switch the
// edited layout, create / rename / delete one, and make a published layout live.
// Mirrors the page catalog's capabilities (which live in the toolbar), kept here
// because a tenant switches layouts far less often than pages. Import/export rides
// the toolbar (zone-aware), alongside the page's.
export function LayoutSettings({
  name,
  layouts,
  editingId,
  busy = false,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onActivate,
}: {
  name: string;
  layouts: LayoutSettingsItem[];
  editingId: string;
  busy?: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onActivate: () => void;
}) {
  const editing = layouts.find((l) => l.id === editingId);
  // Inline rename: the switcher swaps to a text input. Enter/blur commits, Esc
  // cancels — self-contained here so the toolbar (page-centric) stays untouched.
  const [renaming, setRenaming] = React.useState(false);
  const [draft, setDraft] = React.useState(name);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => setDraft(name), [name]);
  React.useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== name) onRename(next);
  };

  return (
    <div className="bx-inspector">
      <PanelHead icon={LayoutGrid} title={name} subtitle="The chrome that wraps every page" />
      <div className="bx-ins-stack">
        <Card
          icon={LayoutGrid}
          title="Layouts"
          caption="Switch which layout you’re editing, or manage the catalog. Exactly one layout is live at a time — the chrome every published page renders inside."
        >
          <Field label="Editing">
            {renaming ? (
              <Input
                ref={inputRef}
                size="sm"
                value={draft}
                aria-label="Layout name"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  else if (e.key === 'Escape') {
                    setDraft(name);
                    setRenaming(false);
                  }
                }}
                onBlur={commitRename}
              />
            ) : (
              <NativeSelect
                size="sm"
                value={editingId}
                aria-label="Layout being edited"
                onChange={(e) => onSelect(e.target.value)}
              >
                {layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.isActive ? ' · Live' : ''}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <div className="bx-ins-bulk">
            <button
              type="button"
              className="bx-ins-bulk__btn"
              disabled={busy || renaming}
              onClick={() => setRenaming(true)}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Rename
            </button>
            <button
              type="button"
              className="bx-ins-bulk__btn"
              disabled={busy || renaming}
              onClick={onNew}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> New
            </button>
            <button
              type="button"
              className="bx-ins-bulk__btn bx-ins-bulk__btn--danger"
              disabled={busy || renaming || layouts.length <= 1 || editing?.isActive}
              title={
                editing?.isActive
                  ? 'The live layout can’t be deleted — make another layout live first'
                  : layouts.length <= 1
                    ? 'Keep at least one layout'
                    : undefined
              }
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </button>
          </div>
          {editing?.isActive ? (
            <p className="bx-default__hint">
              ✓ This layout is live — it’s the chrome every published page renders inside.
            </p>
          ) : (
            <div className="bx-default">
              <button
                type="button"
                className="bx-default__set"
                disabled={busy || !editing?.published}
                onClick={onActivate}
              >
                <Rocket className="h-3.5 w-3.5" aria-hidden /> Make this layout live
              </button>
              <p className="bx-default__hint">
                {editing?.published
                  ? 'Publishing the site already makes the layout you’re viewing live. Use this to switch the live layout without republishing.'
                  : 'Publish this layout before it can go live.'}
              </p>
            </div>
          )}
        </Card>
        <Card icon={LayoutGrid} title="About this layout">
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
  /** "Save as brand section" (docs/61 §6): save the selected subtree as a brand
   *  archetype (a stamp template) WITHOUT replacing the on-canvas node. Omitted ⇒
   *  hidden (e.g. inside the component editor). */
  onSaveAsArchetype?: (node: BuilderNode) => void;
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
  /** Set the node's binding — a bare PATH (field picker) or a full Binding object
   *  (the Data panel's product pin / collection source / action, docs/98 Pillar 7);
   *  null clears it. */
  onBind: (target: string | Binding | null) => void;
  onProp: (key: string, value: unknown) => void;
  onRetype: (targetType: string) => void;
  /** Replace a node wholesale (id preserved) — powers the NavMenu quick-editor,
   *  which rewrites the container's NavItem child list in one commit. Omitted ⇒ the
   *  quick-editor entry is hidden (e.g. surfaces with no tree-mutation handler). */
  onReplaceNode?: (id: string, next: BuilderNode) => void;
  // ── Multi-select + clipboard (docs/builder/05 §2.2 / §2.5) ──────────────────
  /** How many nodes are selected. >1 switches the inspector to the bulk panel:
   *  only the universal style controls (which fan out to the whole selection) plus
   *  bulk actions. Defaults to 1 (the full single-node inspector). */
  selectionCount?: number;
  /** Duplicate the selection in place (Cmd/Ctrl+D). */
  onDuplicate?: () => void;
  /** Delete the whole selection (confirm-gated). */
  onDelete?: () => void;
  /** Copy the selection to the clipboard. */
  onCopy?: () => void;
  /** Copy the primary node's styles (its full class). */
  onCopyStyles?: () => void;
  /** Paste the copied styles onto every selected node. */
  onPasteStyles?: () => void;
  /** Whether a style has been copied (enables Paste styles). */
  canPasteStyles?: boolean;
}

// The full Tailwind surface, organized exactly like Tailwind's OWN documentation
// sections (docs/98 §3.3): Layout · Flexbox & Grid · Spacing · Sizing · Typography
// · Backgrounds · Borders · Effects · Filters · Tables · Transitions & Animation ·
// Transforms · Interactivity · SVG. Every object gets the COMPLETE set — the 34
// named components AND raw el:* elements — with no per-type gating of the surface
// (a raw el:div gets Typography, Backgrounds, Filters, … just like any node). The
// only conditionals are structural-vs-cosmetic (the Flexbox & Grid arrangement
// half is container-only; Tables shows for table-family elements, SVG for svg
// elements) — never a Tailwind section hidden by node type. Shared by the
// single-node inspector and the multi-select bulk panel so both render identically
// (the bulk panel fans each change out to the whole selection via onClass). Each
// card carries its own "Editing for" pill (state / breakpoint); email collapses
// every card to the base layer (mail clients strip variants).
function TailwindSurface({
  node,
  def,
  email,
  skinContexts,
  arrangeContexts,
  onClass,
  onProp,
}: {
  node: BuilderNode;
  def: ComponentDef;
  /** The email surface honors only the inline-style subset `emailStyleFor` compiles
   *  (typography / color / spacing / borders) plus, for CONTAINERS, the
   *  direction/columns/gap the send parses into its table layout. The web-only
   *  sections (Layout, Sizing, Effects, Filters, Transforms, Interactivity, …) are
   *  hidden there so a control never silently no-ops in the mail (docs/98 §3.6c). */
  email: boolean;
  /** Responsive + state + dark layers (skin cards). */
  skinContexts: StyleContext[];
  /** Responsive-only layers (layout / flex / grid / spacing / size / position). */
  arrangeContexts: StyleContext[];
  onClass: (value: string) => void;
  onProp: (key: string, value: unknown) => void;
}) {
  // Email: the honored subset only. Typography / Backgrounds (fill) / Borders /
  // Spacing map onto the leaf inline-style compiler; Flexbox & Grid shows for a
  // CONTAINER because the send parses its direction/columns/gap into Row/Column
  // tables (a leaf has no email-honored layout). Everything else is web-only.
  if (email) {
    return (
      <>
        {/* Same appearance-first order as the web surface: Typography → Background →
            Borders, then the email-honored layout (container arrangement + spacing). */}
        <TypographyCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
        <BackgroundCard
          node={node}
          def={def}
          contexts={skinContexts}
          onClass={onClass}
          onProp={onProp}
        />
        <BordersCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
        {def.kind === 'container' ? (
          <FlexGridCard node={node} def={def} contexts={arrangeContexts} onClass={onClass} />
        ) : null}
        <SpacingCard node={node} def={def} contexts={arrangeContexts} onClass={onClass} />
      </>
    );
  }
  return (
    <>
      {/* Appearance first, sitting right under Style (how it LOOKS): Typography →
          Background → Borders — the everyday skin, before the structural cards. */}
      <TypographyCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
      {/* Backgrounds — fill / gradient / image. */}
      <BackgroundCard
        node={node}
        def={def}
        contexts={skinContexts}
        onClass={onClass}
        onProp={onProp}
      />
      {/* Borders. */}
      <BordersCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
      {/* Layout family (how it's ARRANGED): display/overflow/aspect, child
          arrangement, then spacing + size. */}
      <LayoutCard node={node} def={def} contexts={arrangeContexts} onClass={onClass} />
      {/* Flexbox & Grid — how children arrange + how this block sits as a child. */}
      <FlexGridCard node={node} def={def} contexts={arrangeContexts} onClass={onClass} />
      {/* Spacing — padding / margin. */}
      <SpacingCard node={node} def={def} contexts={arrangeContexts} onClass={onClass} />
      {/* Sizing — width / height / min / max. */}
      <SizeCard node={node} def={def} contexts={arrangeContexts} onClass={onClass} />
      {/* Effects — opacity / shadow / ring / blend. */}
      <EffectsCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
      {/* Filters — blur / brightness / … / backdrop family. */}
      <FiltersCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
      {/* Tables — only for table-family raw elements. */}
      {isTableNode(node) ? (
        <TablesCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
      ) : null}
      {/* Transitions & Animation — raw transition / duration / ease / delay /
          animate (the friendly entrance Motion card stays separate). */}
      <TransitionsCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
      {/* Transforms — scale / rotate / translate / skew / origin. */}
      <TransformsCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
      {/* Interactivity — cursor / select / scroll / snap / caret / accent / … . */}
      <InteractivityCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
      {/* SVG — only for svg / svg-child raw elements. */}
      {isSvgNode(node) ? (
        <SvgCard node={node} def={def} contexts={skinContexts} onClass={onClass} />
      ) : null}
      {/* Position — kept its own card (Tailwind groups it under Layout, but the
          offset/z cascade reads cleaner standalone). */}
      <PositionCard node={node} def={def} contexts={arrangeContexts} onClass={onClass} />
    </>
  );
}

// The bulk-edit panel (docs/builder/05 §2.2) shown when more than one node is
// selected: only the UNIVERSAL style controls — driven by the primary node, but
// every change fans out to the whole selection via `onClass` — plus the bulk
// actions (copy / duplicate / paste-styles / delete). Type-specific controls
// (content, data binding, rename, retype) are hidden because they aren't valid
// across a mixed selection ("a mixed selection shows only controls valid for all").
function MultiSelectPanel({
  node,
  surface,
  count,
  onClass,
  onProp,
  onBack,
  onCopy,
  onDuplicate,
  onDelete,
  onPasteStyles,
  canPasteStyles,
}: {
  node: BuilderNode;
  surface: EditorSurface;
  count: number;
  onClass: (value: string) => void;
  onProp: (key: string, value: unknown) => void;
  onBack: () => void;
  onCopy?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onPasteStyles?: () => void;
  canPasteStyles?: boolean;
}) {
  const def = getDef(node.type);
  const skinContexts = surface === 'email' ? [BASE_CONTEXT] : SKIN_CONTEXTS;
  const arrangeContexts = surface === 'email' ? [BASE_CONTEXT] : ARRANGEMENT_CONTEXTS;
  return (
    <div className="bx-inspector" key="__multi">
      <button type="button" className="bx-ins-back" onClick={onBack}>
        <ChevronLeft aria-hidden /> Clear selection
      </button>
      <header className="bx-ins-head">
        <div className="bx-ins-head__row">
          <span className="bx-ins-head__icon">
            <Layers aria-hidden />
          </span>
          <div className="bx-ins-head__titles">
            <h3>{count} blocks selected</h3>
            <span className="bx-ins-head__sub">Style changes apply to all of them</span>
          </div>
        </div>
        <div className="bx-ins-bulk">
          {onCopy ? (
            <button type="button" className="bx-ins-bulk__btn" onClick={onCopy}>
              <Copy aria-hidden /> Copy
            </button>
          ) : null}
          {onDuplicate ? (
            <button type="button" className="bx-ins-bulk__btn" onClick={onDuplicate}>
              <CopyPlus aria-hidden /> Duplicate
            </button>
          ) : null}
          {canPasteStyles && onPasteStyles ? (
            <button type="button" className="bx-ins-bulk__btn" onClick={onPasteStyles}>
              <ClipboardPaste aria-hidden /> Paste styles
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="bx-ins-bulk__btn bx-ins-bulk__btn--danger"
              onClick={onDelete}
            >
              <Trash2 aria-hidden /> Delete
            </button>
          ) : null}
        </div>
      </header>
      {def ? (
        <div className="bx-ins-stack">
          {!isRawElementType(node.type) ? (
            <StyleCard node={node} def={def} onClass={onClass} />
          ) : null}
          <TailwindSurface
            node={node}
            def={def}
            email={surface === 'email'}
            skinContexts={skinContexts}
            arrangeContexts={arrangeContexts}
            onClass={onClass}
            onProp={onProp}
          />
          {surface !== 'email' ? <MotionCard node={node} def={def} onClass={onClass} /> : null}
          <CustomCssCard node={node} onClass={onClass} />
        </div>
      ) : (
        <p className="bx-inspector__tip">These blocks don’t share editable styles.</p>
      )}
    </div>
  );
}

/** The copy/paste-styles row in the single-node header (docs/builder/05 §2.5) —
 *  lift a block's full class and drop it onto another. */
// The selected block's toolbar — ONE compact row replacing the old stacked header
// (full-width name field + change-type dropdown + two full-width save-as buttons +
// copy/paste row, which ate space for occasional actions). Identity on the left:
// the tinted type icon + an inline-editable name that shows the TYPE as its
// placeholder when unnamed (focus reveals it's a field). The actions are quiet icon
// buttons on the right: change type (a menu of compatible types), save as component
// / brand section, and copy / paste styles.
function InspectorToolbar({
  node,
  def,
  surface,
  onName,
  onRetype,
  onSaveAsComponent,
  onSaveAsArchetype,
  onCopyStyles,
  onPasteStyles,
  canPasteStyles,
}: {
  node: BuilderNode;
  def: ComponentDef;
  surface: EditorSurface;
  onName: (name: string) => void;
  onRetype: (targetType: string) => void;
  onSaveAsComponent?: (node: BuilderNode) => void;
  onSaveAsArchetype?: (node: BuilderNode) => void;
  onCopyStyles?: () => void;
  onPasteStyles?: () => void;
  canPasteStyles?: boolean;
}) {
  const Icon = def.icon;
  const targets = compatibleRetypeTargets(def, surface);
  return (
    <header className="bx-ins-bar">
      <span className="bx-ins-bar__icon" title={def.label}>
        <Icon aria-hidden />
      </span>
      {/* The title IS the rename field: shows the name, or the type as a muted
          placeholder when unnamed; focus reveals it's editable. */}
      <input
        className="bx-ins-bar__name"
        value={node.name ?? ''}
        placeholder={def.label}
        aria-label="Block name"
        onChange={(e) => onName(e.target.value)}
      />
      <div className="bx-ins-bar__acts">
        {targets.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="bx-ins-bar__act"
                title="Change block type"
                aria-label="Change block type"
              >
                <Replace aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Change to…</DropdownMenuLabel>
              {targets.map((t) => {
                const TargetIcon = t.icon;
                return (
                  <DropdownMenuItem key={t.type} onSelect={() => onRetype(t.type)}>
                    <TargetIcon size={15} aria-hidden /> {t.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {onSaveAsComponent ? (
          <button
            type="button"
            className="bx-ins-bar__act"
            title="Save as a reusable component"
            aria-label="Save as component"
            onClick={() => onSaveAsComponent(node)}
          >
            <Boxes aria-hidden />
          </button>
        ) : null}
        {onSaveAsArchetype ? (
          <button
            type="button"
            className="bx-ins-bar__act"
            title="Save as a reusable brand section"
            aria-label="Save as brand section"
            onClick={() => onSaveAsArchetype(node)}
          >
            <Sparkles aria-hidden />
          </button>
        ) : null}
        {onCopyStyles ? (
          <button
            type="button"
            className="bx-ins-bar__act"
            title="Copy this block’s styles"
            aria-label="Copy styles"
            onClick={onCopyStyles}
          >
            <Copy aria-hidden />
          </button>
        ) : null}
        {canPasteStyles && onPasteStyles ? (
          <button
            type="button"
            className="bx-ins-bar__act"
            title="Paste the copied styles onto this block"
            aria-label="Paste styles"
            onClick={onPasteStyles}
          >
            <ClipboardPaste aria-hidden />
          </button>
        ) : null}
      </div>
    </header>
  );
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
  onSaveAsArchetype,
  slotEditor,
  tokens,
  onBack,
  onName,
  onClass,
  onBind,
  onProp,
  onRetype,
  onReplaceNode,
  selectionCount = 1,
  onDuplicate,
  onDelete,
  onCopy,
  onCopyStyles,
  onPasteStyles,
  canPasteStyles,
}: InspectorProps) {
  if (!node) {
    return <>{settings}</>;
  }
  // More than one node selected → the bulk panel (universal styles + bulk actions).
  if (selectionCount > 1) {
    return (
      <MultiSelectPanel
        node={node}
        surface={surface}
        count={selectionCount}
        onClass={onClass}
        onProp={onProp}
        onBack={onBack}
        onCopy={onCopy}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onPasteStyles={onPasteStyles}
        canPasteStyles={canPasteStyles}
      />
    );
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

  // A few node types register a bespoke editor (recipients chips, a nav link tree)
  // via the node-inspector registry instead of the generic prop list.
  const nodeInspector = NODE_INSPECTORS[node.type];
  const InspectorCard = nodeInspector?.Card;
  const ContentExtra = nodeInspector?.ContentExtra;

  const hasContent = def.props.length > 0 || def.bindable;
  // The source toggle (Type it in / Pull from your data) shows when the block can
  // bind AND isn't already owned by a record/action binding (Pillar 7). When it
  // does, the typed-content field (Heading text / Button label / …) moves INTO the
  // "Type it in" branch — so it's hidden while pulling from data — and the
  // structural props (header level, link, …) stay above. `contentKey` is that
  // primary text prop; undefined ⇒ render every prop normally (no split).
  const showsSource = def.bindable && !hasRecordOrActionBinding(node);
  const contentKey = showsSource ? textPropKeyOf(def) : undefined;
  // The responsive/state layers a card may target. Email collapses to base only —
  // mail clients strip `hover:`/`@md:`/`dark:` variants, so offering them would
  // silently no-op (docs/builder/04 §2.3). The SAME full card set renders on
  // page / site / component surfaces — the advanced surface is reachable
  // everywhere, never gated to the component builder (docs/builder/04 §2.2 / §2.5).
  const skinContexts = surface === 'email' ? [BASE_CONTEXT] : SKIN_CONTEXTS;
  const arrangeContexts = surface === 'email' ? [BASE_CONTEXT] : ARRANGEMENT_CONTEXTS;
  // `key={node.id}` resets each card's open-state + the data-source toggle when a
  // different node is selected (so defaults are consistent per selection), while
  // edits to the SAME node preserve them.
  return (
    <div className="bx-inspector" key={node.id}>
      <InspectorToolbar
        node={node}
        def={def}
        surface={surface}
        onName={onName}
        onRetype={onRetype}
        onSaveAsComponent={onSaveAsComponent}
        onSaveAsArchetype={onSaveAsArchetype}
        onCopyStyles={onCopyStyles}
        onPasteStyles={onPasteStyles}
        canPasteStyles={canPasteStyles}
      />

      <div className="bx-ins-stack">
        {/* A bespoke top-of-stack editor (ContactForm's copy / field toggles /
            recipients + CRM + autoresponder routing), registered in the
            node-inspector registry. For such nodes the def carries `props: []` so
            the generic Content card below self-suppresses. */}
        {InspectorCard ? (
          <InspectorCard node={node} onProp={onProp} onReplaceNode={onReplaceNode} />
        ) : null}

        {/* Content first — what the block SAYS and where it comes from. The
            structural props (header level, link, …) sit up top; the typed-content
            field moves under the "Type it in" source branch (so it's hidden while
            pulling from data — no more always-visible-but-ignored input). */}
        {hasContent ? (
          <Card icon={TextCursorInput} title="Content" summary={contentSummary(node, def)}>
            <PropsFields
              node={node}
              onProp={onProp}
              slotEditor={slotEditor}
              tokens={tokens}
              omitKey={contentKey}
            />
            {/* A content-card augmentation registered for this node type (e.g.
                NavMenu's "manage links" quick-editor, docs/57). */}
            {ContentExtra ? (
              <ContentExtra node={node} onProp={onProp} onReplaceNode={onReplaceNode} />
            ) : null}
            {showsSource ? (
              <DataSource
                node={node}
                catalog={catalog}
                scope={scope}
                contentTypeKey={contentTypeKey}
                onAddField={onAddField}
                onBind={onBind}
                slotEditor={slotEditor}
                typeItIn={
                  contentKey ? (
                    <PropsFields
                      node={node}
                      onProp={onProp}
                      slotEditor={slotEditor}
                      tokens={tokens}
                      onlyKey={contentKey}
                    />
                  ) : undefined
                }
              />
            ) : null}
          </Card>
        ) : null}

        {/* Data (docs/98 Pillar 7) — connect a container to a product / collection,
            or wire a button's click action. Web surfaces only (no cart in email). */}
        {surface !== 'email' && dataConnectMode(node, def) ? (
          <Card icon={Database} title="Data" summary={dataConnectSummary(node)}>
            <DataConnect
              node={node}
              def={def}
              onBind={onBind}
              cmsTypes={cmsTypesFromCatalog(catalog)}
            />
          </Card>
        ) : null}

        {/* Style — the recipe axes (Color + Emphasis): the everyday default,
            kept open. Only for NAMED components — a raw el:* element has no recipe
            (no Color/Emphasis to set), so the card is hidden for it; its styling is
            the full Tailwind surface below. */}
        {!isRawElementType(node.type) ? (
          <StyleCard node={node} def={def} onClass={onClass} />
        ) : null}

        <TailwindSurface
          node={node}
          def={def}
          email={surface === 'email'}
          skinContexts={skinContexts}
          arrangeContexts={arrangeContexts}
          onClass={onClass}
          onProp={onProp}
        />

        {/* Motion (docs/61 §9) — friendly entrance on every node. Hidden on the
            email surface (mail clients strip classes, so an entrance is inert
            there). Kept alongside the raw Transitions & Animation card. */}
        {surface !== 'email' ? <MotionCard node={node} def={def} onClass={onClass} /> : null}

        {/* Behavior (docs/98 Pillar 5) — turn a container into an interactive
            component, or mark a node as a part of one. Web surfaces only (the
            behavior runtime doesn't run in email). */}
        {surface !== 'email' ? <BehaviorCard node={node} def={def} onProp={onProp} /> : null}

        <CustomCssCard node={node} onClass={onClass} />
      </div>
    </div>
  );
}
