'use client';

// The record-PIN pickers for the Data panel (docs/98 Pillar 7). A container can pin
// to ONE concrete record and its descendants then read `item.*`:
//   · a PRODUCT  — a shoppable card (keeps the buy-box: item.price + Add-to-cart);
//   · a COLLECTION / CATEGORY — record-display (its OWN name / description / hero);
//   · a CONTENT ENTRY (CMS) — a featured post / page (item.title / item.body / …).
// `RecordPin` is the kind switch; each sub-picker writes the matching entity binding
// through `onBind`. Split out of data-panel.tsx so that file stays the panel shell.

import * as React from 'react';
import { Input, NativeSelect } from '@sparx/ui';
import type { Binding } from '@sparx/builder-schemas';

import {
  listCategoriesForBuilder,
  listCollectionsForBuilder,
  searchProductsForBuilder,
  type NamedPick,
  type ProductPick,
} from '../_lib/commerce-binding-actions';
import { listCmsEntriesForBuilder, type EntryPick } from '../_lib/cms-binding-actions';

const UNSET = '__unset';

type OnBind = (target: string | Binding | null) => void;

/** The kind switch + the matching record picker. A node's current binding decides the
 *  starting kind (a CMS pin carries its type, so each content type is its own kind). */
export function RecordPin({
  binding,
  onBind,
  cmsTypes,
}: {
  binding: Binding | undefined;
  onBind: OnBind;
  cmsTypes: { key: string; name: string }[];
}) {
  const currentKind =
    binding?.entity === 'cms' ? `cms:${binding.cmsType ?? ''}` : (binding?.entity ?? 'product');
  const [kind, setKind] = React.useState<string>(currentKind);

  const onKind = (next: string) => {
    setKind(next);
    // Switching kind clears the prior record — its id doesn't belong to the new kind.
    if (binding?.entity) onBind(null);
  };

  return (
    <>
      <NativeSelect
        size="sm"
        aria-label="Record type"
        value={kind}
        onChange={(e) => onKind(e.target.value)}
      >
        <option value="product">A product</option>
        <option value="collection">A collection</option>
        <option value="category">A category</option>
        {cmsTypes.map((t) => (
          <option key={t.key} value={`cms:${t.key}`}>
            {t.name}
          </option>
        ))}
      </NativeSelect>
      {kind === 'product' ? <ProductPin binding={binding} onBind={onBind} /> : null}
      {kind === 'collection' ? (
        <NamedRecordPick entity="collection" binding={binding} onBind={onBind} />
      ) : null}
      {kind === 'category' ? (
        <NamedRecordPick entity="category" binding={binding} onBind={onBind} />
      ) : null}
      {kind.startsWith('cms:') ? (
        <CmsEntryPick cmsType={kind.slice('cms:'.length)} binding={binding} onBind={onBind} />
      ) : null}
    </>
  );
}

function ProductPin({ binding, onBind }: { binding: Binding | undefined; onBind: OnBind }) {
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

/** A collection / category RECORD pick (record-display): the tenant's records by name,
 *  writing an `{ entity, id, label }` binding. Descendants read the record's own
 *  fields (`item.name`, `item.description`, `item.image`). */
function NamedRecordPick({
  entity,
  binding,
  onBind,
}: {
  entity: 'collection' | 'category';
  binding: Binding | undefined;
  onBind: OnBind;
}) {
  const [items, setItems] = React.useState<NamedPick[] | null>(null);
  const pinnedId = binding?.entity === entity ? binding.id : null;

  React.useEffect(() => {
    let alive = true;
    const load = entity === 'collection' ? listCollectionsForBuilder : listCategoriesForBuilder;
    void load().then((r) => {
      if (alive) setItems(r);
    });
    return () => {
      alive = false;
    };
  }, [entity]);

  return (
    <div className="bx-source__picker">
      <NativeSelect
        size="sm"
        aria-label={`Pin to a ${entity}`}
        value={pinnedId ?? UNSET}
        onChange={(e) => {
          const id = e.target.value;
          if (id === UNSET) {
            onBind(null);
            return;
          }
          const name = items?.find((o) => o.id === id)?.name;
          onBind({ entity, id, ...(name ? { label: name } : {}) });
        }}
      >
        <option value={UNSET}>{items === null ? 'Loading…' : `— Choose a ${entity} —`}</option>
        {pinnedId && !items?.some((o) => o.id === pinnedId) ? (
          <option value={pinnedId}>{binding?.label ?? `Pinned ${entity}`}</option>
        ) : null}
        {(items ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </NativeSelect>
      <p className="bx-source__hint">
        Everything inside now reads this {entity} — a Heading bound to <code>item.name</code>, body
        text to <code>item.description</code>, an Image to <code>item.image</code>.
      </p>
    </div>
  );
}

/** A CMS entry pick (record-display): published entries of one content type, writing
 *  an `{ entity:'cms', id, cmsType, label }` binding. Descendants read the entry's
 *  content-type fields (`item.title`, `item.body`, `item.featuredImage`, …). */
function CmsEntryPick({
  cmsType,
  binding,
  onBind,
}: {
  cmsType: string;
  binding: Binding | undefined;
  onBind: OnBind;
}) {
  const [items, setItems] = React.useState<EntryPick[] | null>(null);
  const pinnedId = binding?.entity === 'cms' && binding.cmsType === cmsType ? binding.id : null;

  React.useEffect(() => {
    let alive = true;
    setItems(null);
    void listCmsEntriesForBuilder(cmsType).then((r) => {
      if (alive) setItems(r);
    });
    return () => {
      alive = false;
    };
  }, [cmsType]);

  return (
    <div className="bx-source__picker">
      <NativeSelect
        size="sm"
        aria-label="Pin to a content entry"
        value={pinnedId ?? UNSET}
        onChange={(e) => {
          const id = e.target.value;
          if (id === UNSET) {
            onBind(null);
            return;
          }
          const name = items?.find((o) => o.id === id)?.name;
          onBind({ entity: 'cms', id, cmsType, ...(name ? { label: name } : {}) });
        }}
      >
        <option value={UNSET}>{items === null ? 'Loading…' : '— Choose an entry —'}</option>
        {pinnedId && !items?.some((o) => o.id === pinnedId) ? (
          <option value={pinnedId}>{binding?.label ?? 'Pinned entry'}</option>
        ) : null}
        {(items ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </NativeSelect>
      <p className="bx-source__hint">
        Everything inside now reads this entry — a Heading bound to <code>item.title</code>, a Prose
        to <code>item.body</code>, an Image to <code>item.featuredImage</code>.
      </p>
    </div>
  );
}
