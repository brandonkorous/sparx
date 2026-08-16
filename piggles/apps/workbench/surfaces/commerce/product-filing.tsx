'use client';

// ══════════════════════════════════════════════════════════════════════════
// WHERE SHOPPERS FIND IT — the product's categories and its collections.
//
// Lives on the Overview tab rather than in a pane of its own, and that is a
// decision rather than a shortcut. The hybrid rule is that a PANE is another
// module's functionality seen through a product (stock is Inventory's, trade
// prices are B2B's) while a TAB is a facet of the product record. Categories
// and collections are neither of those things by accident: `categoryIds` and
// `collectionIds` are fields on the product PATCH payload, written by the same
// endpoint as the title and the tags. A pane would need a Save of its own,
// writing the same two fields the Overview tab can write — two owners of one
// field, which is the exact failure products-data.ts opens by warning about.
//
// So this is a controlled sub-form: the Overview tab owns the draft, this file
// owns the shape of the decision, and the one Save in the pane toolbar commits
// both together.
//
// ── The crux: a rule can put a product in a collection ───────────────────
//
// A collection is either a hand-picked list (`manual`) or a set of conditions
// that fills itself (`rules`). A product in a rules-driven collection is there
// because it MATCHED — nobody put it there — and three things follow that the
// UI has to get right or it lies to people:
//
//   1. The two memberships must not look the same. They are badged
//      differently and grouped separately, because "you did this" and "your
//      rule did this" have completely different answers to "how do I undo it".
//
//   2. Nobody may be offered a Remove that does nothing. Removing a rule
//      membership from the product side deletes a row that isn't there (the
//      write only touches `addedBy='manual'`) and the next reprojection would
//      restore it anyway. So there is no Remove on those rows at all — there
//      is a sentence saying where the decision actually lives.
//
//   3. Saving must not silently convert one into the other. The product record
//      reports every membership in `collectionIds` regardless of origin, so an
//      editor that round-trips that array re-saves rule memberships as MANUAL
//      pins — freezing the product into a smart collection forever, invisibly.
//      This form therefore drafts only the manual set, and the server now
//      refuses a rules-driven id on PATCH as a second line of defence
//      (product-service.ts `update`).
//
// A rules-driven collection still appears in the picker, badged and with NO
// checkbox at all, rather than being filtered out. "Why can I not tick Summer
// Sale?" is a better question to answer in place than to leave as a hole in a
// list — and a disabled tick box is not the answer, because at a glance it
// reads as an empty one and it offers a control that will not do anything.
// ══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  Heading,
  SearchInput,
  Text,
} from '@wizeworks/silicaui-react';
import { faLayerGroup, faTags, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  flattenCategories,
  productErrorMessage,
  splitMemberships,
  useCategoryTree,
  useCollections,
  type CategoryChoice,
} from './products-data';
import { InlineWaiting } from '../../components/inline-waiting';

interface FilingProps {
  ctx: SurfaceContext;
  /** The draft's categories. Every category is equal — the server marks the
   *  first as primary, which nothing user-facing exposes, so order is not a
   *  decision this form asks anyone to make. */
  categoryIds: string[];
  /** The draft's HAND-PICKED collections only. Never the rule-driven ones. */
  manualCollectionIds: string[];
  /** Straight off the product record, so the rule-driven half can be shown as
   *  the fact it is rather than as something to edit. */
  memberships: { collectionId: string; addedBy: 'manual' | 'rule' }[];
  onCategoriesChange: (next: string[]) => void;
  onCollectionsChange: (next: string[]) => void;
}

export function ProductFilingSections({
  ctx,
  categoryIds,
  manualCollectionIds,
  memberships,
  onCategoriesChange,
  onCollectionsChange,
}: FilingProps) {
  return (
    <>
      <CategorySection ctx={ctx} selected={categoryIds} onChange={onCategoriesChange} />
      <CollectionSection
        ctx={ctx}
        selected={manualCollectionIds}
        memberships={memberships}
        onChange={onCollectionsChange}
      />
    </>
  );
}

/* ── Categories ─────────────────────────────────────────────────────────── */

