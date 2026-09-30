'use client';

// PACK SIZES — what a case of THIS thing is.
//
// ── The defect this was built for ────────────────────────────────────────
//
// "Units" lists the words a business counts in, and the sentence under it said:
//
//     A unit is only a word until an item says what it contains. Open any
//     product's stock panel to say that a case of THAT thing is twelve, and
//     from then on you can order, receive and count in cases, while your stock
//     figures stay in singles.
//
// There was no such screen. `GET`/`PUT /v1/inventory/variants/:id/units` were
// built, `getVariantUoms`/`setVariantUoms` were built, and `useVariantUoms` and
// `useSetVariantUoms` were written in `inventory/assembly-data.ts` — with ZERO
// callers in either console. So every unit on that pane read "Used on: Nothing
// yet", permanently, for every tenant, because nothing could ever attach one to
// an item. A finished list over a write path nobody could reach.
// [[feedback_screen_over_a_function_nobody_calls]]
// [[feedback_a_promise_in_copy_is_a_contract]]
//
// ── Why the pack size lives on the ITEM and not on the unit ──────────────
//
// A case of belt buckles is twelve and a case of linen is one roll, and both are
// "CS". The unit row carries the NAME; this carries the arithmetic. That is why
// the editor is here, on the version, rather than a second column on Units.
//
// ── Why "usually ordered by" is a dropdown and not a checkbox per row ────
//
// The database holds it as `isPurchaseDefault` on each conversion, with a
// partial unique index allowing exactly one. Drawn as a checkbox per row, that
// invariant is something the person has to maintain by unticking the old one
// first, and the moment they forget the save is refused for a reason that reads
// like a bug. One dropdown can only hold one answer, so the shape of the control
// is the rule. [[feedback_one_outcome_two_causes]]
//
// ── The preview sentence is the real formatter ───────────────────────────
//
// `describeQuantity` from `@wizeworks/commerce-schemas` is what every other
// screen says a quantity with. Using it here rather than writing the sentence
// again means a wrong factor looks wrong in the editor exactly as it will look
// on the purchase order, which is the whole argument for showing the base figure
// alongside the pack in the first place.

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Select,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { describeQuantity } from '@wizeworks/commerce-schemas';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import {
  useSetVariantUoms,
  useUnitsOfMeasure,
  useVariantUoms,
  type UnitOfMeasure,
} from '../inventory/assembly-data';
import { productErrorMessage } from './products-data';

/** The most one item can have. The server refuses past this, and a form that
 *  lets someone type a 21st row and then loses it is worse than one that says
 *  so. */
const MAX_PACK_SIZES = 20;

/** The value meaning "no pack, just singles" in the two default pickers. A
 *  sentinel rather than an empty string, because an empty Select value renders
 *  as a blank line that looks like a bug. */
const SINGLES = '__singles__';

interface PackRow {
  /** Stable across re-renders so a row keeps its input focus while being typed
   *  into. Not the unit id: the unit is the thing being CHANGED. */
  key: string;
  uomId: string;
  units: string;
}

let nextKey = 0;
const freshKey = (): string => `pack-${String((nextKey += 1))}`;

/**
 * What a single one of this item is called.
 *
 * `stockingUomId` is display only: it changes the word in "12 meters" and never
 * a stored number, because the ledger holds base units whatever this says. So it
 * is safe to offer, and worth offering — a business that stocks fabric should
 * read "12 meters", not "12 each".
 */
function singleLabel(units: UnitOfMeasure[], stockingUomId: string | null): string {
  const unit = units.find((u) => u.id === stockingUomId);
  return unit ? unit.name : 'each';
}

