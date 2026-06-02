'use client';

// The inspector — the right pane. For the selected node it shows, top to
// bottom:
//   1. Data   — the binding box (what this node reads, and what its cardinality
//               means). Static when the component isn't bindable.
//   2. <Component> — the node's own props (heading level, button label, …).
//   3. Layout — containers only (direction / columns / gap / alignment).
//   4. Layout & Style — the CONSTANT box base shown for EVERY node: background
//               width, content width, height, spacing, surface, alignment,
//               visibility. Same panel for everything — that's the point.

import * as React from 'react';
import { Input, NativeSelect, Switch, Textarea, cn } from '@sparx/ui';

import {
  ALIGN_OPTIONS,
  DEVICE_OPTIONS,
  DIRECTION_OPTIONS,
  GAP_OPTIONS,
  HEIGHT_OPTIONS,
  SPACE_OPTIONS,
  SURFACE_OPTIONS,
  WIDTH_OPTIONS,
  cardinalityOf,
  resolvePath,
  type BoxBase,
  type BuilderNode,
  type Device,
  type LayoutBase,
} from './model';
import { BIND_PATHS, ITEM_PATHS, SAMPLE_DATA, moduleColor } from './sample';
import { getDef } from './registry';

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

// ── Binding box ──────────────────────────────────────────────────────────────

const UNBOUND = '__none';

function bindingHint(path: string): string {
  if (path.startsWith('item') || path === 'index') {
    return 'Resolved per item from the enclosing list/record.';
  }
  const value = resolvePath({ root: SAMPLE_DATA }, path);
  const card = cardinalityOf(value);
  if (card === 'array') return 'An array → this node repeats once per item, scoping each to item.*';
  if (card === 'object') return 'An object → renders once and sets the scope for item.* below.';
  if (card === 'scalar') return 'A single value → shown in place.';
  return 'No data at this path yet.';
}

function BindingBox({
  node,
  inScope,
  onBind,
}: {
  node: BuilderNode;
  inScope: boolean;
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
  const color = path ? moduleColor(path.split(/[.[]/)[0]) : undefined;

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
        {path ? <p className="bx-bind__hint">{bindingHint(path)}</p> : null}
        <NativeSelect
          size="sm"
          value={path || UNBOUND}
          onChange={(e) => onBind(e.target.value === UNBOUND ? null : e.target.value)}
        >
          <option value={UNBOUND}>— Not bound (static) —</option>
          {BIND_PATHS.map((grp) => (
            <optgroup key={grp.module} label={grp.module.toUpperCase()}>
              {grp.paths.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
          <optgroup label={inScope ? 'IN SCOPE (per item)' : 'PER ITEM (needs a list above)'}>
            {ITEM_PATHS.map((p) => (
              <option key={p.path} value={p.path}>
                {p.label}
              </option>
            ))}
          </optgroup>
        </NativeSelect>
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

// ── Layout (containers) ──────────────────────────────────────────────────────

function LayoutPanel({
  layout,
  onLayout,
}: {
  layout: LayoutBase;
  onLayout: (patch: Partial<LayoutBase>) => void;
}) {
  return (
    <Group label="Layout">
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

// ── Box base (constant for every node) ───────────────────────────────────────

function BoxBasePanel({
  box,
  showHeight,
  onBox,
}: {
  box: BoxBase;
  showHeight: boolean;
  onBox: (patch: Partial<BoxBase>) => void;
}) {
  const toggleDevice = (d: Device, visible: boolean) => {
    const next = visible ? box.hiddenOn.filter((x) => x !== d) : [...new Set([...box.hiddenOn, d])];
    onBox({ hiddenOn: next });
  };

  return (
    <Group label="Layout & Style">
      <p className="bx-grp__caption">
        The same panel for every component — this is the shared base.
      </p>
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
      {showHeight ? (
        <Field label="Height">
          <Segmented
            value={box.height}
            options={HEIGHT_OPTIONS}
            onChange={(v) => onBox({ height: v })}
          />
        </Field>
      ) : null}
      <Field label="Spacing">
        <Segmented
          value={box.padding}
          options={SPACE_OPTIONS}
          onChange={(v) => onBox({ padding: v })}
        />
      </Field>
      <Field label="Surface">
        <Segmented
          value={box.surface}
          options={SURFACE_OPTIONS}
          onChange={(v) => onBox({ surface: v })}
        />
      </Field>
      <Field label="Align">
        <Segmented
          value={box.align}
          options={ALIGN_OPTIONS}
          onChange={(v) => onBox({ align: v })}
        />
      </Field>
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
    </Group>
  );
}

// ── The inspector ────────────────────────────────────────────────────────────

export interface InspectorProps {
  node: BuilderNode | null;
  inScope: boolean;
  onName: (name: string) => void;
  onBind: (path: string | null) => void;
  onProp: (key: string, value: unknown) => void;
  onLayout: (patch: Partial<LayoutBase>) => void;
  onBox: (patch: Partial<BoxBase>) => void;
}

export function Inspector({
  node,
  inScope,
  onName,
  onBind,
  onProp,
  onLayout,
  onBox,
}: InspectorProps) {
  if (!node) {
    return (
      <div className="bx-inspector bx-inspector--empty">
        <p>Select a layer on the canvas or in the Layers tree to edit it.</p>
      </div>
    );
  }
  const def = getDef(node.type);
  if (!def) return null;

  return (
    <div className="bx-inspector">
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
      </header>

      <BindingBox node={node} inScope={inScope} onBind={onBind} />
      <PropsPanel node={node} onProp={onProp} />
      {def.kind === 'container' && node.layout ? (
        <LayoutPanel layout={node.layout} onLayout={onLayout} />
      ) : null}
      <BoxBasePanel box={node.box} showHeight={def.showHeight} onBox={onBox} />
    </div>
  );
}