function CategorySection({
  ctx,
  selected,
  onChange,
}: {
  ctx: SurfaceContext;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const tree = useCategoryTree();
  const [search, setSearch] = useState('');

  const all = useMemo(() => flattenCategories(tree.data), [tree.data]);
  const matches = useMemo(() => filterCategories(all, search), [all, search]);
  const chosen = useMemo(
    () => all.filter((category) => selected.includes(category.id)),
    [all, selected]
  );

  const toggle = (id: string, on: boolean) => {
    onChange(on ? [...selected, id] : selected.filter((value) => value !== id));
  };

  return (
    <FormSection
      title="Categories"
      // The whole difference between the two words, said once, in the place
      // where someone is about to have to choose between them.
      description="The part of your website's menu this product sits in — like an aisle in a shop. Pick as many as fit; most products belong in one."
    >
      {tree.isError ? (
        <LoadFailure
          title="Could not load your categories"
          detail={productErrorMessage(
            tree.error,
            'The list could not be read just now. Nothing about this product has changed.'
          )}
          onRetry={() => {
            void tree.refetch();
          }}
        />
      ) : tree.isPending ? (
        <InlineWaiting label="Loading your categories…" />
      ) : all.length === 0 ? (
        <Nothing
          icon={<Icon glyph={faTags} className="size-5" aria-hidden />}
          line="You have not made any categories yet. They are what builds the menu shoppers browse down."
          actionLabel="Set up categories"
          onAction={(event) => {
            ctx.open('commerce.categories.list', undefined, {
              target: event.shiftKey ? 'beside' : 'tab',
            });
          }}
        />
      ) : (
        <>
          <ChosenSummary
            empty="Not filed in any category yet — shoppers browsing your menu will not come across it."
            label="Filed in"
            items={chosen.map((category) => ({
              id: category.id,
              label: trailText(category),
            }))}
            onRemove={(id) => {
              toggle(id, false);
            }}
          />

          <Picker
            label="Search categories"
            placeholder="Search categories…"
            value={search}
            onValueChange={setSearch}
            total={all.length}
            matched={matches.length}
            noun="category"
            nounPlural="categories"
          >
            {matches.map((category) => (
              <label
                key={category.id}
                className="hover:bg-base-200 flex cursor-pointer items-center gap-3 rounded px-2 py-2"
              >
                <Checkbox
                  color="module"
                  checked={selected.includes(category.id)}
                  aria-label={trailText(category)}
                  onChange={(event) => {
                    toggle(category.id, event.target.checked);
                  }}
                />
                {/* Hierarchy WITHOUT drawing a tree: the ancestors read as a
                    trail at full ink, and the category itself is the heaviest
                    thing on the row. Indentation would collapse to nothing in a
                    narrow docked pane, and a real tree control is a lot of
                    machinery for a list someone reads once per product. */}
                <span className="min-w-0 flex-1">
                  {category.trail.slice(0, -1).map((ancestor) => (
                    <span key={ancestor}>{ancestor} › </span>
                  ))}
                  <span className="font-semibold">{category.name}</span>
                </span>
              </label>
            ))}
          </Picker>
        </>
      )}
    </FormSection>
  );
}

/** Case-insensitive over the whole trail, so typing a parent's name finds its
 *  children — which is how someone who knows "it goes under Camping somewhere"
 *  actually searches. */
function filterCategories(all: CategoryChoice[], search: string): CategoryChoice[] {
  const needle = search.trim().toLowerCase();
  if (needle === '') return all;
  return all.filter((category) => trailText(category).toLowerCase().includes(needle));
}

function trailText(category: CategoryChoice): string {
  return category.trail.join(' › ');
}

/* ── Collections ────────────────────────────────────────────────────────── */

function CollectionSection({
  ctx,
  selected,
  memberships,
  onChange,
}: {
  ctx: SurfaceContext;
  selected: string[];
  memberships: { collectionId: string; addedBy: 'manual' | 'rule' }[];
  onChange: (next: string[]) => void;
}) {
  const collections = useCollections();
  const [search, setSearch] = useState('');

  const all = collections.data;
  const { automatic, unknownIds } = useMemo(
    () => splitMemberships(memberships, all),
    [memberships, all]
  );
  // The CHOSEN list comes from the draft, not from the saved memberships —
  // otherwise a tick added a moment ago would not show up here until Save.
  const chosen = useMemo(
    () => (all ?? []).filter((collection) => selected.includes(collection.id)),
    [all, selected]
  );

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = all ?? [];
    if (needle === '') return list;
    return list.filter((collection) => collection.name.toLowerCase().includes(needle));
  }, [all, search]);

  const toggle = (id: string, on: boolean) => {
    onChange(on ? [...selected, id] : selected.filter((value) => value !== id));
  };

  return (
    <FormSection
      title="Collections"
      description="A themed set of products you show together — a summer sale, a gift guide, this month's arrivals. Unlike a category, a collection is not part of your menu: it is a group you can put wherever you like."
    >
      {collections.isError ? (
        <LoadFailure
          title="Could not load your collections"
          detail={productErrorMessage(
            collections.error,
            'The list could not be read just now. Nothing about this product has changed.'
          )}
          onRetry={() => {
            void collections.refetch();
          }}
        />
      ) : collections.isPending ? (
        <InlineWaiting label="Loading your collections…" />
      ) : (all ?? []).length === 0 ? (
        <Nothing
          icon={<Icon glyph={faLayerGroup} className="size-5" aria-hidden />}
          line="You have not made any collections yet. They are how you show a themed group of products on your website."
          actionLabel="Set up collections"
          onAction={(event) => {
            ctx.open('commerce.collections.list', undefined, {
              target: event.shiftKey ? 'beside' : 'tab',
            });
          }}
        />
      ) : (
        <>
          <ChosenSummary
            empty="Not in any collection you picked."
            label="You put it in"
            items={chosen.map((collection) => ({ id: collection.id, label: collection.name }))}
            onRemove={(id) => {
              toggle(id, false);
            }}
          />

          {/* The honest half. Separate block, separate wording, no Remove —
              see the header of this file for why a Remove here would be a lie. */}
          {automatic.length > 0 ? (
            <div className="border-base-300 flex flex-col gap-2 rounded border p-3">
              <Heading level={3} className="text-base font-semibold">
                {automatic.length === 1
                  ? 'It also matched a collection on its own'
                  : 'It also matched some collections on its own'}
              </Heading>
              {/* Written out in full per plurality rather than stitched from
                  fragments — interpolating "fill"/"fills" around a shared tail
                  is exactly how a sentence ends up reading "these collections
                  fill itself". */}
              <Text>
                {automatic.length === 1
                  ? 'This collection fills itself from conditions you wrote, and this product fits them. You cannot take it out from here — either change what that collection looks for, or change the product so it no longer fits.'
                  : 'These collections fill themselves from conditions you wrote, and this product fits them. You cannot take it out from here — either change what those collections look for, or change the product so it no longer fits.'}
              </Text>
              <ul className="flex flex-col gap-2">
                {automatic.map((collection) => (
                  <li key={collection.id} className="flex flex-wrap items-center gap-2">
                    <Text as="span" className="font-medium">
                      {collection.name}
                    </Text>
                    <Badge color="info" variant="soft" size="sm">
                      A rule put it here
                    </Badge>
                  </li>
                ))}
              </ul>
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  color="module"
                  onClick={(event) => {
                    ctx.open('commerce.collections.list', undefined, {
                      target: event.shiftKey ? 'beside' : 'tab',
                    });
                  }}
                >
                  Open collections
                </Button>
              </div>
            </div>
          ) : null}

          {unknownIds.length > 0 ? (
            <Text>
              {unknownIds.length === 1
                ? 'This product is also in one collection that is no longer in your list — most likely it was deleted. Saving here leaves it exactly as it is.'
                : `This product is also in ${String(unknownIds.length)} collections that are no longer in your list — most likely they were deleted. Saving here leaves them exactly as they are.`}
            </Text>
          ) : null}

          <Picker
            label="Search collections"
            placeholder="Search collections…"
            value={search}
            onValueChange={setSearch}
            total={(all ?? []).length}
            matched={matches.length}
            noun="collection"
            nounPlural="collections"
          >
            {matches.map((collection) =>
              collection.type === 'rules' ? (
                // Listed rather than filtered out — a collection absent from
                // this list with no explanation is a support ticket waiting to
                // be written. But it gets NO checkbox, not even a disabled one:
                // a tick box that can never be ticked is a control offering
                // something it will not do, and a disabled one reads as
                // identical to an empty one at a glance. The name stays at full
                // ink because it is still meant to be read; the padding lines it
                // up with the rows that do have a box.
                <div key={collection.id} className="flex items-center gap-3 rounded py-2 pr-2 pl-2">
                  <span className="min-w-0 flex-1 pl-9">{collection.name}</span>
                  <Badge color="info" variant="soft" size="sm">
                    Fills itself from a rule
                  </Badge>
                </div>
              ) : (
                <label
                  key={collection.id}
                  className="hover:bg-base-200 flex cursor-pointer items-center gap-3 rounded px-2 py-2"
                >
                  <Checkbox
                    color="module"
                    checked={selected.includes(collection.id)}
                    aria-label={collection.name}
                    onChange={(event) => {
                      toggle(collection.id, event.target.checked);
                    }}
                  />
                  <span className="min-w-0 flex-1">{collection.name}</span>
                </label>
              )
            )}
          </Picker>
        </>
      )}
    </FormSection>
  );
}

