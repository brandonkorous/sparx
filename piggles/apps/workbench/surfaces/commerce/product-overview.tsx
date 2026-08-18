'use client';

// The Overview tab — what the thing IS.
//
// Overview owns the fields that describe the product itself and belong to no
// other tab: its name, what it says, its web address, how it is filed, which
// sites show it, and the two rare lifecycle acts at the end. Price lives on
// Variants, images on Media, search wording on SEO. If a field has a tab of its
// own, it does not appear here as well — a field owned by two tabs is a field
// that gets saved twice with different values.
//
// ── Where Save lives, and why not here ───────────────────────────────────
//
// A tab OWNS its draft but does NOT render its own Save. It hands `dirty`,
// `saving` and a `save` up to the pane toolbar via `useTabSave`, and the toolbar
// renders the one button for the whole surface.
//
// This tab used to render its own, on the reasoning that a pane-level Save would
// mean something different depending on which tab was showing. That reasoning
// was sound and still lost: it put the surface's primary action mid-panel, in
// open space between the status callout and the first form card, anchored to
// nothing — and it could not be found. The ambiguity it avoided was
// hypothetical; the one it created was immediate.
//
// Scope is now carried by the DIRTY DOT on the tab strip rather than by
// placement, which communicates it better than placement ever could: a dot on
// Pricing says Pricing has unsaved work while you are standing on Media. The
// pane-level leave guard also moved to the shell, since it covers all six tabs
// at once. Full contract and rules in product-tab-save.tsx.

import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Switch,
  TagInput,
  Text,
  Textarea,
  Input,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { faBox, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useActivePropertyId } from '../../lib/api/shell-data';
import { afterPaneChange } from '../../lib/defer';
import { useTabSave } from './product-tab-save';
import { ProductFilingSections } from './product-filing';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useSites } from '../sites/data';
import {
  productErrorMessage,
  slugifyHandle,
  useArchiveProduct,
  useDeleteProduct,
  useProductFacets,
  useUpdateProduct,
  type Product,
  type ProductPatch,
} from './products-data';

/** Everything this tab holds, so "has anything changed" is one comparison
 *  rather than eight, and Save sends only what actually moved. */
interface Draft {
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  /** Empty means every site — the platform's own default. */
  propertyIds: string[];
  categoryIds: string[];
  /**
   * ONLY the collections a person picked.
   *
   * The product record also reports the ones a collection's RULE matched, and
   * they are deliberately not in the draft: the save writes this array as the
   * complete hand-picked set, so including a rule membership would re-save it
   * as a manual pin and freeze the product into a smart collection for good.
   * See product-filing.tsx.
   */
  manualCollectionIds: string[];
}

