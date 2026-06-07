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
//
// The freeform box/layout panels retired with the box model (docs/61): arrangement
// + skin are authored as `class` utilities (Style + Advanced), and the friendlier
// arrange/utility controls land in the component builder (docs/61 Phases 3–4).

import * as React from 'react';
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  Plus,
  X,
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
  type NavLink,
  type PropSpec as ComponentPropSpec,
} from '@sparx/builder-schemas';

import { CREATABLE_KINDS, type CreatableType } from './field-kinds';

import { SeoScoreChip } from '@/components/seo/seo-score';

import { type BuilderNode, type PageSeo } from './model';
import {
  bindGroups,
  bindHint,
  itemBindPaths,
  moduleColor,
  moduleForPath,
  type ScopeInfo,
} from './binding-catalog';
import { compatibleRetypeTargets, getDef, type ComponentDef, type EditorSurface } from './registry';
import { IconPicker } from './icon-picker';
import { ProseControl } from './prose-control';
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
  // In the component editor a node's data can be turned into a per-placement field
  // (a `$bind:<key>` slot). When it is, show the slot state instead of the picker.
  const slotKey = bindSlotKey(path);
  if (slotKey !== null && slotEditor) {
    return (
      <Group label="Data">
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
      </Group>
    );
  }
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
    </Group>
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

function PropsPanel({
  node,
  onProp,
  slotEditor,
}: {
  node: BuilderNode;
  onProp: (key: string, value: unknown) => void;
  /** When set (component editor), text props gain a "Make a field" affordance. */
  slotEditor?: SlotEditor;
}) {
  const def = getDef(node.type)!;
  if (def.props.length === 0) return null;
  return (
    <Group label={def.label}>
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
              <Textarea
                rows={3}
                value={(value as string) ?? ''}
                placeholder={spec.placeholder}
                onChange={(e) => onProp(spec.key, e.target.value)}
              />
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
            <Input
              value={(value as string) ?? ''}
              placeholder={spec.placeholder}
              onChange={(e) => onProp(spec.key, e.target.value)}
            />
            {makeField}
          </Field>
        );
      })}
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
          <h3>{component?.name ?? key}</h3>
          <span className="bx-ins-kind">component</span>
        </div>
        <Input
          value={node.name ?? ''}
          placeholder={`${component?.name ?? 'Component'} name`}
          onChange={(e) => onName(e.target.value)}
        />
      </header>

      {!component ? (
        <Group label="Unavailable">
          <p className="bx-grp__caption">
            This component (<span className="bx-mono">custom:{key}</span>) is no longer available.
            Remove it from the Layers panel.
          </p>
        </Group>
      ) : (
        <>
          {component.propSpec.length > 0 ? (
            <Group label="Content">
              <p className="bx-grp__caption">
                Fill this placement’s fields. Leave one blank to use the component’s default.
              </p>
              {component.propSpec.map((spec) => (
                <CustomPropField
                  key={spec.key}
                  spec={spec}
                  value={node.props[spec.key]}
                  onChange={(v) => onProp(spec.key, v)}
                />
              ))}
            </Group>
          ) : (
            <Group label={component.name}>
              <p className="bx-grp__caption">
                {component.description ??
                  'This component has no configurable fields — every placement renders the same.'}{' '}
                Edit the component to change it everywhere it’s used.
              </p>
            </Group>
          )}

          {bindingSlots.length > 0 ? (
            <Group label="Data">
              <p className="bx-grp__caption">
                Point this component’s data fields at your content for this placement.
              </p>
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
                          label={scope.label ? `IN SCOPE · ${scope.label}` : 'IN SCOPE (per item)'}
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
            </Group>
          ) : null}

          <Group label="Component">
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
          </Group>
        </>
      )}
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
        slotEditor={slotEditor}
      />
      <PropsPanel node={node} onProp={onProp} slotEditor={slotEditor} />
    </div>
  );
}
