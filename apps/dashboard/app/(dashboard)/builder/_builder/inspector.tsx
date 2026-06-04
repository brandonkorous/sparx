'use client';

// The inspector — the right pane. For the selected node it shows, top to
// bottom:
//   1. Style    — the everyday recipe axes: Color + Variant (docs/47), written
//                 to `node.class`.
//   2. Advanced — the less-common recipe axes (Size / Margin / Corners / Border /
//                 Shadow) + the raw `class` textarea (the final escape hatch).
//                 Collapsed by default.
//   3. Data     — the binding box (what this node reads, and what its cardinality
//                 means). Static when the component isn't bindable.
//   4. <Component> — the node's own props (heading level, button label, …).
//   5. Arrangement — containers only (how children flow: direction / columns / gap).
//   6. Layout   — the node's own box, RELEVANCE-GATED per component (width,
//                 height, spacing, surface, background, align, position,
//                 visibility) — see BoxBasePanel / visibleBoxAxes.

import * as React from 'react';
import { Check, ChevronDown, ChevronLeft, Plus, X } from 'lucide-react';
import { Input, NativeSelect, Switch, Textarea, cn } from '@sparx/ui';
import type { BindingCatalog } from '@sparx/builder-schemas';

import { CREATABLE_KINDS, type CreatableType } from './field-kinds';

import { SeoScoreChip } from '@/components/seo/seo-score';

