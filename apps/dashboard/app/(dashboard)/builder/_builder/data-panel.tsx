'use client';

// The "Data" panel (docs/98 Pillar 7) — the store-builder fix. Beyond the field
// picker (DataSource, which replaces a leaf's TEXT with a value), this connects a
// block to a CONCRETE record or wires an interactive action:
//
//   · a CONTAINER can PIN to one product ("this card IS Product X") or REPEAT the
//     products of a collection / category / the whole catalog;
//   · a BUTTON / LINK can fire an action on click (add to cart / buy now / link /
//     submit), resolved against the product scope an ancestor pin / repeat sets.
//
// Every choice writes `node.binding` through the inspector's `onBind` (widened to
// accept a full Binding). The picker lists come from the public commerce surface
// via server actions, so the canvas previews the SAME products the live site sells.

import * as React from 'react';
import { Input, NativeSelect } from '@sparx/ui';
import {
  bindingKind,
  isRawElementType,
  rawTagOf,
  type Binding,
  type BuilderNode,
} from '@sparx/builder-schemas';

import type { ComponentDef } from './registry';
import {
  listCategoriesForBuilder,
  listCollectionsForBuilder,
  searchProductsForBuilder,
  type NamedPick,
  type ProductPick,
} from '../_lib/commerce-binding-actions';

const UNSET = '__unset';
const ACTION_LEAF_TAGS = new Set(['a', 'button']);

/** Which Data control a node gets: containers connect to records; buttons / links
 *  wire an action. Everything else has none (its content is the field picker). */
export function dataConnectMode(node: BuilderNode, def: ComponentDef): 'record' | 'action' | null {
  if (def.kind === 'container') return 'record';
  if (node.type === 'Button') return 'action';
  if (isRawElementType(node.type) && ACTION_LEAF_TAGS.has(rawTagOf(node.type) ?? '')) {
    return 'action';
  }
  return null;
}

/** Does this node carry a commerce/action binding (so the field DataSource hides)? */
export function hasRecordOrActionBinding(node: BuilderNode): boolean {
  const k = bindingKind(node.binding);
  return k === 'entity' || k === 'collection' || k === 'action';
}

/** A one-line summary for the Data card header. */
export function dataConnectSummary(node: BuilderNode): string | undefined {
  const b = node.binding;
  if (!b) return undefined;
  if (b.action) return ACTION_LABELS[b.action] ?? b.action;
  if (b.source)
    return `Repeats ${b.source.from === 'all' ? 'all products' : (b.label ?? b.source.from)}`;
  if (b.entity === 'product') return `Pinned: ${b.label ?? 'a product'}`;
  return undefined;
}

const ACTION_LABELS: Record<string, string> = {
  'add-to-cart': 'Add to cart',
  'buy-now': 'Buy now',
  link: 'Open a link',
  submit: 'Submit form',
};

export function DataConnect({
  node,
  def,
  onBind,
}: {
  node: BuilderNode;
  def: ComponentDef;
  onBind: (target: string | Binding | null) => void;
}) {
  const mode = dataConnectMode(node, def);
  if (mode === 'record') return <RecordConnect node={node} onBind={onBind} />;
  if (mode === 'action') return <ActionConnect node={node} onBind={onBind} />;
  return null;
}

// ── Container → pin a product / repeat a source ───────────────────────────────

type RecordTab = 'none' | 'pin' | 'repeat';

function RecordConnect({
  node,
  onBind,
}: {
  node: BuilderNode;
  onBind: (target: string | Binding | null) => void;
}) {
  const b = node.binding;
  const initial: RecordTab = b?.source ? 'repeat' : b?.entity === 'product' ? 'pin' : 'none';
  const [tab, setTab] = React.useState<RecordTab>(initial);

  return (
    <div className="bx-source">
      <span className="bx-field__label">Connect this block</span>
      <div className="bx-seg" role="group">
        <button
          type="button"
          className="bx-seg__btn"
          data-on={tab === 'none'}
          aria-pressed={tab === 'none'}
          onClick={() => {
            setTab('none');
            if (b?.entity || b?.source) onBind(null);
          }}
        >
          Static
        </button>
        <button
          type="button"
          className="bx-seg__btn"
          data-on={tab === 'pin'}
          aria-pressed={tab === 'pin'}
          onClick={() => setTab('pin')}
        >
          A product
        </button>
        <button
          type="button"
          className="bx-seg__btn"
          data-on={tab === 'repeat'}
          aria-pressed={tab === 'repeat'}
          onClick={() => setTab('repeat')}
        >
          Many products
        </button>
      </div>
      {tab === 'pin' ? <ProductPin binding={b} onBind={onBind} /> : null}
      {tab === 'repeat' ? <SourceRepeat binding={b} onBind={onBind} /> : null}
      {tab === 'none' ? (
        <p className="bx-source__hint">
          A static block. Pin it to one product to build a product card, or repeat many to build a
          grid — each child then reads <code>item.title</code>, <code>item.price</code>, an image…
        </p>
      ) : null}
    </div>
  );
}