function toDraft(product: Product): Draft {
  return {
    title: product.title,
    handle: product.handle,
    description: product.description ?? '',
    vendor: product.vendor ?? '',
    productType: product.productType ?? '',
    tags: product.tags,
    propertyIds: product.propertyIds,
    categoryIds: product.categoryIds,
    manualCollectionIds: product.collectionMemberships
      .filter((membership) => membership.addedBy === 'manual')
      .map((membership) => membership.collectionId),
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Order-insensitive, for the two fields where order carries no meaning a
 *  person can see. Ticking a category, unticking it and ticking it again ends
 *  up in a different array order than it started in — comparing positionally
 *  would leave the pane claiming unsaved work over a choice that did not
 *  change, and the dirty dot is only worth anything while it is honest. */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(b);
  return a.every((value) => seen.has(value));
}

/** Only what moved. Sending the whole form back would rewrite fields nobody
 *  touched, and `null` vs `""` is the difference between "cleared" and "blank
 *  string" on every nullable column here. */
function buildPatch(draft: Draft, saved: Draft): ProductPatch {
  const patch: ProductPatch = {};
  if (draft.title !== saved.title) patch.title = draft.title.trim();
  if (draft.handle !== saved.handle) patch.handle = draft.handle;
  if (draft.description !== saved.description) {
    patch.description = draft.description.trim() === '' ? null : draft.description;
  }
  if (draft.vendor !== saved.vendor) {
    patch.vendor = draft.vendor.trim() === '' ? null : draft.vendor.trim();
  }
  if (draft.productType !== saved.productType) {
    patch.productType = draft.productType.trim() === '' ? null : draft.productType.trim();
  }
  if (!sameList(draft.tags, saved.tags)) patch.tags = draft.tags;
  if (!sameList(draft.propertyIds, saved.propertyIds)) patch.propertyIds = draft.propertyIds;
  if (!sameSet(draft.categoryIds, saved.categoryIds)) patch.categoryIds = draft.categoryIds;
  // `collectionIds` on the wire means "the complete HAND-PICKED set" — the
  // server replaces only the manual rows and leaves rule-driven membership to
  // the indexer. Sending the draft's manual list is therefore exactly right,
  // and sending anything wider would convert a rule match into a permanent pin.
  if (!sameSet(draft.manualCollectionIds, saved.manualCollectionIds)) {
    patch.collectionIds = draft.manualCollectionIds;
  }
  return patch;
}

export function ProductOverviewTab({ ctx, product }: { ctx: SurfaceContext; product: Product }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: facets } = useProductFacets();
  const { data: sites } = useSites();
  const activeSiteId = useActivePropertyId();

  const update = useUpdateProduct(product.id);
  const archive = useArchiveProduct(product.id);
  const remove = useDeleteProduct(product.id);

  const saved = useMemo(() => toDraft(product), [product]);
  const [draft, setDraft] = useState<Draft>(saved);
  // Track the server's copy when it changes underneath a CLEAN form — a refetch
  // after someone else edited must land. A dirty form is never overwritten.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  const patch = buildPatch(draft, saved);
  const dirty = Object.keys(patch).length > 0;

  const retired = product.status === 'archived';

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  // Handed to the toolbar, which owns the button and reports the outcome. This
  // REJECTS on failure rather than catching: the toolbar is what claimed the
  // save, so it has to be the thing that finds out it did not happen. Swallowing
  // the error here would leave the toolbar announcing a write that failed.
  useTabSave({
    dirty,
    saving: update.isPending,
    save: async () => {
      const next = await update.mutateAsync(patch);
      setTouched(false);
      setDraft(toDraft(next));
    },
  });

  const toggleRetired = async () => {
    if (!retired) {
      const ok = await confirm({
        title: `Retire ${product.title}?`,
        description:
          'It comes off your website and out of your working catalog, but nothing is deleted — past orders keep their record of it and you can bring it back at any time.',
        confirmLabel: 'Retire it',
        cancelLabel: 'Keep it',
        color: 'warning',
      });
      if (!ok) return;
    }
    archive.mutate(!retired, {
      onSuccess: () => {
        toast.add({
          title: retired ? `${product.title} is back` : `${product.title} retired`,
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not change that',
          description: productErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${product.title}?`,
      description:
        'Its price, codes, description and every version of it go with it, and it disappears from your website immediately. Orders that already contain it keep their record of what was bought. This cannot be undone — retire it instead if you might sell it again.',
      confirmLabel: 'Delete this product',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${product.title} deleted`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete this product',
          description: productErrorMessage(error, 'Nothing was removed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormSection title="What you are selling">
        <Field>
          <FieldLabel>Name</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={draft.title}
                onChange={(event) => {
                  set('title', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>What shoppers see.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Description</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={6}
                value={draft.description}
                placeholder="What it is, what it is made of, who it is for."
                onChange={(event) => {
                  set('description', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            Shown on the product&apos;s page. Say what someone would ask you in person.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Web address</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={draft.handle}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  set('handle', slugifyHandle(event.target.value));
                }}
              />
            }
          />
          <FieldDescription>
            The end of this product&apos;s page address. Changing it breaks any link anyone has
            already saved or shared, so it is worth leaving alone once the product is on sale.
          </FieldDescription>
        </Field>
      </FormSection>

      <FormSection
        title="How you file it"
        description="None of this is required. It is what lets you find things later, and what shoppers use to browse."
      >
        <Field>
          <FieldLabel>Brand</FieldLabel>
          <FieldControl
            render={
              <Autocomplete
                color="module"
                items={facets?.vendors ?? []}
                value={draft.vendor}
                placeholder="Who makes it"
                emptyMessage="No match — type your own."
                aria-label="Brand"
                onValueChange={(next) => {
                  set('vendor', next);
                }}
              />
            }
          />
          <FieldDescription>
            Who makes or supplies it. Type anything — the suggestions are just the ones you have
            used before.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Kind of thing</FieldLabel>
          <FieldControl
            render={
              <Autocomplete
                color="module"
                items={facets?.productTypes ?? []}
                value={draft.productType}
                placeholder="Footwear, Furniture, Service…"
                emptyMessage="No match — type your own."
                aria-label="Kind of thing"
                onValueChange={(next) => {
                  set('productType', next);
                }}
              />
            }
          />
          <FieldDescription>
            A broad category for this product. Type your own if none of the suggestions fit.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Labels</FieldLabel>
          <FieldControl
            render={
              <TagInput
                color="module"
                value={draft.tags}
                placeholder="Type a label and press Enter"
                aria-label="Labels"
                onValueChange={(next) => {
                  set('tags', next);
                }}
              />
            }
          />
          <FieldDescription>
            Your own words for grouping products — “summer”, “clearance”, “gift”. Only you see these
            unless you use them on your website.
          </FieldDescription>
        </Field>
      </FormSection>

      {/* Directly after "How you file it" because it is the same act continued:
          that section is the words YOU use to find things later, this one is the
          groups SHOPPERS browse. Both are filing; only one of them is public,
          which is why they are two sections and not one. */}
      <ProductFilingSections
        ctx={ctx}
        categoryIds={draft.categoryIds}
        manualCollectionIds={draft.manualCollectionIds}
        memberships={product.collectionMemberships}
        onCategoriesChange={(next) => {
          set('categoryIds', next);
        }}
        onCollectionsChange={(next) => {
          set('manualCollectionIds', next);
        }}
      />

      {/* Only worth a section when there is genuinely a choice to make. On a
          single-site account this would be a control with one option. */}
      {(sites ?? []).length > 1 ? (
        <FormSection
          title="Which of your sites show it"
          description="You run more than one website, so a product can belong to all of them or to just some."
        >
          <Field>
            <FieldLabel>Show it on every site</FieldLabel>
            <FieldControl
              render={
                <Switch
                  color="module"
                  checked={draft.propertyIds.length === 0}
                  onCheckedChange={(next: boolean) => {
                    // Empty IS "everywhere" in the stored model. Turning the
                    // switch off has to seed something, or the product would
                    // silently stay everywhere while the UI showed otherwise —
                    // so it seeds the site being worked in.
                    set('propertyIds', next ? [] : [activeSiteId ?? (sites ?? [])[0]?.id ?? '']);
                  }}
                />
              }
            />
            <FieldDescription>Turn this off to choose the sites it appears on.</FieldDescription>
          </Field>

          {draft.propertyIds.length === 0 ? null : (
            <div className="flex flex-col gap-2">
              {(sites ?? []).map((site) => (
                <label key={site.id} className="flex items-center gap-2">
                  <Checkbox
                    color="module"
                    checked={draft.propertyIds.includes(site.id)}
                    aria-label={site.name}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...draft.propertyIds, site.id]
                        : draft.propertyIds.filter((value) => value !== site.id);
                      // Unticking the last one would mean "everywhere", which is
                      // the opposite of what the person just did.
                      set('propertyIds', next.length === 0 ? draft.propertyIds : next);
                    }}
                  />
                  <Text as="span">{site.name}</Text>
                </label>
              ))}
            </div>
          )}
        </FormSection>
      ) : null}

      {/* Retiring and deleting are both RARE and one of them is permanent. As
          full cards beside the description they would carry the same weight as
          the work someone came here to do, which is how a destructive button
          becomes something you click by habit. */}
      <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text className="text-sm">
            {retired
              ? 'This product is retired. Bringing it back puts it in your working catalog again — it stays off sale until you say otherwise.'
              : 'Retiring takes it off your website and out of your working catalog without deleting anything. You can bring it back at any time.'}
          </Text>
          <Button
            size="sm"
            variant="outline"
            color={retired ? 'module' : 'neutral'}
            loading={archive.isPending}
            onClick={() => {
              void toggleRetired();
            }}
          >
            <Icon glyph={faBox} className="size-4" aria-hidden />
            {retired ? 'Bring it back' : 'Retire it'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text className="text-sm">
            Deleting removes this product and every version of it for good. Past orders keep their
            record of what was bought.
          </Text>
          <Button
            size="sm"
            variant="outline"
            color="danger"
            loading={remove.isPending}
            onClick={() => {
              void onDelete();
            }}
          >
            <Icon glyph={faTrashCan} className="size-4" aria-hidden />
            Delete this product
          </Button>
        </div>
      </div>
    </div>
  );
}