import {
  ALIGN_OPTIONS,
  DEVICE_OPTIONS,
  DIRECTION_OPTIONS,
  GAP_OPTIONS,
  HEIGHT_OPTIONS,
  OVERLAY_OPTIONS,
  PIN_OPTIONS,
  SPACE_OPTIONS,
  SURFACE_OPTIONS,
  TONE_OPTIONS,
  WIDTH_OPTIONS,
  type BoxBase,
  type BuilderNode,
  type Device,
  type LayoutBase,
  type PageSeo,
} from './model';
import {
  bindGroups,
  bindHint,
  itemBindPaths,
  moduleColor,
  moduleForPath,
  type ScopeInfo,
} from './binding-catalog';
import {
  compatibleRetypeTargets,
  getDef,
  visibleBoxAxes,
  type BoxAxis,
  type ComponentDef,
  type EditorSurface,
} from './registry';
import { IconPicker } from './icon-picker';
import {
  STYLE_CONTROLS,
  activeValue,
  advancedControlsFor,
  applyValue,
  ensureArchetypeDefaults,
  type ClassControl,
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

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="bx-grp">
      <h4 className="bx-grp__label">{label}</h4>
      <div className="bx-grp__body">{children}</div>
    </section>
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
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  control: ClassControl;
  onClass: (value: string) => void;
}) {
  return (
    <Field label={control.label}>
      <NativeSelect
        size="sm"
        value={activeValue(node.class, control) ?? ''}
        onChange={(e) =>
          onClass(
            ensureArchetypeDefaults(
              applyValue(node.class, control, e.target.value || null),
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

// The collapsed "Advanced" disclosure — the less-common style axes (Size today;
// radius / shadow / border / spacing / position as the recipe gains them) plus
// the raw `class` textarea, the final escape hatch (docs/47 §4). Collapsed by
// default so the everyday Color / Variant stay uncluttered.
function AdvancedPanel({
  node,
  def,
  onClass,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onClass: (value: string) => void;
}) {
  // Controls are built from the archetype (which AXES the element has) — distinct
  // from defaults.class (what a fresh node gets). Icon declares a size axis on its
  // archetype but ships sizeless, so the Size control shows reading "Default".
  const controls = advancedControlsFor(def.archetype ?? def.defaults.class);
  return (
    <details className="bx-adv">
      <summary className="bx-adv__summary">
        <span>Advanced</span>
        <ChevronDown className="bx-adv__chev" aria-hidden />
      </summary>
      <div className="bx-adv__body">
        {controls.map((control) => (
          <StyleControlField
            key={control.id}
            node={node}
            def={def}
            control={control}
            onClass={onClass}
          />
        ))}
        <Field
          label="Classes"
          hint="Power-user escape hatch — the raw class string (archetype + safelisted utilities). Space-separated; compiled to the tenant stylesheet on publish."
        >
          <Textarea
            rows={2}
            value={node.class ?? ''}
            placeholder="e.g. hero bg-base-100 gap-6"
            aria-label="Node classes"
            onChange={(e) => onClass(e.target.value)}
          />
        </Field>
      </div>
    </details>
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

function BindingBox({
  node,
  catalog,
  scope,
  contentTypeKey,
  onAddField,
  onBind,
}: {
  node: BuilderNode;
  catalog: BindingCatalog;
  scope: ScopeInfo;
  contentTypeKey?: string | null;
  onAddField?: (label: string, kind: CreatableType) => Promise<string | null>;
  onBind: (path: string | null) => void;
}) {
  const def = getDef(node.type)!;
  if (!def.bindable) {
    return (
      <Group label="Data">
        <div className="bx-bind bx-bind--static">
          <div className="bx-bind__path">Static content</div>
          <p className="bx-bind__hint">
            Not bound to a module — its content is typed right here. Edit it in the panel below.
          </p>
        </div>
      </Group>
    );
  }

  const path = node.binding?.path ?? '';
  const color = path ? moduleColor(moduleForPath(catalog, path)) : undefined;
  const groups = bindGroups(catalog);
  const itemPaths = itemBindPaths(scope);

  return (
    <Group label="Data">
      <div
        className="bx-bind"
        style={color ? ({ '--bind': color } as React.CSSProperties) : undefined}
      >
        <div className="bx-bind__top">
          {path ? (
            <span className="bx-bind__path">
              <span className="bx-bind__dot" />
              {path}
            </span>
          ) : (
            <span className="bx-bind__path bx-bind__path--empty">Not bound</span>
          )}
        </div>
        {path ? <p className="bx-bind__hint">{bindHint(catalog, scope, path)}</p> : null}
        <NativeSelect
          size="sm"
          value={path || UNBOUND}
          onChange={(e) => onBind(e.target.value === UNBOUND ? null : e.target.value)}
        >
          <option value={UNBOUND}>— Not bound (static) —</option>
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
            <optgroup label={scope.label ? `IN SCOPE · ${scope.label}` : 'IN SCOPE (per item)'}>
              {itemPaths.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </NativeSelect>
        {contentTypeKey && onAddField ? (
          <InlineFieldAdd
            contentTypeKey={contentTypeKey}
            scope={scope}
            onAddField={onAddField}
            onBind={onBind}
          />
        ) : null}
      </div>
    </Group>
  );
}

// ── Component props ──────────────────────────────────────────────────────────

function PropsPanel({
  node,
  onProp,
}: {
  node: BuilderNode;
  onProp: (key: string, value: unknown) => void;
}) {
  const def = getDef(node.type)!;
  if (def.props.length === 0) return null;
  return (
    <Group label={def.label}>
      {def.props.map((spec) => {
        const value = node.props[spec.key];
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
              <Textarea
                rows={3}
                value={(value as string) ?? ''}
                placeholder={spec.placeholder}
                onChange={(e) => onProp(spec.key, e.target.value)}
              />
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
        return (
          <Field key={spec.key} label={spec.label}>
            <Input
              value={(value as string) ?? ''}
              placeholder={spec.placeholder}
              onChange={(e) => onProp(spec.key, e.target.value)}
            />
          </Field>
        );
      })}
    </Group>
  );
}

// ── Arrangement (containers) ─────────────────────────────────────────────────
// How a container arranges its CHILDREN (direction / columns / gap). Named
// "Arrangement" to stay distinct from the per-node "Layout" panel (the block's
// own box: width / spacing / surface / …), which every node shows.

function LayoutPanel({
  layout,
  onLayout,
}: {
  layout: LayoutBase;
  onLayout: (patch: Partial<LayoutBase>) => void;
}) {
  return (
    <Group label="Arrangement">
      <Field label="Direction">
        <Segmented
          value={layout.direction}
          options={DIRECTION_OPTIONS}
          onChange={(v) => onLayout({ direction: v })}
        />
      </Field>
      {layout.direction === 'grid' ? (
        <Field label={`Columns · ${layout.columns}`}>
          <input
            type="range"
            min={1}
            max={6}
            value={layout.columns}
            onChange={(e) => onLayout({ columns: Number(e.target.value) })}
            className="bx-range"
          />
        </Field>
      ) : null}
      <Field label="Gap">
        <Segmented
          value={layout.gap}
          options={GAP_OPTIONS}
          onChange={(v) => onLayout({ gap: v })}
        />
      </Field>
    </Group>
  );
}

// ── Layout panel (box base, relevance-gated per component) ────────────────────
// Renders only the box-axis clusters relevant to the node (docs/47): containers
// get the full set, leaves get align + visibility, and any axis the node already
// uses is shown regardless — see `visibleBoxAxes`. Background image/binding are
// DATA the box keeps; overlay/tone are presentation that migrates to classes.

function BoxBasePanel({
  box,
  axes,
  onBox,
}: {
  box: BoxBase;
  axes: Set<BoxAxis>;
  onBox: (patch: Partial<BoxBase>) => void;
}) {
  const toggleDevice = (d: Device, visible: boolean) => {
    const next = visible ? box.hiddenOn.filter((x) => x !== d) : [...new Set([...box.hiddenOn, d])];
    onBox({ hiddenOn: next });
  };

  return (
    <Group label="Layout">
      <p className="bx-grp__caption">Structure, spacing &amp; backdrop for this block.</p>
      {axes.has('width') ? (
        <>
          <Field
            label="Background width"
            hint="Does the surface span edge-to-edge, or hug the content?"
          >
            <Segmented
              value={box.backgroundWidth}
              options={WIDTH_OPTIONS}
              onChange={(v) => onBox({ backgroundWidth: v })}
            />
          </Field>
          <Field label="Content width">
            <Segmented
              value={box.contentWidth}
              options={WIDTH_OPTIONS}
              onChange={(v) => onBox({ contentWidth: v })}
            />
          </Field>
        </>
      ) : null}
      {axes.has('height') ? (
        <Field label="Height">
          <Segmented
            value={box.height}
            options={HEIGHT_OPTIONS}
            onChange={(v) => onBox({ height: v })}
          />
        </Field>
      ) : null}
      {axes.has('padding') ? (
        <Field label="Spacing">
          <Segmented
            value={box.padding}
            options={SPACE_OPTIONS}
            onChange={(v) => onBox({ padding: v })}
          />
        </Field>
      ) : null}
      {axes.has('surface') ? (
        <Field label="Surface">
          <Segmented
            value={box.surface}
            options={SURFACE_OPTIONS}
            onChange={(v) => onBox({ surface: v })}
          />
        </Field>
      ) : null}
      {axes.has('background') ? (
        <>
          <Field
            label="Background image"
            hint="Paste an image URL for a full-bleed photo panel — content renders over it."
          >
            <Input
              value={box.backgroundImage ?? ''}
              placeholder="https://…"
              aria-label="Background image URL"
              onChange={(e) => onBox({ backgroundImage: e.target.value || undefined })}
            />
          </Field>
          <Field
            label="Background from data"
            hint="Bind the background to a record image (e.g. product.images, item.cover). The record's own photo fills the hero; the URL above is the fallback."
          >
            <Input
              value={box.backgroundImageBinding ?? ''}
              placeholder="product.images"
              aria-label="Background image binding path"
              onChange={(e) => onBox({ backgroundImageBinding: e.target.value || undefined })}
            />
          </Field>
          {box.backgroundImage || box.backgroundImageBinding ? (
            <Field label="Overlay" hint="Darken or lighten the photo so text stays readable.">
              <Segmented
                value={box.overlay ?? 'none'}
                options={OVERLAY_OPTIONS}
                onChange={(v) => onBox({ overlay: v })}
              />
            </Field>
          ) : null}
          <Field label="Text tone">
            <Segmented
              value={box.textTone ?? 'default'}
              options={TONE_OPTIONS}
              onChange={(v) => onBox({ textTone: v })}
            />
          </Field>
        </>
      ) : null}
      {axes.has('align') ? (
        <Field label="Align">
          <Segmented
            value={box.align}
            options={ALIGN_OPTIONS}
            onChange={(v) => onBox({ align: v })}
          />
        </Field>
      ) : null}
      {axes.has('position') ? (
        <Field label="Position" hint="“Overlay top” floats this block over the one below it.">
          <Segmented
            value={box.pin ?? 'none'}
            options={PIN_OPTIONS}
            onChange={(v) => onBox({ pin: v })}
          />
        </Field>
      ) : null}
      {axes.has('visibility') ? (
        <div className="bx-field">
          <span className="bx-field__label">Visible on</span>
          <div className="bx-vis">
            {DEVICE_OPTIONS.map((d) => {
              const visible = !box.hiddenOn.includes(d.value);
              return (
                <div key={d.value} className="bx-vis__row">
                  <span className={cn('bx-vis__name', !visible && 'bx-vis__name--off')}>
                    {d.label}
                  </span>
                  <Switch
                    size="sm"
                    checked={visible}
                    onCheckedChange={(v) => toggleDevice(d.value, v)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Group>
  );
}

// ── Settings panels (shown when no node is selected) ─────────────────────────
// Each surface supplies its own (page settings vs. layout settings) via the
// Inspector's `settings` slot; both reuse the inspector's Group/Field controls.

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
      <header className="bx-ins-head">
        <div className="bx-ins-head__row">
          <h3>{name}</h3>
          <span className="bx-ins-kind">{kind}</span>
        </div>
      </header>
      {kind === 'collection' ? (
        <Group label="Renders">
          <Field
            label="Content type"
            hint="Every record of this type renders through this template (docs/51). Editing the type’s fields affects all of its templates and every API/MCP consumer."
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
          <p className="bx-grp__caption">
            A collection template renders once per record — its SEO comes from each record (the
            product or entry it binds), not the template.
          </p>
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
        </Group>
      ) : (
        <>
          <Group label="Page">
            <Field
              label="Site URL"
              hint={
                draft.trim()
                  ? `Published, this page serves at /${draft.trim()}`
                  : 'Set a slug to serve this page on your site.'
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
          </Group>
          <PageSeoPanel pageId={pageId} seo={seo} onSeo={onSeo} />
        </>
      )}
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
    <Group label="SEO">
      <div className="bx-row" style={{ marginBottom: 8 }}>
        <span className="bx-field__label">SEO health — hover for the report</span>
        <SeoScoreChip type="builder_page" id={pageId} />
      </div>
      <p className="bx-grp__caption">
        How this page reads in search results and link previews. Leave a field blank to fall back to
        the page name.
      </p>
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
    </Group>
  );
}

export function LayoutSettings({ name }: { name: string }) {
  return (
    <div className="bx-inspector">
      <header className="bx-ins-head">
        <div className="bx-ins-head__row">
          <h3>{name}</h3>
          <span className="bx-ins-kind">site</span>
        </div>
      </header>
      <Group label="Site layout">
        <p className="bx-grp__caption">
          The chrome that wraps every page. The <strong>Page content</strong> block marks where each
          routed page renders; everything around it (header, footer) persists across navigation.
        </p>
      </Group>
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
  onSubject,
  onPreheader,
}: {
  name: string;
  subject: string;
  preheader: string | null;
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
      <header className="bx-ins-head">
        <div className="bx-ins-head__row">
          <h3>{name}</h3>
          <span className="bx-ins-kind">email</span>
        </div>
      </header>
      <Group label="Message">
        <Field label="Subject" hint="The subject line shown in the inbox.">
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
        </Field>
        <Field
          label="Preview text"
          hint="The preheader shown after the subject in most inboxes. Optional."
        >
          <Textarea
            rows={2}
            value={preheaderDraft}
            placeholder="A short teaser shown next to the subject"
            aria-label="Email preheader"
            onChange={(e) => setPreheaderDraft(e.target.value)}
            onBlur={() => preheaderDraft !== (preheader ?? '') && onPreheader(preheaderDraft)}
          />
        </Field>
        <p className="bx-grp__caption">
          The branded frame — your wordmark header and the legal footer — wraps this body
          automatically. You compose the content; the chrome is added on send.
        </p>
      </Group>
      <p className="bx-inspector__tip">Select a layer to edit it.</p>
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
  /** The active template's content-type key — enables the binding picker's inline
   *  "+ New field" (docs/51 keystone). Null/undefined hides it. */
  contentTypeKey?: string | null;
  /** Add a field to `contentTypeKey`, resolving its key so the picker binds the
   *  node to the new field. */
  onAddField?: (label: string, kind: CreatableType) => Promise<string | null>;
  /** Clear the selection — returns the inspector to the `settings` panel (page /
   *  site settings). Powers the "‹ Page settings" back control. */
  onBack: () => void;
  onName: (name: string) => void;
  onClass: (value: string) => void;
  onBind: (path: string | null) => void;
  onProp: (key: string, value: unknown) => void;
  onLayout: (patch: Partial<LayoutBase>) => void;
  onBox: (patch: Partial<BoxBase>) => void;
  onRetype: (targetType: string) => void;
}

export function Inspector({
  node,
  catalog,
  scope,
  surface,
  settings,
  contentTypeKey,
  onAddField,
  onBack,
  onName,
  onClass,
  onBind,
  onProp,
  onLayout,
  onBox,
  onRetype,
}: InspectorProps) {
  if (!node) {
    return <>{settings}</>;
  }
  const def = getDef(node.type);
  if (!def) return null;

  return (
    <div className="bx-inspector">
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
          <h3>{def.label}</h3>
          <span className={cn('bx-ins-kind', `bx-ins-kind--${def.kind}`)}>{def.kind}</span>
        </div>
        <Input
          value={node.box.name ?? ''}
          placeholder={`${def.label} name`}
          onChange={(e) => onName(e.target.value)}
        />
        <RetypeControl def={def} surface={surface} onRetype={onRetype} />
      </header>

      <Group label="Style">
        <p className="bx-grp__caption">
          Color + variant from the Surface recipe (docs/47), written as classes.
        </p>
        {STYLE_CONTROLS.map((control) => (
          <StyleControlField
            key={control.id}
            node={node}
            def={def}
            control={control}
            onClass={onClass}
          />
        ))}
      </Group>

      <AdvancedPanel node={node} def={def} onClass={onClass} />

      <BindingBox
        node={node}
        catalog={catalog}
        scope={scope}
        contentTypeKey={contentTypeKey}
        onAddField={onAddField}
        onBind={onBind}
      />
      <PropsPanel node={node} onProp={onProp} />
      {def.kind === 'container' && node.layout ? (
        <LayoutPanel layout={node.layout} onLayout={onLayout} />
      ) : null}
      {/* Relevance-gated per component (docs/47): only the box axes this node
          exposes — plus any it already uses — so the panel fits the node instead
          of showing all ~12 controls for everything. */}
      <BoxBasePanel box={node.box} axes={visibleBoxAxes(def, node.box)} onBox={onBox} />
    </div>
  );
}
