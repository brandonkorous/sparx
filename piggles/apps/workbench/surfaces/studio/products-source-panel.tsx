'use client';

// What a product listing shows, in the Inspector, under the listing itself.
//
// The Products block has always been repointable — `ProductsSource` names five
// sources, the storefront renders all five, and `node.setData` writes the ref. No
// screen ever called it, so every listing anybody dropped was the whole catalog
// forever, and a homepage could not lead with one group (issue 211).

import { useMemo } from 'react';
import { Field, FieldDescription, FieldLabel, NativeSelect } from '@wizeworks/silicaui-react';
import type { AddressableNode, PageDoc } from '@wizeworks/studio';
import { ancestorsOf, walkTree } from '@wizeworks/studio';
import { useApply, useDoc } from '@wizeworks/studio/react';
import { useCollectionsPage } from '../commerce/collections-data';

const CATEGORY = 'commerce.category.';

/** The sources that are not a specific group. `related` is last because it is the
 *  only one that cannot answer on an ordinary page. */
const FIXED = [
  { ref: 'commerce.product', label: 'Everything in your shop' },
  { ref: 'commerce.featured', label: 'The ones you have featured' },
  { ref: 'commerce.new', label: 'Your newest' },
] as const;

const RELATED = { ref: 'commerce.related', label: 'Others from the same group' } as const;

/** Is this ref one a product listing can be pointed at? */
function isProductSource(ref: string): boolean {
  if (ref.startsWith(CATEGORY)) return true;
  return ref === 'commerce.product' || ref === RELATED.ref || FIXED.some((s) => s.ref === ref);
}

/** The listing's current source, or null when this node is not a listing. */
function sourceOf(node: AddressableNode): string | null {
  const data = node.data;
  if (data?.kind !== 'collection') return null;
  return isProductSource(data.ref) ? data.ref : null;
}

export function ProductsSourcePanel({ node }: { node: AddressableNode }) {
  const current = node.id ? sourceOf(node) : null;
  if (!current) return null;
  return <SourceField node={node} current={current} />;
}

function SourceField({ node, current }: { node: AddressableNode; current: string }) {
  const apply = useApply();
  const doc = useDoc<PageDoc>();
  // Her own groups, by the names she gave them. Enough to cover a long list; the
  // picker is a choice among what she has, not a search over a catalog.
  const groups = useCollectionsPage({ sortBy: 'name', order: 'asc', take: 200, skip: 0 });

  // Related means "others from the group of the product being looked at", so it can
  // only resolve on a record template. Offering it on a homepage would be offering a
  // source that renders nothing and never says why.
  const isTemplate = doc.kind === 'page' && doc.recordType !== null;
  const options = isTemplate ? [...FIXED, RELATED] : FIXED;

  // Every node in this listing that carries the SAME ref, not just the repeat: the
  // heading and the "nothing here" sentence are bound to it too (`repeatOrEmpty`,
  // `headingRow`), so moving one and not the others leaves a group's products under a
  // heading that appears and disappears with the whole catalog.
  const targets = useMemo(() => refTwins(doc, node.id ?? '', current), [doc, node.id, current]);

  const choose = (next: string) => {
    if (next === current || targets.length === 0) return;
    apply(
      'Change what this shows',
      targets.map((target) => ({
        kind: 'node.setData' as const,
        id: target.id,
        value: { ...target.data, ref: next },
      }))
    );
  };

  return (
    <div className="border-base-300 mt-4 flex flex-col gap-4 border-t pt-4">
      <p className="text-base-content text-sm font-medium">What this shows</p>
      <Field>
        <FieldLabel>Products</FieldLabel>
        <NativeSelect
          color="module"
          value={current}
          onChange={(event) => {
            choose(event.currentTarget.value);
          }}
        >
          {options.map((option) => (
            <option key={option.ref} value={option.ref}>
              {option.label}
            </option>
          ))}
          {groups.data?.items.length ? (
            <optgroup label="One group of products">
              {groups.data.items.map((group) => (
                <option key={group.id} value={`${CATEGORY}${group.handle}`}>
                  {group.name} ({group.productCount})
                </option>
              ))}
            </optgroup>
          ) : null}
          {/* A group that has since been renamed or deleted still has to be
              selectable, or the box would silently show the wrong answer. */}
          {current.startsWith(CATEGORY) && !knownGroup(groups.data?.items, current) ? (
            <option value={current}>A group that is no longer here</option>
          ) : null}
        </NativeSelect>
        <FieldDescription>
          {current.startsWith(CATEGORY)
            ? 'Only the products in that group appear here. Add one to the group and it turns up on its own.'
            : 'Change this and the products below change with it.'}
        </FieldDescription>
      </Field>
    </div>
  );
}

interface RefTwin {
  id: string;
  data: NonNullable<AddressableNode['data']>;
}

/**
 * Every node bound to `ref` inside THIS listing — the repeat, the heading's
 * visibility, and the empty sentence's.
 *
 * Scoped to the listing's own `<section>`, never the whole page. A page can hold two
 * listings on the same source (the starter ships exactly that), and repointing one has
 * to leave the other alone.
 */
function refTwins(doc: PageDoc, id: string, ref: string): RefTwin[] {
  const block = blockOf(doc, id);
  if (!block) return [];
  const found: RefTwin[] = [];
  walkTree(block, (node) => {
    const data = node.data;
    if (node.id && data?.ref === ref) found.push({ id: node.id, data });
  });
  return found;
}

/** The listing's own section — the nearest `<section>` above it, else its parent, so a
 *  block someone has restructured still repoints as one thing rather than not at all. */
function blockOf(doc: PageDoc, id: string): AddressableNode | undefined {
  const trail = ancestorsOf(doc.root, id);
  if (trail.length === 0) return undefined;
  for (let i = trail.length - 1; i >= 0; i -= 1) {
    const node = trail[i];
    if (node && 'tag' in node && node.tag === 'section') return node;
  }
  return trail[trail.length - 1];
}

function knownGroup(items: { handle: string }[] | undefined, ref: string): boolean {
  const handle = ref.slice(CATEGORY.length);
  return (items ?? []).some((item) => item.handle === handle);
}
