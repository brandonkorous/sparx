'use client';

// The Variants tab — the versions you actually sell, and what each one costs.
//
// A variant is one sellable thing: a price, a code, a barcode, a weight. On a
// product with no choices there is exactly one of them and that is the whole
// story. On a product WITH choices the set is DERIVED from the lattice on the
// Options tab — every combination of choices is a slot, and a slot either has a
// version on sale in it, has a stopped one waiting to come back, or is genuinely
// empty. Those are three different offers, and reading the middle one as the
// third is what put stockless "-2" codes on sale beside the real ones (issue 305).
//
// ── Why there is no "add a version" button ───────────────────────────────
//
// On a product with choices, a loose variant with no coordinate is corrupt: the
// storefront cannot offer it, because there is no combination of choices that
// selects it. The server enforces this — `POST /variants` rejects a variant that
// does not span every option exactly once.
//
// So this tab never offers "add a version". It shows the grid, and an empty slot
// carries its own "set a price" affordance in place. Extending the grid means
// adding a value on Options, and that reads as an obvious consequence of where
// things live rather than as a greyed-out button with a paragraph of apology
// next to it. The only screen that says the words is the one place someone might
// go looking: a line under the grid pointing at the Options tab.
//
// ── One Save, and it lives in the pane toolbar ───────────────────────────
//
// Every edit lands in a draft held HERE, keyed by variant id, and one save
// commits every version that changed. That is deliberate: repricing a size run
// is one job, and a Save button per row turns it into eleven. Collapsing a row
// keeps its draft, so nothing is lost by tidying the screen, and a row with
// unsaved work says so on its own header.
//
// That save is handed UP through `useTabSave` — this tab renders no Save button
// of its own, and the toolbar's one reports the failure. See
// product-tab-save.tsx. Retiring a version, restoring one and choosing which is
// shown first are NOT saves: they are their own actions with their own confirms,
// they commit immediately, and they never ride on the toolbar button.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Heading,
  Input,
  Select,
  Switch,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { ChevronDown, ChevronRight, Plus, Undo2, X } from 'lucide-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useTabSave } from './product-tab-save';
import { FormSection } from '../../components/form-section';
import { MoneyInput } from '@/components/money-input';
import {
  gridOf,
  skuStem,
  slotLabel,
  slotsOf,
  suggestSlotSku,
  type Slot,
} from './product-variant-slots';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { SaveFailure } from '@/components/save-failure';
import { PreorderOfferNote } from '../inventory/preorder-offer-note';
import {
  formatCents,
  productErrorMessage,
  useArchiveVariant,
  useAssignVariantOptions,
  useCreateVariant,
  useProductOptions,
  useProductVariants,
  useRestoreVariant,
  useSetDefaultVariant,
  useUpdateVariant,
  type Product,
  type ProductOption,
  type Variant,
  type VariantPatch,
} from './products-data';

/* ── The draft ──────────────────────────────────────────────────────────── */

interface VariantDraft {
  sku: string;
  barcode: string;
  /** In whole currency units — what the operator types. Cents on the wire. */
  price: number;
  compareAt: number | null;
  cost: number | null;
  /** The refundable core deposit on a rebuilt part; null = no core. */
  core: number | null;
  /** Buyers may send the old part first instead of paying the deposit. */
  coreFirst: boolean;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  inventoryPolicy: string;
  requiresShipping: boolean;
  /** null means "whatever the product says". */
  fulfillmentType: string | null;
}