function ProductPin({
  binding,
  onBind,
}: {
  binding: Binding | undefined;
  onBind: (target: string | Binding | null) => void;
}) {
  const [q, setQ] = React.useState('');
  const [items, setItems] = React.useState<ProductPick[] | null>(null);
  const pinnedId = binding?.entity === 'product' ? binding.id : null;

  React.useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      void searchProductsForBuilder(q).then((res) => {
        if (alive) setItems(res);
      });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="bx-source__picker">
      <Input
        size="sm"
        value={q}
        placeholder="Search products…"
        aria-label="Search products"
        onChange={(e) => setQ(e.target.value)}
      />
      <NativeSelect
        size="sm"
        aria-label="Pin to a product"
        value={pinnedId ?? UNSET}
        onChange={(e) => {
          const id = e.target.value;
          if (id === UNSET) {
            onBind(null);
            return;
          }
          const title = items?.find((p) => p.id === id)?.title;
          onBind({ entity: 'product', id, ...(title ? { label: title } : {}) });
        }}
      >
        <option value={UNSET}>{items === null ? 'Loading…' : '— Choose a product —'}</option>
        {/* Keep the pinned product selectable even if it's outside the current search. */}
        {pinnedId && !items?.some((p) => p.id === pinnedId) ? (
          <option value={pinnedId}>{binding?.label ?? 'Pinned product'}</option>
        ) : null}
        {(items ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </NativeSelect>
      <p className="bx-source__hint">
        Everything inside now reads this product — a Heading bound to <code>item.title</code>, a
        Price to <code>item.price</code>, an Add-to-cart button that sells it.
      </p>
    </div>
  );
}

type RepeatFrom = 'all' | 'collection' | 'category';

function SourceRepeat({
  binding,
  onBind,
}: {
  binding: Binding | undefined;
  onBind: (target: string | Binding | null) => void;
}) {
  const src = binding?.source;
  const from: RepeatFrom = src?.from ?? 'all';
  const [collections, setCollections] = React.useState<NamedPick[] | null>(null);
  const [categories, setCategories] = React.useState<NamedPick[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (from === 'collection' && collections === null) {
      void listCollectionsForBuilder().then((r) => alive && setCollections(r));
    }
    if (from === 'category' && categories === null) {
      void listCategoriesForBuilder().then((r) => alive && setCategories(r));
    }
    return () => {
      alive = false;
    };
  }, [from, collections, categories]);

  const setSource = (next: { from: RepeatFrom; id?: string; label?: string }) => {
    const limit = src?.limit;
    onBind({
      source: { from: next.from, ...(next.id ? { id: next.id } : {}), ...(limit ? { limit } : {}) },
      ...(next.label ? { label: next.label } : {}),
    });
  };

  const options = from === 'collection' ? collections : from === 'category' ? categories : null;

  return (
    <div className="bx-source__picker">
      <NativeSelect
        size="sm"
        aria-label="Repeat products from"
        value={from}
        onChange={(e) => {
          const nextFrom = e.target.value as RepeatFrom;
          if (nextFrom === 'all') setSource({ from: 'all', label: 'all products' });
          else setSource({ from: nextFrom }); // id chosen below
        }}
      >
        <option value="all">All products</option>
        <option value="collection">A collection</option>
        <option value="category">A category</option>
      </NativeSelect>
      {from !== 'all' ? (
        <NativeSelect
          size="sm"
          aria-label={from === 'collection' ? 'Choose a collection' : 'Choose a category'}
          value={src?.id ?? UNSET}
          onChange={(e) => {
            const id = e.target.value;
            if (id === UNSET) return;
            const label = options?.find((o) => o.id === id)?.name;
            setSource({ from, id, label });
          }}
        >
          <option value={UNSET}>
            {options === null
              ? 'Loading…'
              : from === 'collection'
                ? '— Choose a collection —'
                : '— Choose a category —'}
          </option>
          {(options ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      <div className="bx-field">
        <span className="bx-field__label">Max products</span>
        <Input
          size="sm"
          type="number"
          min={1}
          max={48}
          value={src?.limit ?? 24}
          aria-label="Maximum products"
          onChange={(e) => {
            const n = Math.max(1, Math.min(48, Number(e.target.value) || 24));
            onBind({
              source: { from, ...(src?.id ? { id: src.id } : {}), limit: n },
              ...(binding?.label ? { label: binding.label } : {}),
            });
          }}
        />
      </div>
      <p className="bx-source__hint">
        The blocks inside repeat once per product. Put a card here, bind its parts to{' '}
        <code>item.*</code>, and add a Buy button — you have a shoppable grid.
      </p>
    </div>
  );
}

// ── Button / link → an action ─────────────────────────────────────────────────

function ActionConnect({
  node,
  onBind,
}: {
  node: BuilderNode;
  onBind: (target: string | Binding | null) => void;
}) {
  const action = node.binding?.action ?? '';
  const href = node.binding?.href ?? '';

  return (
    <div className="bx-source">
      <span className="bx-field__label">On click</span>
      <NativeSelect
        size="sm"
        aria-label="Click action"
        value={action || UNSET}
        onChange={(e) => {
          const next = e.target.value;
          if (next === UNSET) {
            onBind(null);
            return;
          }
          if (next === 'link') onBind({ action: 'link', ...(href ? { href } : {}) });
          else onBind({ action: next as Binding['action'] });
        }}
      >
        <option value={UNSET}>— Nothing —</option>
        <option value="add-to-cart">Add to cart</option>
        <option value="buy-now">Buy now</option>
        <option value="link">Open a link</option>
        <option value="submit">Submit form</option>
      </NativeSelect>
      {action === 'link' ? (
        <Input
          size="sm"
          value={href}
          placeholder="/products  or  https://…"
          aria-label="Link URL"
          onChange={(e) => onBind({ action: 'link', href: e.target.value })}
        />
      ) : null}
      {action === 'add-to-cart' || action === 'buy-now' ? (
        <p className="bx-source__hint">
          Wired to the product this button sits inside — a pinned product card or one item of a
          repeated grid. Place it within a product to sell it.
        </p>
      ) : null}
    </div>
  );
}