export function PackSizesForm({
  variantId,
  variantLabel,
  onDone,
}: {
  variantId: string;
  variantLabel: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const setup = useVariantUoms(variantId);
  const unitsQuery = useUnitsOfMeasure();
  const save = useSetVariantUoms(variantId);

  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);

  // Seeded once from the server and owned locally afterwards. A live query would
  // throw away half-typed rows on every background refetch.
  const [seeded, setSeeded] = useState(false);
  // "Open" is not "changed". Guarding on `seeded` put "Not saved" in the status
  // bar the instant the editor appeared, for a form nobody had typed into, and a
  // warning that is on by default is a warning people learn to click past.
  const [touched, setTouched] = useState(false);
  const [stockingUomId, setStockingUomId] = useState<string>(SINGLES);
  const [rows, setRows] = useState<PackRow[]>([]);
  const [orderBy, setOrderBy] = useState<string>(SINGLES);
  const [sellBy, setSellBy] = useState<string>(SINGLES);

  if (!seeded && setup.data) {
    setSeeded(true);
    setStockingUomId(setup.data.stockingUomId ?? SINGLES);
    setRows(
      setup.data.conversions.map((c) => ({
        key: freshKey(),
        uomId: c.uomId,
        units: String(c.unitsPerUom),
      }))
    );
    setOrderBy(setup.data.conversions.find((c) => c.isPurchaseDefault)?.uomId ?? SINGLES);
    setSellBy(setup.data.conversions.find((c) => c.isSalesDefault)?.uomId ?? SINGLES);
  }

  const unitItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const unit of units) items[unit.id] = `${unit.name} (${unit.code})`;
    return items;
  }, [units]);

  const singleItems = useMemo(() => ({ [SINGLES]: 'Each', ...unitItems }), [unitItems]);

  /** Only a unit that is actually on a row can be the one you usually buy or
   *  sell in — the server stores the flag ON the conversion, so offering one
   *  that has no row would be offering a save that cannot happen. */
  const defaultItems = useMemo(() => {
    const items: Record<string, string> = {
      [SINGLES]: `Singles (${singleLabel(units, stockingUomId === SINGLES ? null : stockingUomId)})`,
    };
    for (const row of rows) {
      const unit = units.find((u) => u.id === row.uomId);
      if (unit) items[unit.id] = `${unit.pluralName} (${unit.code})`;
    }
    return items;
  }, [rows, units, stockingUomId]);

  const parsed = rows.map((row) => {
    const count = Number.parseInt(row.units, 10);
    return { ...row, count };
  });

  const duplicate = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.uomId === '') continue;
      if (seen.has(row.uomId)) return true;
      seen.add(row.uomId);
    }
    return false;
  }, [rows]);

  const complete = parsed.every(
    (row) => row.uomId !== '' && Number.isFinite(row.count) && row.count >= 1
  );
  const valid = complete && !duplicate;

  useDirtySource(touched, `The pack sizes for ${variantLabel} have not been saved. Close anyway?`);

  const addRow = () => {
    if (rows.length >= MAX_PACK_SIZES) return;
    setTouched(true);
    setRows((current) => [...current, { key: freshKey(), uomId: '', units: '' }]);
  };

  const removeRow = (key: string) => {
    setTouched(true);
    const row = rows.find((r) => r.key === key);
    setRows((current) => current.filter((r) => r.key !== key));
    // A default pointing at a row that no longer exists cannot be saved, so it
    // falls back to singles rather than waiting to be refused.
    if (orderBy === row?.uomId) setOrderBy(SINGLES);
    if (sellBy === row?.uomId) setSellBy(SINGLES);
  };

  const submit = () => {
    if (!valid) return;
    save.mutate(
      {
        stockingUomId: stockingUomId === SINGLES ? null : stockingUomId,
        conversions: parsed.map((row) => ({
          uomId: row.uomId,
          unitsPerUom: row.count,
          ...(orderBy === row.uomId ? { isPurchaseDefault: true } : {}),
          ...(sellBy === row.uomId ? { isSalesDefault: true } : {}),
        })),
      },
      {
        onSuccess: () => {
          // Clear the guard BEFORE collapsing: the unmount races the close, and a
          // pane that closes while still reporting dirty asks about work that is
          // already safely written.
          setTouched(false);
          // Collapse first, announce after, the same order as every other inline
          // editor in this pane.
          onDone();
          afterPaneChange(() => {
            toast.add({
              title: `Pack sizes saved for ${variantLabel}`,
              description:
                rows.length === 0
                  ? 'This is counted in singles only.'
                  : `You can now order, receive and count it in ${rows.length === 1 ? 'one other size' : `${String(rows.length)} other sizes`}.`,
              type: 'success',
            });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save those pack sizes',
            description: productErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  if (setup.isPending || unitsQuery.isPending) {
    return (
      <div className="border-base-300 bg-base-200 rounded-lg border p-3">
        <Text className="text-sm">Fetching what this is counted in...</Text>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="border-base-300 bg-base-200 rounded-lg border p-3">
        <Alert color="info">
          <AlertContent>
            <AlertTitle>No units to choose from yet</AlertTitle>
            <AlertDescription>
              A pack size needs a word for the pack. Open Units under Stock and add one, then come
              back here to say how many singles are in it.
            </AlertDescription>
          </AlertContent>
        </Alert>
      </div>
    );
  }

  const single = singleLabel(units, stockingUomId === SINGLES ? null : stockingUomId);

  return (
    <div className="border-base-300 bg-base-200 flex flex-col gap-3 rounded-lg border p-3">
      <Heading level={4} className="text-base font-semibold">
        What you buy and sell this in
      </Heading>

      <Field>
        <FieldLabel>One of these is called</FieldLabel>
        <Select
          color="module"
          size="sm"
          items={singleItems}
          value={stockingUomId}
          aria-label="What one of these is called"
          onValueChange={(next) => {
            setTouched(true);
            setStockingUomId(next as string);
          }}
        />
        <FieldDescription>
          The word for a single one. Your stock figures stay in these whatever you set below.
        </FieldDescription>
      </Field>

      <div className="flex flex-col gap-2">
        <Text className="text-sm font-medium">Pack sizes</Text>
        {rows.length === 0 ? (
          <Text className="text-sm">
            None yet. Add one to order, receive and count this by the case or the box while your
            stock figures stay in {single}.
          </Text>
        ) : (
          rows.map((row) => {
            const count = Number.parseInt(row.units, 10);
            const unit = units.find((u) => u.id === row.uomId);
            const readable =
              unit && Number.isFinite(count) && count >= 1
                ? describeQuantity({
                    baseQuantity: count * 2,
                    uomCode: unit.code,
                    unitsPerUom: count,
                    uomName: unit.name,
                    uomPluralName: unit.pluralName,
                    baseUomName: single,
                    baseUomPluralName: single === 'each' ? 'each' : `${single}s`,
                  })
                : null;
            return (
              <div key={row.key} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-end gap-2">
                  <Field className="min-w-40 flex-1">
                    <FieldLabel>Pack</FieldLabel>
                    <Select
                      color="module"
                      size="sm"
                      items={unitItems}
                      value={row.uomId}
                      aria-label="Which pack"
                      onValueChange={(next) => {
                        setTouched(true);
                        const id = next as string;
                        setRows((current) =>
                          current.map((r) => (r.key === row.key ? { ...r, uomId: id } : r))
                        );
                      }}
                    />
                  </Field>
                  <Field className="w-32">
                    <FieldLabel>Holds</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          size="sm"
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={row.units}
                          aria-label={`How many ${single} in one`}
                          onChange={(event) => {
                            setTouched(true);
                            const next = event.target.value;
                            setRows((current) =>
                              current.map((r) => (r.key === row.key ? { ...r, units: next } : r))
                            );
                          }}
                        />
                      }
                    />
                  </Field>
                  <Button
                    size="sm"
                    variant="ghost"
                    color="danger"
                    shape="square"
                    aria-label="Remove this pack size"
                    onClick={() => {
                      removeRow(row.key);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                {readable ? (
                  <Text className="text-sm">Two of them reads as {readable}.</Text>
                ) : null}
              </div>
            );
          })
        )}

        <div>
          <Button
            size="sm"
            variant="outline"
            color="module"
            disabled={rows.length >= MAX_PACK_SIZES}
            onClick={addRow}
          >
            <Plus className="size-4" aria-hidden />
            Add a pack size
          </Button>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-3 @md:grid-cols-2">
          <Field>
            <FieldLabel>Usually ordered by</FieldLabel>
            <Select
              color="module"
              size="sm"
              items={defaultItems}
              value={orderBy}
              aria-label="What you usually order this by"
              onValueChange={(next) => {
                setTouched(true);
                setOrderBy(next as string);
              }}
            />
            <FieldDescription>What a purchase order fills in for you.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Usually sold by</FieldLabel>
            <Select
              color="module"
              size="sm"
              items={defaultItems}
              value={sellBy}
              aria-label="What you usually sell this by"
              onValueChange={(next) => {
                setTouched(true);
                setSellBy(next as string);
              }}
            />
            <FieldDescription>What a sales document fills in for you.</FieldDescription>
          </Field>
        </div>
      ) : null}

      {duplicate ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>The same pack is listed twice</AlertTitle>
            <AlertDescription>
              One item can have only one meaning for a given pack. Change one of them, or take it
              out.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          color="module"
          disabled={!valid}
          loading={save.isPending}
          onClick={submit}
        >
          <Save className="size-4" aria-hidden />
          Save pack sizes
        </Button>
        <Button size="sm" variant="ghost" color="neutral" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