/* ── Shared pieces ──────────────────────────────────────────────────────── */

/** What is currently ticked, as removable rows, so a choice buried three
 *  hundred rows down the picker is still visible at a glance. */
function ChosenSummary({
  label,
  empty,
  items,
  onRemove,
}: {
  label: string;
  empty: string;
  items: { id: string; label: string }[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return <Text>{empty}</Text>;
  return (
    <div className="flex flex-col gap-2">
      <Text className="font-medium">{label}</Text>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <span className="border-base-300 flex items-center gap-1 rounded-full border py-1 pr-1 pl-3">
              <Text as="span">{item.label}</Text>
              <Button
                size="xs"
                shape="circle"
                variant="ghost"
                color="neutral"
                aria-label={`Remove ${item.label}`}
                onClick={() => {
                  onRemove(item.id);
                }}
              >
                <Icon glyph={faXmark} className="size-3.5" aria-hidden />
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Search box + a scrolling checklist. The height is capped so a business with
 *  three hundred categories does not turn the Overview tab into a mile of
 *  checkboxes with the Save button somewhere over the horizon. */
function Picker({
  label,
  placeholder,
  value,
  onValueChange,
  total,
  matched,
  noun,
  nounPlural,
  children,
}: {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (next: string) => void;
  total: number;
  matched: number;
  noun: string;
  nounPlural: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Only worth a search box once the list is long enough to lose something
          in. Below that it is a control that answers a question nobody has. */}
      {total > 8 ? (
        <div className="max-w-sm min-w-0">
          <SearchInput
            size="sm"
            aria-label={label}
            placeholder={placeholder}
            value={value}
            onValueChange={onValueChange}
          />
        </div>
      ) : null}

      {matched === 0 ? (
        // "Nothing matched what you typed" and "you have none of these" are
        // completely different situations, and telling someone to go make their
        // first category when they have forty and mistyped is the worse one.
        <div className="flex flex-wrap items-center gap-2">
          <Text>
            No {noun} matches “{value.trim()}”. You have {total} {total === 1 ? noun : nounPlural}.
          </Text>
          <Button
            size="sm"
            variant="ghost"
            color="module"
            onClick={() => {
              onValueChange('');
            }}
          >
            Show all {nounPlural}
          </Button>
        </div>
      ) : (
        <div className="border-base-300 max-h-72 overflow-y-auto rounded border p-1">
          {children}
        </div>
      )}
    </div>
  );
}

/** A failed load REPLACES the picker. Rendering an empty checklist beside a
 *  live Save would let someone "clear" every category they have by saving a
 *  list that failed to arrive. */
function LoadFailure({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry: () => void;
}) {
  return (
    <Alert color="error" variant="soft">
      <AlertContent>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{detail}</AlertDescription>
      </AlertContent>
      <Button size="sm" variant="outline" color="error" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}

function Nothing({
  icon,
  line,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  line: string;
  actionLabel: string;
  onAction: (event: { shiftKey: boolean }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {icon}
      <Text className="min-w-0 flex-1">{line}</Text>
      <Button size="sm" variant="outline" color="module" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