function toDraft(variant: Variant): VariantDraft {
  return {
    sku: variant.sku,
    barcode: variant.barcode ?? '',
    price: variant.priceCents / 100,
    compareAt: variant.compareAtPriceCents === null ? null : variant.compareAtPriceCents / 100,
    cost: variant.costCents === null ? null : variant.costCents / 100,
    core: variant.coreChargeCents === null ? null : variant.coreChargeCents / 100,
    coreFirst: variant.coreFirstOffered,
    weightGrams: variant.weightGrams,
    lengthMm: variant.lengthMm,
    widthMm: variant.widthMm,
    heightMm: variant.heightMm,
    inventoryPolicy: variant.inventoryPolicy,
    requiresShipping: variant.requiresShipping,
    fulfillmentType: variant.fulfillmentType,
  };
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function offersCoreFirst(draft: VariantDraft): boolean {
  return draft.coreFirst && draft.core !== null && cents(draft.core) > 0;
}

/** Only what moved. Sending the whole row back would rewrite fields nobody
 *  touched, and on a nullable column `undefined` and `null` are the difference
 *  between "leave it alone" and "clear it". */
function buildPatch(draft: VariantDraft, saved: VariantDraft): VariantPatch {
  const patch: VariantPatch = {};
  if (draft.price !== saved.price) patch.priceCents = cents(draft.price);
  if (draft.compareAt !== saved.compareAt) {
    patch.compareAtPriceCents = draft.compareAt === null ? null : cents(draft.compareAt);
  }
  if (draft.cost !== saved.cost) {
    patch.costCents = draft.cost === null ? null : cents(draft.cost);
  }
  if (draft.core !== saved.core) {
    // A deposit of nothing is no deposit: the server keeps one spelling of it.
    patch.coreChargeCents =
      draft.core === null || cents(draft.core) <= 0 ? null : cents(draft.core);
  }
  // The switch only means something beside a deposit. Clearing the deposit takes
  // the offer with it (the server does the same), and the switch's own position is
  // kept in the draft so typing the deposit back in brings it back.
  if (offersCoreFirst(draft) !== offersCoreFirst(saved)) {
    patch.coreFirstOffered = offersCoreFirst(draft);
  }
  if (draft.barcode.trim() !== saved.barcode.trim()) {
    patch.barcode = draft.barcode.trim() === '' ? null : draft.barcode.trim();
  }
  if (draft.weightGrams !== saved.weightGrams) patch.weight = draft.weightGrams;
  if (
    draft.lengthMm !== saved.lengthMm ||
    draft.widthMm !== saved.widthMm ||
    draft.heightMm !== saved.heightMm
  ) {
    patch.dimensions =
      draft.lengthMm && draft.widthMm && draft.heightMm
        ? { lengthMm: draft.lengthMm, widthMm: draft.widthMm, heightMm: draft.heightMm }
        : null;
  }
  if (draft.inventoryPolicy !== saved.inventoryPolicy)
    patch.inventoryPolicy = draft.inventoryPolicy;
  if (draft.requiresShipping !== saved.requiresShipping) {
    patch.requiresShipping = draft.requiresShipping;
  }
  if (draft.fulfillmentType !== saved.fulfillmentType)
    patch.fulfillmentType = draft.fulfillmentType;
  return patch;
}

function changed(draft: VariantDraft, saved: VariantDraft): boolean {
  return draft.sku.trim() !== saved.sku || Object.keys(buildPatch(draft, saved)).length > 0;
}

/** All three measurements or none — the server rejects a partial set, and
 *  half a parcel size is not a measurement of anything. */
function dimensionProblem(draft: VariantDraft): string | null {
  const given = [draft.lengthMm, draft.widthMm, draft.heightMm].filter(
    (value) => value !== null && value > 0
  ).length;
  if (given === 0 || given === 3) return null;
  return 'Give all three measurements, or leave all three blank.';
}

/** Codes are unique across the whole business, and the server says so with a
 *  clear conflict — but a clash WITHIN this one save is worth catching before
 *  half the rows are written. */
function draftProblem(draft: VariantDraft): string | null {
  if (draft.sku.trim() === '') return 'Give this version a code.';
  if (!/^[A-Za-z0-9._\-/]+$/.test(draft.sku.trim())) {
    return 'A code can use letters, digits, dots, dashes, underscores and slashes: no spaces.';
  }
  if (draft.barcode.trim() !== '' && !/^[0-9]{8,14}$/.test(draft.barcode.trim())) {
    return 'A barcode is 8 to 14 digits, with nothing else in it.';
  }
  return dimensionProblem(draft);
}

/* ── The tab ────────────────────────────────────────────────────────────── */

export function ProductVariantsTab({ product }: { ctx: SurfaceContext; product: Product }) {
  const toast = useToast();
  const confirm = useConfirm();

  const options = useProductOptions(product.id);
  // Retired versions come back too: they still hold their code against the
  // business-wide unique index, so "that code already exists" is otherwise
  // caused by a row the operator has no way to see.
  const variants = useProductVariants(product.id, true);

  const update = useUpdateVariant(product.id);
  const create = useCreateVariant(product.id);
  const archive = useArchiveVariant(product.id);
  const restore = useRestoreVariant(product.id);
  const setDefault = useSetDefaultVariant(product.id);
  const assign = useAssignVariantOptions(product.id);

  const all = useMemo(() => variants.data ?? [], [variants.data]);
  const live = useMemo(() => all.filter((variant) => variant.deletedAt === null), [all]);
  const retired = useMemo(() => all.filter((variant) => variant.deletedAt !== null), [all]);
  const axes = useMemo(() => options.data ?? [], [options.data]);
  const slots = useMemo(() => slotsOf(axes, live, retired), [axes, live, retired]);

  /** The code this product already carries, and every code it already holds.
   *  Both are needed wherever a new version is offered a code, and both are
   *  worked out ONCE here: three places offer one, and a stem derived three
   *  times is a stem that drifts (issue 172). */
  const stem = useMemo(() => skuStem(product, slots, live), [product, slots, live]);
  const taken = useMemo(() => new Set(all.map((variant) => variant.sku.toLowerCase())), [all]);

  const saved = useMemo(() => {
    const map: Record<string, VariantDraft> = {};
    for (const variant of live) map[variant.id] = toDraft(variant);
    return map;
  }, [live]);

  const [drafts, setDrafts] = useState<Record<string, VariantDraft>>(saved);
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [open, setOpen] = useState<Record<string, true>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  // Adopt the server's copy for every row the operator has NOT edited, so a
  // refetch lands without stepping on unsaved work in the row beside it.
  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, VariantDraft> = {};
      for (const [id, row] of Object.entries(saved)) {
        next[id] = touched[id] && current[id] ? current[id] : row;
      }
      return next;
    });
  }, [saved, touched]);

  /** Every row that moved, paired with what the server currently holds. */
  const pending = Object.entries(saved).flatMap(([id, before]) => {
    const draft = drafts[id];
    return draft && changed(draft, before) ? [{ id, draft, before }] : [];
  });
  const problems = pending.flatMap((entry) => {
    const message = draftProblem(entry.draft);
    return message ? [{ id: entry.id, message }] : [];
  });

  useDirtySource(
    pending.length > 0,
    'Some versions of this product have unsaved prices on the Variants tab. Close anyway?'
  );

  const setDraft = (id: string, change: Partial<VariantDraft>) => {
    setTouched((current) => ({ ...current, [id]: true }));
    setDrafts((current) => {
      const row = current[id];
      if (!row) return current;
      return { ...current, [id]: { ...row, ...change } };
    });
  };

  // Handed UP to the pane toolbar — this tab renders no Save of its own. It
  // THROWS on failure: the toolbar is what reports, and a tab that swallowed its
  // own error would leave the toolbar claiming a write that never happened.
  useTabSave({
    dirty: pending.length > 0,
    saving: update.isPending,
    save: async () => {
      if (pending.length === 0) return;
      // Refused rather than half-written. With a bad code somewhere in the set,
      // writing the rows either side of it and stopping is the worse outcome.
      if (problems.length > 0) {
        const first = problems[0];
        setSaveError(first?.message ?? null);
        throw new Error('Some versions still need fixing before they can be saved.');
      }
      setSaveError(null);
      // Sequential on purpose: a code clash has to stop the run and name itself,
      // rather than arriving as one of eleven simultaneous rejections.
      for (const { id, draft, before } of pending) {
        try {
          await update.mutateAsync({
            id,
            ...(draft.sku.trim() !== before.sku ? { sku: draft.sku.trim() } : {}),
            patch: buildPatch(draft, before),
          });
          setTouched((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
        } catch (error) {
          setSaveError(
            productErrorMessage(
              error,
              `Could not save ${draft.sku.trim()}. Nothing about that version was changed.`
            )
          );
          throw error;
        }
      }
      toast.add({
        title: pending.length === 1 ? 'Version saved' : `${String(pending.length)} versions saved`,
        type: 'success',
      });
    },
  });

  const onRetire = async (variant: Variant) => {
    const ok = await confirm({
      title: `Stop selling ${variant.sku}?`,
      description: `This version comes off your website immediately and nobody can buy it. Its price of ${formatCents(variant.priceCents, variant.currency)} and its code are kept, orders that already contain it are unaffected, and you can bring it back at any time. Its code stays reserved while it is retired, so you cannot give the same code to something else.`,
      confirmLabel: 'Stop selling it',
      cancelLabel: 'Keep selling it',
      color: 'warning',
    });
    if (!ok) return;
    archive.mutate(variant.id, {
      onSuccess: () => {
        toast.add({ title: `${variant.sku} is no longer sold`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not retire that version',
          description: productErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  /** Only ever handed combinations that have never held a version AND whose code
   *  no placeless version of this product already carries. A square with a
   *  stopped version in it is brought back in place, and a square whose version
   *  lost its place is offered that version; creating a new one on top of either
   *  is what minted the "-2" codes (issue 305). */
  const fillTheRest = async (empty: Slot[]) => {
    const price = live.find((variant) => variant.isDefault)?.priceCents ?? product.priceMinCents;
    if (price === null) {
      toast.add({
        title: 'There is no price to copy',
        description: 'Set a price on one combination first, then this can copy it to the rest.',
        type: 'warning',
      });
      return;
    }
    const ok = await confirm({
      title: `Give the other ${String(empty.length)} combinations a price?`,
      description: `Each one is created at ${formatCents(price)} with a code made from its choices, ready for you to change. Nothing goes on sale that was not already on sale.`,
      confirmLabel: 'Create them',
      cancelLabel: 'Not now',
      color: 'primary',
    });
    if (!ok) return;

    const claimed = new Set(taken);
    let made = 0;
    for (const slot of empty) {
      const sku = suggestSlotSku(stem, slot, claimed);
      claimed.add(sku.toLowerCase());
      try {
        await create.mutateAsync({
          sku,
          priceCents: price,
          optionValueIds: slot.coordinate.map((point) => point.valueId),
        });
        made += 1;
      } catch (error) {
        toast.add({
          title:
            made === 0
              ? 'Could not create those versions'
              : `Created ${String(made)}, then stopped`,
          description: productErrorMessage(error, `${slotLabel(slot)} could not be created.`),
          type: 'error',
        });
        return;
      }
    }
    toast.add({ title: `${String(made)} combinations now have a price`, type: 'success' });
  };

  const onRestore = (variant: Variant) => {
    restore.mutate(variant.id, {
      onSuccess: () => {
        toast.add({ title: `${variant.sku} is on sale again`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not bring that back',
          description: productErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  /** Gives a version that belongs to no combination one to belong to. Works on a
   *  stopped version as well as one on sale: where it sits and whether it is
   *  being sold are two different facts, and the server keeps them apart
   *  (`assignOptionValues` in variant-service.ts, issue 306). */
  const onPlace = (variant: Variant, slot: Slot) => {
    assign.mutate(
      {
        variantId: variant.id,
        optionValueIds: slot.coordinate.map((point) => point.valueId),
      },
      {
        onSuccess: () => {
          toast.add({
            title: `${variant.sku} is now ${slotLabel(slot)}`,
            description:
              variant.deletedAt === null
                ? 'Shoppers can reach it again.'
                : 'It is back in the grid, ready to sell again whenever you want it.',
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not put that version in the grid',
            description: productErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const failed = options.isError || variants.isError;
  if (failed) {
    // A failed load REPLACES the grid. An empty table beside a dead Save invites
    // someone to type a price into nothing.
    return (
      <Alert color="error">
        <AlertContent>
          <AlertTitle>Could not load this product&apos;s prices</AlertTitle>
          <AlertDescription>
            This is a problem reaching the server. Nothing about the product has changed. Its
            versions just could not be read just now.
          </AlertDescription>
        </AlertContent>
        <Button
          size="sm"
          color="error"
          variant="soft"
          onClick={() => {
            void options.refetch();
            void variants.refetch();
          }}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  if (options.isPending || variants.isPending) {
    return (
      <p role="status" className="p-4">
        Loading…
      </p>
    );
  }

  const { stranded, homeless, resting, empty, claimants, fillable, free } = gridOf(
    slots,
    axes.length > 0,
    live,
    retired,
    stem
  );
  // On a product with no choices there is one square, with no coordinate, and a
  // stopped version on it is that product's only way back onto the website.
  const soleSlot = axes.length === 0 ? (slots[0] ?? null) : null;
  const soleRetired = soleSlot && live.length === 0 ? soleSlot.retired : [];
  const placingId = assign.isPending ? (assign.variables?.variantId ?? null) : null;

  const rowProps = {
    drafts,
    saved,
    open,
    onToggle: (id: string) => {
      setOpen((current) => {
        const next = { ...current };
        if (next[id]) delete next[id];
        else next[id] = true;
        return next;
      });
    },
    onChange: setDraft,
    onRetire: (variant: Variant) => {
      void onRetire(variant);
    },
    onMakeDefault: (variant: Variant) => {
      setDefault.mutate(variant.id, {
        onSuccess: () => {
          toast.add({ title: `${variant.sku} is now the one shown first`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not change that',
            description: productErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      });
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* No Save here — the pane toolbar owns it, and the tab strip's dot says
          which tab the unsaved work is on. See product-tab-save.tsx.
          No Refresh either: this is a tab BODY, not a list pane. The surface's
          toolbar is the pane toolbar, a lone refresh icon floating above the
          first card is anchored to nothing, and both failure states below
          already carry their own "Try again". */}
      {pending.length > 0 ? (
        <Text>
          {pending.length === 1
            ? '1 version has unsaved changes.'
            : `${String(pending.length)} versions have unsaved changes.`}
        </Text>
      ) : null}

      {/* ONE message, the most specific one — the server's own sentence names the
          exact code that clashed, which no generic banner could. */}
      <SaveFailure title="That version was not saved" message={saveError} />

      {live.length === 0 && retired.length === 0 ? (
        <NoPriceYet axes={axes} slots={slots} stem={stem} onCreated={create} />
      ) : null}

      {axes.length === 0 ? (
        live.length > 0 ? (
          <FormSection
            title="How this product is sold"
            description="There is one version of this product. Shoppers do not choose anything. They just buy it."
          >
            {live.map((variant) => (
              <VariantRow key={variant.id} variant={variant} label={variant.sku} {...rowProps} />
            ))}
          </FormSection>
        ) : soleSlot && soleRetired.length > 0 ? (
          <FormSection
            title="Nobody can buy this right now"
            description="You stopped selling this product's only version. Its price, code and stock are all kept. Sell it again and it is back exactly as it was, at the price it had."
          >
            <RetiredSlotRows
              slot={soleSlot}
              label={(variant) => variant.sku}
              busy={restore.isPending}
              onRestore={onRestore}
            />
          </FormSection>
        ) : null
      ) : (
        <GroupedGrid
          slots={slots}
          axes={axes}
          rowProps={rowProps}
          stem={stem}
          taken={taken}
          create={create}
          restoring={restore.isPending}
          onRestore={onRestore}
          claimants={claimants}
          placingId={placingId}
          onPlace={onPlace}
        />
      )}

      <FindAPlace
        stranded={stranded}
        homeless={homeless}
        free={free}
        claimants={claimants}
        placingId={placingId}
        onPlace={onPlace}
      />

      {axes.length > 0 && empty.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text className="min-w-0 flex-1">
            {empty.length === 1
              ? '1 combination has no price, so nobody can buy it.'
              : `${String(empty.length)} combinations have no price, so nobody can buy them.`}
            {claimants.size > 0
              ? ` ${claimants.size === 1 ? 'One of them already has a version' : `${String(claimants.size)} of them already have a version`} carrying its code, so put that back instead of making a new one.`
              : ''}
          </Text>
          {fillable.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              color="module"
              loading={create.isPending}
              onClick={() => {
                void fillTheRest(fillable);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {fillable.length === empty.length
                ? 'Give them all the same price'
                : `Give the other ${String(fillable.length)} the same price`}
            </Button>
          ) : null}
        </div>
      ) : null}

      <RestingSection resting={resting} hasChoices={axes.length > 0} />

      {axes.length > 0 ? (
        // The one place the constraint is spelled out, for whoever goes looking
        // for an "add a version" button that is deliberately not here.
        <Text>
          Every version above comes from the choices on the Options tab. To sell another one, add
          what a shopper can pick there and it appears here ready to price.
        </Text>
      ) : (
        <Text>
          Selling this in more than one size, color or length? Set those choices up on the Options
          tab and each combination gets its own price here.
        </Text>
      )}
    </div>
  );
}

/* ── A product that cannot be bought at all ─────────────────────────────── */

function NoPriceYet({
  axes,
  slots,
  stem,
  onCreated,
}: {
  axes: ProductOption[];
  slots: Slot[];
  /** The code this product already carries. On a product with no version at all
   *  — which is the only way this section is reached — `skuStem` falls back to
   *  the product's web address, so the offer is the same one it always was. */
  stem: string;
  onCreated: ReturnType<typeof useCreateVariant>;
}) {
  const toast = useToast();
  const [sku, setSku] = useState(() =>
    axes.length > 0 && slots[0] ? suggestSlotSku(stem, slots[0], new Set()) : stem
  );
  const [price, setPrice] = useState(0);

  const slot = slots[0] ?? null;
  const problem = sku.trim() === '' ? 'Give this version a code.' : null;

  return (
    <FormSection
      title="This product has no price"
      description="Nobody can buy it until it has one. This normally means something went wrong while it was being added."
    >
      <Field>
        <FieldLabel>Price</FieldLabel>
        <FieldControl
          render={
            <MoneyInput color="module" value={price} aria-label="Price" onValueChange={setPrice} />
          }
        />
        <FieldDescription>What a shopper pays. You can change it any time.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Product code</FieldLabel>
        <FieldControl
          render={
            <Input
              color={problem ? 'error' : 'module'}
              value={sku}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => {
                setSku(event.target.value);
              }}
            />
          }
        />
        {problem ? (
          <FieldStatus status="error">{problem}</FieldStatus>
        ) : (
          <FieldDescription>
            Your own reference for this version: on labels, on invoices, in your records.
          </FieldDescription>
        )}
      </Field>
      <div className="flex justify-end">
        <Button
          size="sm"
          color="module"
          disabled={problem !== null}
          loading={onCreated.isPending}
          onClick={() => {
            onCreated.mutate(
              {
                sku: sku.trim(),
                priceCents: cents(price),
                isDefault: true,
                ...(slot ? { optionValueIds: slot.coordinate.map((point) => point.valueId) } : {}),
              },
              {
                onSuccess: () => {
                  toast.add({ title: 'This product can be bought now', type: 'success' });
                },
                onError: (error) => {
                  toast.add({
                    title: 'Could not set a price',
                    description: productErrorMessage(error, 'Nothing was created.'),
                    type: 'error',
                  });
                },
              }
            );
          }}
        >
          Set this price
        </Button>
      </div>
    </FormSection>
  );
}

/* ── The grid, grouped by the first choice ──────────────────────────────── */

interface RowProps {
  drafts: Record<string, VariantDraft>;
  saved: Record<string, VariantDraft>;
  open: Record<string, true>;
  onToggle: (id: string) => void;
  onChange: (id: string, change: Partial<VariantDraft>) => void;
  onRetire: (variant: Variant) => void;
  onMakeDefault: (variant: Variant) => void;
}

/**
 * A card per value of the FIRST choice, a row per combination inside it.
 *
 * Not a table: a grouped table repeats its header row per group, and a
 * one-line thing with a price on it does not need columns invented to justify
 * them. The card heading carries "Red" once and the rows underneath carry the
 * rest of the coordinate — which is also the only shape that survives a pane
 * docked at 320px.
 */
function GroupedGrid({
  slots,
  axes,
  rowProps,
  stem,
  taken,
  create,
  restoring,
  onRestore,
  claimants,
  placingId,
  onPlace,
}: {
  slots: Slot[];
  axes: ProductOption[];
  rowProps: RowProps;
  /** The code this product already carries, and every code it already holds —
   *  both worked out once by the tab (issue 172). */
  stem: string;
  taken: Set<string>;
  create: ReturnType<typeof useCreateVariant>;
  restoring: boolean;
  onRestore: (variant: Variant) => void;
  /** Empty squares whose own code a placeless version already carries, by slot
   *  key. See `claimantOf`. */
  claimants: Map<string, Variant>;
  placingId: string | null;
  onPlace: (variant: Variant, slot: Slot) => void;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<string, { title: string; slots: Slot[] }>();
    for (const slot of slots) {
      const head = slot.coordinate[0];
      const grouping = axes.length > 1 && head !== undefined;
      const key = grouping ? head.valueId : 'all';
      const title = grouping ? `${head.optionName}: ${head.valueText}` : 'Every version';
      const bucket = groups.get(key) ?? { title, slots: [] };
      bucket.slots.push(slot);
      groups.set(key, bucket);
    }
    return [...groups.values()];
  }, [slots, axes]);

  return (
    <>
      {grouped.map((group) => (
        <FormSection key={group.title} title={group.title}>
          {group.slots.map((slot) => {
            if (slot.variant) {
              return (
                <VariantRow
                  key={slot.key}
                  variant={slot.variant}
                  label={slotLabel(slot)}
                  {...rowProps}
                />
              );
            }
            if (slot.retired.length > 0) {
              return (
                <RetiredSlotRows
                  key={slot.key}
                  slot={slot}
                  label={(variant) =>
                    slot.retired.length > 1
                      ? `${slotLabel(slot)} · ${variant.sku}`
                      : slotLabel(slot)
                  }
                  busy={restoring}
                  onRestore={onRestore}
                />
              );
            }
            const claimant = claimants.get(slot.key);
            if (claimant) {
              return (
                <ClaimedSlotRow
                  key={slot.key}
                  slot={slot}
                  claimant={claimant}
                  busy={placingId === claimant.id}
                  onPlace={onPlace}
                />
              );
            }
            return (
              <EmptySlotRow key={slot.key} slot={slot} stem={stem} taken={taken} create={create} />
            );
          })}
        </FormSection>
      ))}
    </>
  );
}

/* ── A combination whose versions were stopped ───────────────────────────── */

const SLOT_ROW = 'border-base-300 flex flex-wrap items-center gap-2 border-b pb-2 last:border-b-0';

/**
 * This combination is not empty. Its versions were stopped and still hold their
 * codes, prices and stock, so the offer is to bring one back, never to make a
 * new one on top of them.
 *
 * One row EACH when a square holds more than one, with the code in the label so
 * they can be told apart. Two stopped versions on one square is what repairing a
 * damaged shop produces, and offering only the first let array order pick which
 * price, code and stock she was handed (issue 306).
 */
function RetiredSlotRows({
  slot,
  label,
  busy,
  onRestore,
}: {
  slot: Slot;
  /** What each row is called. The caller decides, because a grid row is named
   *  by its combination and a product with no choices has none to name. */
  label: (variant: Variant) => string;
  busy: boolean;
  onRestore: (variant: Variant) => void;
}) {
  return (
    <>
      {slot.retired.map((variant) => (
        <div className={SLOT_ROW} key={variant.id}>
          {/* Never truncated: two versions on one square can differ only in a
              "-2" at the end of the code, and that is the difference between the
              one holding the stock and the one holding none. */}
          <Text className="min-w-0 flex-1 wrap-anywhere">{label(variant)}</Text>
          <Text as="span" className="tabular-nums">
            {formatCents(variant.priceCents, variant.currency)}
          </Text>
          <Badge variant="outline" size="sm">
            Not sold
          </Badge>
          <Button
            size="sm"
            variant="outline"
            color="module"
            loading={busy}
            onClick={() => {
              onRestore(variant);
            }}
          >
            <Undo2 className="size-4" aria-hidden />
            Sell it again
          </Button>
        </div>
      ))}
    </>
  );
}

/* ── A combination whose own version lost its place ─────────────────────── */

/**
 * Nothing sits in this square, but a version of this product that sits nowhere
 * carries the exact code this square would be given. That version is this
 * square's, holding its price and stock, so the one offer here is to put it
 * back. "Set a price" would pre-fill a "-2" code, and a new stockless version on
 * sale beside the real one is the defect this row exists to prevent (issue 305).
 */
function ClaimedSlotRow({
  slot,
  claimant,
  busy,
  onPlace,
}: {
  slot: Slot;
  claimant: Variant;
  busy: boolean;
  onPlace: (variant: Variant, slot: Slot) => void;
}) {
  return (
    <div className="border-base-300 flex flex-col gap-2 border-b pb-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Text className="min-w-0 flex-1">{slotLabel(slot)}</Text>
        <Badge color="warning" variant="soft" size="sm">
          Nothing on sale
        </Badge>
        <Button
          size="sm"
          color="module"
          loading={busy}
          onClick={() => {
            onPlace(claimant, slot);
          }}
        >
          Put it back here
        </Button>
      </div>
      <Text className="wrap-anywhere">
        {claimant.sku} carries this combination&apos;s code and its price of{' '}
        {formatCents(claimant.priceCents, claimant.currency)}, but has lost its place in the grid.
        Putting it back keeps its price, code and stock
        {claimant.deletedAt === null ? '.' : ', and you can then choose to sell it again.'}
      </Text>
    </div>
  );
}

/* ── A combination nobody can buy yet ───────────────────────────────────── */

function EmptySlotRow({
  slot,
  stem,
  taken,
  create,
}: {
  slot: Slot;
  /** The code this product already carries — see `skuStem`. */
  stem: string;
  /** Every code this product already holds, live or retired. Offering one that
   *  is taken pre-fills the field with a code the server will refuse. */
  taken: Set<string>;
  create: ReturnType<typeof useCreateVariant>;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState(0);

  if (!adding) {
    return (
      <div className={SLOT_ROW}>
        <Text className="min-w-0 flex-1">{slotLabel(slot)}</Text>
        <Badge color="warning" variant="soft" size="sm">
          No price
        </Badge>
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            setSku(suggestSlotSku(stem, slot, taken));
            setAdding(true);
          }}
        >
          Set a price
        </Button>
      </div>
    );
  }

  const problem = sku.trim() === '' ? 'Give this version a code.' : null;

  return (
    <div className="border-base-300 flex flex-col gap-3 border-b pb-3 last:border-b-0">
      <Heading level={3} className="text-base font-semibold">
        {slotLabel(slot)}
      </Heading>
      <div className="flex flex-col gap-3 @md:flex-row">
        <Field className="min-w-0 flex-1">
          <FieldLabel>Price</FieldLabel>
          <FieldControl
            render={
              <MoneyInput
                color="module"
                value={price}
                aria-label={`Price for ${slotLabel(slot)}`}
                onValueChange={setPrice}
              />
            }
          />
        </Field>
        <Field className="min-w-0 flex-1">
          <FieldLabel>Product code</FieldLabel>
          <FieldControl
            render={
              <Input
                color={problem ? 'error' : 'module'}
                size="sm"
                value={sku}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  setSku(event.target.value);
                }}
              />
            }
          />
          {problem ? <FieldStatus status="error">{problem}</FieldStatus> : null}
        </Field>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setAdding(false);
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          color="module"
          disabled={problem !== null}
          loading={create.isPending}
          onClick={() => {
            create.mutate(
              {
                sku: sku.trim(),
                priceCents: cents(price),
                optionValueIds: slot.coordinate.map((point) => point.valueId),
              },
              {
                onSuccess: () => {
                  setAdding(false);
                  toast.add({ title: `${slotLabel(slot)} can be bought now`, type: 'success' });
                },
                onError: (error) => {
                  toast.add({
                    title: 'Could not add that version',
                    description: productErrorMessage(error, 'Nothing was created.'),
                    type: 'error',
                  });
                },
              }
            );
          }}
        >
          Add it
        </Button>
      </div>
    </div>
  );
}

/* ── One sellable version ───────────────────────────────────────────────── */

const POLICY_ITEMS = [
  { value: 'deny', label: 'Stop selling it' },
  { value: 'continue', label: 'Keep selling it and owe it' },
  { value: 'preorder', label: 'Take pre-orders for it' },
];

const FULFILMENT_ITEMS = [
  { value: 'same', label: 'The same as the rest of the product' },
  { value: 'physical', label: 'Something you post or deliver' },
  { value: 'digital', label: 'A download' },
  { value: 'service', label: 'Work you do for them' },
];

function VariantRow({
  variant,
  label,
  drafts,
  saved,
  open,
  onToggle,
  onChange,
  onRetire,
  onMakeDefault,
}: RowProps & { variant: Variant; label: string }) {
  const draft = drafts[variant.id];
  const before = saved[variant.id];
  if (!draft || !before) return null;

  const isOpen = open[variant.id] === true;
  const isDirty = changed(draft, before);
  const problem = isDirty ? draftProblem(draft) : null;
  const panelId = `variant-panel-${variant.id}`;

  return (
    <div className="border-base-300 flex flex-col gap-3 border-b pb-3 last:border-b-0">
      {/* A real <button>, not a row with a click handler — this is the control
          that opens the editor, so it has to be one for the keyboard too. */}
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-2 text-left"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          onToggle(variant.id);
        }}
      >
        {isOpen ? (
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="tabular-nums">{formatCents(cents(draft.price), variant.currency)}</span>
        {draft.core !== null && draft.core > 0 ? (
          <span className="tabular-nums">
            + {formatCents(cents(draft.core), variant.currency)} core
            {offersCoreFirst(draft) ? ', or old part first' : ''}
          </span>
        ) : null}
        {variant.isDefault ? (
          <Badge color="info" variant="soft" size="sm">
            Shown first
          </Badge>
        ) : null}
        {isDirty ? (
          <Badge color="warning" variant="soft" size="sm">
            Unsaved
          </Badge>
        ) : null}
      </button>

      {isOpen ? (
        <div id={panelId} className="flex flex-col gap-4 pl-6">
          {variant.markupRuleId ? (
            <Alert color="info">
              <AlertContent>
                <AlertTitle>This price is worked out for you</AlertTitle>
                <AlertDescription>
                  It comes from a pricing rule based on what this costs you. Typing a price here
                  changes it now, but the rule will set it again next time your cost moves. Change
                  the rule on the Pricing tab to make it stick.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 @md:flex-row">
            <Field className="min-w-0 flex-1">
              <FieldLabel>Price</FieldLabel>
              <FieldControl
                render={
                  <MoneyInput
                    color="module"
                    value={draft.price}
                    aria-label={`Price for ${label}`}
                    onValueChange={(next) => {
                      onChange(variant.id, { price: next });
                    }}
                  />
                }
              />
              <FieldDescription>What a shopper pays for this version.</FieldDescription>
            </Field>

            <OptionalMoney
              label="Was"
              description="Shown crossed out beside the price, so a reduction is visible."
              value={draft.compareAt}
              addLabel="Add a was-price"
              onChange={(next) => {
                onChange(variant.id, { compareAt: next });
              }}
            />

            <OptionalMoney
              label="What it costs you"
              description="Only you see this. It is what your profit is worked out from."
              value={draft.cost}
              addLabel="Add your cost"
              onChange={(next) => {
                onChange(variant.id, { cost: next });
              }}
            />
          </div>

          <CoreDeposit
            variant={variant}
            label={label}
            draft={draft}
            onChange={(change) => {
              onChange(variant.id, change);
            }}
          />

          <div className="flex flex-col gap-3 @md:flex-row">
            <Field className="min-w-0 flex-1">
              <FieldLabel>Product code</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color={problem ? 'error' : 'module'}
                    size="sm"
                    value={draft.sku}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) => {
                      onChange(variant.id, { sku: event.target.value });
                    }}
                  />
                }
              />
              <FieldDescription>
                Your own reference for this version. It has to be different from every other code
                you use, including ones on retired versions.
              </FieldDescription>
            </Field>

            <Field className="min-w-0 flex-1">
              <FieldLabel>Barcode</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color={problem ? 'error' : 'module'}
                    size="sm"
                    value={draft.barcode}
                    placeholder="Optional"
                    spellCheck={false}
                    autoComplete="off"
                    inputMode="numeric"
                    onChange={(event) => {
                      onChange(variant.id, { barcode: event.target.value });
                    }}
                  />
                }
              />
              <FieldDescription>
                The number under the stripes on the packaging, if it has one.
              </FieldDescription>
            </Field>
          </div>

          {problem ? <FieldStatus status="error">{problem}</FieldStatus> : null}

          <Field>
            <FieldLabel>When you run out of this one</FieldLabel>
            <Select
              color="module"
              size="sm"
              items={POLICY_ITEMS}
              value={draft.inventoryPolicy}
              aria-label={`What happens when ${label} runs out`}
              onValueChange={(next) => {
                onChange(variant.id, { inventoryPolicy: next as string });
              }}
            />
            <FieldDescription>
              “Keep selling it and owe it” lets shoppers order something you have not got yet, and
              you send it when it arrives.
            </FieldDescription>
          </Field>
          {draft.inventoryPolicy === 'preorder' ? (
            <PreorderOfferNote variantId={variant.id} productId={variant.productId} />
          ) : null}

          <Field>
            <FieldLabel>What kind of thing this version is</FieldLabel>
            <Select
              color="module"
              size="sm"
              items={FULFILMENT_ITEMS}
              value={draft.fulfillmentType ?? 'same'}
              aria-label={`What kind of thing ${label} is`}
              onValueChange={(next) => {
                onChange(variant.id, {
                  fulfillmentType: next === 'same' ? null : (next as string),
                });
              }}
            />
            <FieldDescription>
              Leave this alone unless this one version differs: a downloadable size of an otherwise
              posted product, say.
            </FieldDescription>
          </Field>

          <label className="flex items-center gap-2">
            <Checkbox
              color="module"
              checked={draft.requiresShipping}
              aria-label={`${label} has to be delivered`}
              onChange={(event) => {
                onChange(variant.id, { requiresShipping: event.target.checked });
              }}
            />
            <Text as="span">This has to be posted or delivered</Text>
          </label>

          <div className="flex flex-col gap-3">
            <Heading level={4} className="text-base font-semibold">
              For working out postage
            </Heading>
            <div className="flex flex-col gap-3 @md:flex-row">
              <WholeNumber
                label="Weight"
                unit="grams"
                value={draft.weightGrams}
                onChange={(next) => {
                  onChange(variant.id, { weightGrams: next });
                }}
              />
              <WholeNumber
                label="Length"
                unit="mm"
                value={draft.lengthMm}
                onChange={(next) => {
                  onChange(variant.id, { lengthMm: next });
                }}
              />
              <WholeNumber
                label="Width"
                unit="mm"
                value={draft.widthMm}
                onChange={(next) => {
                  onChange(variant.id, { widthMm: next });
                }}
              />
              <WholeNumber
                label="Height"
                unit="mm"
                value={draft.heightMm}
                onChange={(next) => {
                  onChange(variant.id, { heightMm: next });
                }}
              />
            </div>
          </div>

          {/* Rare, and one of them takes something off sale. Plain rows after
              the work, under a divider — not cards competing with the price
              someone came here to change. */}
          <div className="border-base-300 flex flex-col gap-3 border-t pt-3">
            {variant.isDefault ? null : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Text>
                  Shoppers see one version selected when the page opens. Right now that is not this
                  one.
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  color="info"
                  onClick={() => {
                    onMakeDefault(variant);
                  }}
                >
                  Show this one first
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Text>
                Stop selling this version without losing it. Its code stays reserved and past orders
                keep their record.
              </Text>
              <Button
                size="sm"
                variant="outline"
                color="danger"
                onClick={() => {
                  onRetire(variant);
                }}
              >
                <X className="size-4" aria-hidden />
                Stop selling it
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── The core deposit, and the other way to buy a part that carries one ── */

/**
 * A rebuilt part is bought one of two ways (persona issue 057): pay the deposit
 * and it ships now, or send the old part first and pay nothing, and it ships
 * when the old one arrives. The second is only offered beside a deposit, so the
 * switch appears once there is one. A part the supplier ships straight to the
 * buyer cannot offer it: the old part would have to come here first. The server
 * refuses that in these same words.
 */
function CoreDeposit({
  variant,
  label,
  draft,
  onChange,
}: {
  variant: Variant;
  label: string;
  draft: VariantDraft;
  onChange: (change: Partial<VariantDraft>) => void;
}) {
  const hasDeposit = draft.core !== null && draft.core > 0;
  const fromSupplier = variant.dropshipSourceId !== null;
  return (
    <div className="flex flex-col gap-3">
      <OptionalMoney
        label="Core deposit"
        description="For a rebuilt part. Charged on top of the price, never taxed or discounted, and paid back when the customer returns their old part."
        value={draft.core}
        addLabel="Add a core deposit"
        onChange={(next) => {
          onChange({ core: next });
        }}
      />
      {hasDeposit ? (
        <Field>
          <FieldLabel>Buyers can send their old part first instead</FieldLabel>
          <FieldControl
            render={
              <Switch
                color="module"
                checked={draft.coreFirst && !fromSupplier}
                disabled={fromSupplier}
                aria-label={`Buyers of ${label} can send their old part first`}
                onCheckedChange={(next: boolean) => {
                  onChange({ coreFirst: next });
                }}
              />
            }
          />
          <FieldDescription>
            No deposit. The part is held until the old one arrives.
          </FieldDescription>
          {fromSupplier ? (
            <FieldStatus status="warning">
              Your supplier ships this part straight to the buyer, so the old part cannot come to
              you first.
            </FieldStatus>
          ) : null}
        </Field>
      ) : null}
    </div>
  );
}

/* ── A money field that can be absent ───────────────────────────────────── */

function OptionalMoney({
  label,
  description,
  value,
  addLabel,
  onChange,
}: {
  label: string;
  description: string;
  value: number | null;
  addLabel: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field className="min-w-0 flex-1">
      <FieldLabel>{label}</FieldLabel>
      {value === null ? (
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onChange(0);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {addLabel}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <MoneyInput
            color="module"
            className="min-w-0 flex-1"
            value={value}
            aria-label={label}
            onValueChange={onChange}
          />
          <Button
            size="sm"
            variant="ghost"
            shape="square"
            aria-label={`Remove ${label.toLowerCase()}`}
            onClick={() => {
              onChange(null);
            }}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      )}
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}

/* ── A whole-number measurement ─────────────────────────────────────────── */

function WholeNumber({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field className="min-w-0 flex-1">
      <FieldLabel>
        {label} ({unit})
      </FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            size="sm"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className="text-right tabular-nums"
            value={value === null ? '' : String(value)}
            placeholder="—"
            onChange={(event) => {
              const next = event.target.value.trim();
              onChange(next === '' ? null : Math.max(0, Math.round(Number(next) || 0)));
            }}
          />
        }
      />
    </Field>
  );
}

/* ── Versions with no place in the grid ─────────────────────────────────── */

const PLACE_ROW =
  'border-base-300 flex flex-col gap-2 border-b pb-3 last:border-b-0 @md:flex-row @md:items-center';

/**
 * Every version that belongs to no combination, on sale or stopped, with the
 * control that puts it back.
 *
 * This used to be two sections with two offers and no cure between them: one
 * listed the on-sale ones with an ordinary price editor and a sentence saying
 * shoppers could not reach them, the other listed EVERY stopped version with
 * "Sell it again", which put an unreachable version on sale and moved it from
 * the bottom section to the middle one, no closer to being bought (issue 306).
 * The cure is the same for both, say which combination it belongs to, so they
 * share one section and the badge says which of the two it is.
 */
function FindAPlace({
  stranded,
  homeless,
  free,
  claimants,
  placingId,
  onPlace,
}: {
  /** On sale, but sitting on no combination. */
  stranded: Variant[];
  /** Stopped, and with no combination to come back to. */
  homeless: Variant[];
  /** Combinations with nothing on sale in them. */
  free: Slot[];
  /** Empty squares whose own code one of these carries, by slot key. The picker
   *  starts on that square, because it is almost certainly where it belongs. */
  claimants: Map<string, Variant>;
  placingId: string | null;
  onPlace: (variant: Variant, slot: Slot) => void;
}) {
  const versions = [...stranded, ...homeless];
  if (versions.length === 0) return null;

  return (
    <FormSection
      title="Versions with no place in the grid"
      description={
        free.length > 0
          ? 'These do not belong to any combination of choices, so nobody can reach them on your website. Say where each one belongs and it goes back in the grid keeping its price, code and stock.'
          : 'These do not belong to any combination of choices, so nobody can reach them on your website. Every combination already has something on sale in it. Add the choice these belong to on the Options tab, or stop selling whatever is in the combination you want, and they can go back.'
      }
    >
      {versions.map((variant) => {
        const home = [...claimants.entries()].find(([, claimant]) => claimant.id === variant.id);
        return (
          <PlaceRow
            key={variant.id}
            variant={variant}
            free={free}
            home={home?.[0] ?? null}
            busy={placingId === variant.id}
            onPlace={onPlace}
          />
        );
      })}
    </FormSection>
  );
}

function PlaceRow({
  variant,
  free,
  home,
  busy,
  onPlace,
}: {
  variant: Variant;
  free: Slot[];
  /** The square whose code this version carries, if any. */
  home: string | null;
  busy: boolean;
  onPlace: (variant: Variant, slot: Slot) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  // The list moves under her as each version is placed, so a stale choice falls
  // back rather than writing somewhere else: first to the square this version's
  // code names, then to an EMPTY one. A square already holding a stopped version
  // is a fine place and is labeled so, but defaulting to it stacks two on a
  // square nobody asked to share (issue 306).
  const chosen =
    free.find((slot) => slot.key === picked) ??
    free.find((slot) => slot.key === home) ??
    free.find((slot) => slot.retired.length === 0) ??
    free[0] ??
    null;

  return (
    <div className={PLACE_ROW}>
      {/* Never truncated. Two versions can differ only in a "-2" at the end, and
          a "…" there hides which one holds the stock. */}
      <Text className="min-w-0 flex-1 wrap-anywhere">{variant.title ?? variant.sku}</Text>
      <div className="flex flex-wrap items-center gap-2">
        <Text as="span" className="tabular-nums">
          {formatCents(variant.priceCents, variant.currency)}
        </Text>
        {variant.deletedAt === null ? (
          <Badge color="warning" variant="soft" size="sm">
            On sale, but hidden
          </Badge>
        ) : (
          <Badge variant="outline" size="sm">
            Not sold
          </Badge>
        )}
      </div>

      {chosen ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="min-w-44">
            <Select
              color="module"
              size="sm"
              aria-label={`Where ${variant.sku} belongs`}
              value={chosen.key}
              items={free.map((slot) => ({ value: slot.key, label: choiceLabel(slot) }))}
              onValueChange={(next) => {
                setPicked((next as string | null) ?? null);
              }}
            />
          </div>
          <Button
            size="sm"
            color="module"
            loading={busy}
            onClick={() => {
              onPlace(variant, chosen);
            }}
          >
            Put it here
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** A combination already holding a stopped version is still a fine place to put
 *  one, and saying so beats letting her find out afterwards. Kept short: a select
 *  truncates its own trigger, and a longer caveat lost everything but the words
 *  that introduce it at 360px. */
function choiceLabel(slot: Slot): string {
  const held = slot.retired.length;
  if (held === 0) return slotLabel(slot);
  return `${slotLabel(slot)} (${String(held)} not sold)`;
}

/* ── Stopped versions whose combination sells something else ────────────── */

/**
 * Nothing is wrong with these. Stopping a version and selling a new one on the
 * same combination is how anybody replaces a line, and the old one settles here.
 *
 * Listed rather than hidden because their codes stay RESERVED, and a code held
 * by a row nobody can see makes "that code already exists" impossible to answer.
 * No "Sell it again" either: two versions on sale in one combination is the state
 * this tab exists to prevent, so the sentence names the real way back.
 */
function RestingSection({ resting, hasChoices }: { resting: Variant[]; hasChoices: boolean }) {
  if (resting.length === 0) return null;

  return (
    <FormSection
      title="Kept, but not sold"
      description={
        hasChoices
          ? 'Each of these sits on a combination you are already selling something else in, so nothing needs doing. They are kept because past orders refer to them and their codes stay reserved. To go back to one, stop selling the version in its combination and it appears there ready to sell again.'
          : 'You are selling a newer version of this product, so nothing needs doing. These are kept because past orders refer to them and their codes stay reserved. To go back to one, stop selling the current version and it appears here ready to sell again.'
      }
    >
      {resting.map((variant) => (
        <div
          key={variant.id}
          className="border-base-300 flex flex-col gap-1 border-b pb-2 last:border-b-0 @md:flex-row @md:items-center @md:gap-2"
        >
          <Text className="min-w-0 flex-1 wrap-anywhere">{variant.sku}</Text>
          <div className="flex items-center gap-2">
            <Text as="span" className="tabular-nums">
              {formatCents(variant.priceCents, variant.currency)}
            </Text>
            <Badge variant="outline" size="sm">
              Not sold
            </Badge>
          </div>
        </div>
      ))}
    </FormSection>
  );
}
