'use client';

// One price list — create it, then manage it. Create and manage are the SAME
// surface: `{ id: 'new' }` builds it, `{ id }` manages it, so a create is a pane
// in its "new" state, never a second form.
//
// A price list is a set of special prices for particular customers — a wholesale
// sheet, a members' rate. It has three parts, in the order someone fills them:
//
//   1. WHAT it is        — a name, and the currency its prices are in.
//   2. WHO gets it       — everyone on a channel, one customer group, or one
//                          trade account; and when it goes live.
//   3. THE PRICES        — one line per product version: a fixed price, or a
//                          percentage off the normal one.
//
// The prices are written with ONE bulk request, not a call per line (a list can
// carry hundreds), and lines removed in the editor are deleted in a second pass.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
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
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { Tag, Trash2 } from 'lucide-react';
import { api } from '../../lib/api/client';
import { channelLabel } from '../../lib/console/channels';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { CurrencyField } from '../../components/currency-field';
import { SiteScopeField } from '../../components/site-scope-field';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { MoneyInput } from '@/components/money-input';
import { VariantPicker } from './variant-picker';
import type { VariantChoice } from './bundles-data';
import { SaveFailure } from '@/components/save-failure';
import {
  priceListErrorMessage,
  priceListState,
  useArchivePriceList,
  useB2bAccounts,
  useBulkSetEntries,
  useCreatePriceList,
  useCustomerSegments,
  useDeletePriceListEntry,
  useInvalidatePriceLists,
  usePriceList,
  usePriceListEntries,
  useUpdatePriceList,
  type BulkEntryInput,
  type PriceListEntryRow,
  type PriceListRow,
  type PriceListWriteInput,
} from './price-lists-data';
import { PaneLoadError } from '../../components/pane-load-error';
import { badDayIn, dayEndUtc, dayStartUtc } from '../../lib/today';
import { createdWithoutPrices, saveFailureLine, type SavePoint } from './price-list-save-words';
import { ChoiceListNote, choiceListState } from '../../components/choice-list-note';
import { DayInput } from '../../components/day-input';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

type Audience = 'everyone' | 'segment' | 'account';
type EntryMode = 'fixed' | 'percent';

/* ── Channel wording ────────────────────────────────────────────────────── */

/* ── Draft ──────────────────────────────────────────────────────────────── */

interface EntryDraft {
  /** The server id, or null for a line added but not yet saved. */
  entryId: string | null;
  variantId: string;
  productTitle: string;
  /** What distinguishes this version — its option label or its code. */
  variantName: string;
  mode: EntryMode;
  /** In whole currency units while editing (MoneyInput works in dollars). */
  fixedPrice: number;
  /** 0–100. */
  percentOff: number;
  /** The version's own currency, when known — used only to warn about a
   *  mismatch with the list currency. */
  variantCurrency?: string;
}

interface Draft {
  name: string;
  description: string;
  currency: string;
  audience: Audience;
  customerSegmentId: string | null;
  companyId: string | null;
  /** `all` means every channel (null on the wire). */
  channel: string;
  /** Live (status `active`) vs a draft nobody sees yet. */
  live: boolean;
  /** `YYYY-MM-DD`, or empty for "no start/end". */
  startDate: string;
  endDate: string;
  /** The sites these prices apply on. EMPTY = all of them. */
  propertyIds: string[];
  entries: EntryDraft[];
}

function emptyDraft(): Draft {
  return {
    name: '',
    description: '',
    currency: 'USD',
    audience: 'everyone',
    customerSegmentId: null,
    companyId: null,
    channel: 'all',
    live: false,
    startDate: '',
    endDate: '',
    propertyIds: [],
    entries: [],
  };
}

function isoDate(value: string | null): string {
  if (!value) return '';
  // The wire carries a full ISO datetime; a date input wants `YYYY-MM-DD`.
  return value.slice(0, 10);
}

function entryFromRow(row: PriceListEntryRow): EntryDraft {
  return {
    entryId: row.id,
    variantId: row.variantId,
    productTitle: row.productTitle,
    variantName: row.variantSku,
    mode: row.fixedPriceCents != null ? 'fixed' : 'percent',
    fixedPrice: row.fixedPriceCents != null ? row.fixedPriceCents / 100 : 0,
    percentOff: row.percentOffList ?? 0,
  };
}

function toDraft(row: PriceListRow, entries: PriceListEntryRow[]): Draft {
  return {
    name: row.name,
    description: row.description ?? '',
    currency: row.currency,
    audience: row.companyId ? 'account' : row.customerSegmentId ? 'segment' : 'everyone',
    customerSegmentId: row.customerSegmentId,
    companyId: row.companyId,
    channel: row.channel ?? 'all',
    live: row.status === 'active',
    startDate: isoDate(row.validFrom),
    endDate: isoDate(row.validTo),
    // Sorted so the dirty check can't fire on ordering alone.
    propertyIds: [...row.propertyIds].sort(),
    // Only entries added straight to a list, minQuantity 1 — quantity breaks are
    // authored on the product's own Pricing tab, so the editor keeps one price
    // per version. Any tiered entries made elsewhere are left untouched on save.
    entries: entries.filter((entry) => entry.minQuantity <= 1).map(entryFromRow),
  };
}

function cents(value: number): number {
  return Math.round(value * 100);
}

/** A stable string for one entry, so a re-order or a no-op edit doesn't read as
 *  dirty and the save diff is exact. */
function entrySignature(entry: EntryDraft): string {
  return entry.mode === 'fixed'
    ? `${entry.variantId}:f:${String(cents(entry.fixedPrice))}`
    : `${entry.variantId}:p:${String(entry.percentOff)}`;
}

function entriesSignature(entries: EntryDraft[]): string {
  return entries.map(entrySignature).sort().join('|');
}

/** Order-insensitive set compare for the site scope. This surface's dirty check is
 *  an explicit field-by-field list rather than a whole-draft compare, so a field
 *  added to `Draft` without a line HERE renders, edits, and can never be saved —
 *  Save simply never enables. That is what happened to `propertyIds`. */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(b);
  return a.every((value) => seen.has(value));
}

/* ── Surface ────────────────────────────────────────────────────────────── */

export function PriceListDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? (
    <PriceListEditor ctx={ctx} id="new" />
  ) : (
    <PriceListLoader ctx={ctx} id={id} />
  );
}

function PriceListLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const listQuery = usePriceList(id);
  const entriesQuery = usePriceListEntries(id);

  // The PRICES are the price list, so a pane that waits for them has to say
  // when they did not arrive. It waited and never asked: on a bad response the
  // editor rendered an empty price table under a row that says "1 price", which
  // is a failed read wearing the shape of an answer (issue 627).
  if (listQuery.isError || entriesQuery.isError) {
    return (
      <PaneLoadError
        error={listQuery.error}
        noun="price list"
        title="Could not load this price list"
        description="This is a problem reaching the server. The price list itself is unaffected. Nothing has been lost."
        onRetry={() => {
          void listQuery.refetch();
          void entriesQuery.refetch();
        }}
      />
    );
  }

  if (listQuery.isPending || !listQuery.data || entriesQuery.isPending) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  return (
    <PriceListEditor ctx={ctx} id={id} list={listQuery.data} entries={entriesQuery.data ?? []} />
  );
}

function PriceListEditor({
  ctx,
  id,
  list,
  entries,
}: {
  ctx: SurfaceContext;
  id: string;
  list?: PriceListRow;
  entries?: PriceListEntryRow[];
}) {
  const isNew = id === 'new';
  const toast = useToast();
  const confirm = useConfirm();

  const create = useCreatePriceList();
  const update = useUpdatePriceList(id);
  const bulkSet = useBulkSetEntries(id);
  const deleteEntry = useDeletePriceListEntry(id);
  const archive = useArchivePriceList(id);

  const saved = useMemo(
    () => (list ? toDraft(list, entries ?? []) : emptyDraft()),
    [list, entries]
  );
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New price list' : (list?.name ?? 'Price list'));
  }, [ctx, isNew, list]);

  // The targeting option lists only load when they can actually be chosen — and
  // are tolerant of the CRM module being off (they come back empty, not broken).
  const segmentsQuery = useCustomerSegments(draft.audience === 'segment');
  const accountsQuery = useB2bAccounts(draft.audience === 'account');

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  /* ── Validation ───────────────────────────────────────────────────────── */

  const nameError = draft.name.trim() === '' ? 'Give this price list a name.' : null;
  const audienceError =
    draft.audience === 'segment' && !draft.customerSegmentId
      ? 'Choose which customer group gets these prices.'
      : draft.audience === 'account' && !draft.companyId
        ? 'Choose which trade account gets these prices.'
        : null;

  const invalidEntry = draft.entries.find((entry) =>
    entry.mode === 'fixed' ? entry.fixedPrice <= 0 : entry.percentOff <= 0 || entry.percentOff > 100
  );
  const entryError = invalidEntry
    ? invalidEntry.mode === 'fixed'
      ? `Set a price above zero for ${invalidEntry.productTitle}.`
      : `Set a discount between 1% and 100% for ${invalidEntry.productTitle}.`
    : null;

  const dateError =
    badDayIn(draft.startDate, draft.endDate) ??
    (draft.startDate && draft.endDate && draft.startDate > draft.endDate
      ? 'The end date is before the start date.'
      : null);

  const blocking = nameError ?? audienceError ?? entryError ?? dateError;

  /* ── Dirty ────────────────────────────────────────────────────────────── */

  const dirty = isNew
    ? draft.name.trim() !== '' ||
      draft.description.trim() !== '' ||
      draft.audience !== 'everyone' ||
      draft.channel !== 'all' ||
      draft.live ||
      draft.startDate !== '' ||
      draft.endDate !== '' ||
      draft.propertyIds.length > 0 ||
      draft.entries.length > 0
    : draft.name !== saved.name ||
      draft.description !== saved.description ||
      draft.currency !== saved.currency ||
      draft.audience !== saved.audience ||
      draft.customerSegmentId !== saved.customerSegmentId ||
      draft.companyId !== saved.companyId ||
      draft.channel !== saved.channel ||
      draft.live !== saved.live ||
      draft.startDate !== saved.startDate ||
      draft.endDate !== saved.endDate ||
      !sameSet(draft.propertyIds, saved.propertyIds) ||
      entriesSignature(draft.entries) !== entriesSignature(saved.entries);

  const saving = create.isPending || update.isPending || bulkSet.isPending || deleteEntry.isPending;
  const invalidate = useInvalidatePriceLists();

  useDirtySource(
    dirty && !create.isSuccess,
    isNew
      ? 'This price list has not been created yet. Close anyway?'
      : 'This price list has unsaved changes. Close anyway?'
  );

  /* ── Save ─────────────────────────────────────────────────────────────── */

  const toIsoStart = (value: string) => (value === '' ? null : dayStartUtc(value));
  const toIsoEnd = (value: string) => (value === '' ? null : dayEndUtc(value));

  const writePayload = (): PriceListWriteInput => ({
    name: draft.name.trim(),
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    currency: draft.currency,
    channel: draft.channel === 'all' ? null : draft.channel,
    customerSegmentId: draft.audience === 'segment' ? draft.customerSegmentId : null,
    companyId: draft.audience === 'account' ? draft.companyId : null,
    validFrom: toIsoStart(draft.startDate),
    validTo: toIsoEnd(draft.endDate),
    status: draft.live ? 'active' : 'draft',
    propertyIds: draft.propertyIds,
  });

  const entriesPayload = (): BulkEntryInput[] =>
    draft.entries.map((entry) =>
      entry.mode === 'fixed'
        ? { variantId: entry.variantId, fixedPriceCents: cents(entry.fixedPrice), minQuantity: 1 }
        : { variantId: entry.variantId, percentOffList: entry.percentOff, minQuantity: 1 }
    );

  const submit = () => {
    if (blocking) return;
    setFailure(null);

    if (isNew) {
      create.mutate(writePayload(), {
        onSuccess: (created) => {
          const land = () => {
            ctx.open('commerce.pricelist.detail', { id: created.id }, { target: 'replace' });
            afterPaneChange(() => {
              toast.add({ title: `${draft.name.trim()} created`, type: 'success' });
            });
          };
          const payload = entriesPayload();
          if (payload.length > 0) {
            // The prices go in a SECOND request, and it can fail on its own. It
            // used to be swallowed — `.catch(() => undefined)`, called "soft" —
            // and the pane then landed announcing "<name> created" over a list
            // with no prices in it, with everything typed here gone and no
            // message anywhere. Landing is still right (the list exists, and not
            // landing would invite a second one), but the toast has to say which
            // of the two things happened.
            void bulkSetEntriesFor(created.id, payload).then((wrote) => {
              if (wrote) {
                land();
                return;
              }
              ctx.open('commerce.pricelist.detail', { id: created.id }, { target: 'replace' });
              afterPaneChange(() => {
                toast.add({
                  title: createdWithoutPrices(draft.name.trim(), payload.length),
                  type: 'error',
                });
              });
            });
          } else {
            land();
          }
        },
        onError: (error) => {
          setFailure(priceListErrorMessage(error, 'Could not create this price list.'));
        },
      });
      return;
    }

    void (async () => {
      // WHICH OF THE THREE REQUESTS WE ARE IN. There is no transaction across
      // them — the server commits each — so the failure sentence has to know how
      // far it got. It used to say "Nothing was changed" from inside a catch
      // wrapped around all three, which is true of the first one only.
      let point: SavePoint = 'settings';
      let deleted = 0;
      try {
        await update.mutateAsync(writePayload());

        // Lines removed in the editor are gone from the draft but still on the
        // server — delete them before the bulk write so the two stay in step.
        const keptIds = new Set(
          draft.entries
            .map((entry) => entry.entryId)
            .filter((value): value is string => Boolean(value))
        );
        const removed = (saved.entries ?? []).filter(
          (entry) => entry.entryId && !keptIds.has(entry.entryId)
        );
        point = 'removals';
        for (const entry of removed) {
          if (entry.entryId) await deleteEntry.mutateAsync(entry.entryId);
          deleted += 1;
        }

        point = 'prices';
        const payload = entriesPayload();
        if (payload.length > 0) await bulkSet.mutateAsync(payload);

        setTouched(false);
        toast.add({ title: 'Price list saved', type: 'success' });
      } catch (error) {
        setFailure(priceListErrorMessage(error, saveFailureLine(point, deleted)));
        // A PART of this save committed, so what the pane believes is saved is
        // now stale — and `saved` is what the next attempt computes its
        // deletions from. Without this, saving again re-deletes prices that are
        // already gone and fails on the 404. `touched` stays true, so nothing
        // she typed is replaced by the refetch.
        if (point !== 'settings') invalidate(id);
      }
    })();
  };

  /* ── Delete ───────────────────────────────────────────────────────────── */

  const onArchive = async () => {
    if (!list) return;
    const ok = await confirm({
      title: `Retire ${list.name}?`,
      description:
        'The special prices on this list stop applying: the customers it covers go back to your normal prices. Orders already placed are unaffected. This cannot be undone.',
      confirmLabel: 'Retire this price list',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    archive.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${list.name} retired`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not retire this price list',
          description: priceListErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  /* ── Entries ──────────────────────────────────────────────────────────── */

  const addVariant = (variant: VariantChoice) => {
    setTouched(true);
    setDraft((current) => ({
      ...current,
      entries: [
        ...current.entries,
        {
          entryId: null,
          variantId: variant.id,
          productTitle: variant.productTitle,
          variantName: variant.title ?? variant.sku,
          mode: 'fixed',
          // Prefill with the normal price so the merchant adjusts DOWN from a
          // real number rather than typing one from zero.
          fixedPrice: variant.priceCents / 100,
          percentOff: 10,
          variantCurrency: variant.currency,
        },
      ],
    }));
  };

  const setEntry = (variantId: string, patch: Partial<EntryDraft>) => {
    setTouched(true);
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.variantId === variantId ? { ...entry, ...patch } : entry
      ),
    }));
  };

  const removeEntry = (variantId: string) => {
    setTouched(true);
    setDraft((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.variantId !== variantId),
    }));
  };

  /* ── Options ──────────────────────────────────────────────────────────── */

  // The three everyday channels, plus the list's own if it's something else — so
  // a list scoped to, say, Subscriptions elsewhere round-trips without being
  // quietly widened to "everywhere".
  const channelOptions = useMemo(() => {
    const base = ['all', 'storefront', 'b2b_portal'];
    if (!base.includes(draft.channel)) base.push(draft.channel);
    return base.map((value) => ({
      value,
      label: value === 'all' ? 'Everywhere you sell' : channelLabel(value),
    }));
  }, [draft.channel]);

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Price list actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            loading={saving}
            disabled={Boolean(nameError) || (!isNew && !dirty)}
            onClick={submit}
          >
            {isNew ? 'Create price list' : 'Save'}
          </Button>
        }
        controls={
          <>
            {!isNew && list ? (
              <Badge color={priceListState(list).tone} variant="soft" size="sm">
                {priceListState(list).label}
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isNew ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                Add a price list
              </Heading>
              <Text>
                A price list gives certain customers their own prices: a wholesale sheet for the
                businesses you supply, or a members’ rate. Set who it is for, then the price of each
                product for them.
              </Text>
            </div>
          ) : null}

          <SaveFailure title="Could not save this price list" message={failure} />

          {/* 1 — What it is */}
          <FormSection title="Name">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color={nameError && touched ? 'error' : 'module'}
                    value={draft.name}
                    placeholder="Wholesale prices"
                    onChange={(event) => {
                      set('name', event.target.value);
                    }}
                  />
                }
              />
              {nameError && touched ? (
                <FieldStatus status="error">{nameError}</FieldStatus>
              ) : (
                <FieldDescription>
                  Only you and your team see this. It names the list, not anything a shopper reads.
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel>Note</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={2}
                    value={draft.description}
                    placeholder="A reminder of what this list is for, e.g. “Prices for our trade counter customers”."
                    onChange={(event) => {
                      set('description', event.target.value);
                    }}
                  />
                }
              />
            </Field>

            <CurrencyField
              label="Currency for these prices"
              required
              value={draft.currency}
              onChange={(next) => {
                set('currency', next);
              }}
              description="The currency every price on this list is set in."
            />
          </FormSection>

          {/* 2 — Who gets it */}
          <FormSection
            title="Who gets these prices"
            description="These prices replace your normal ones, but only for the customers you choose here."
          >
            <Field>
              <FieldLabel>Give them to</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-sm">
                    <Select
                      color="module"
                      aria-label="Who gets these prices"
                      value={draft.audience}
                      items={[
                        { value: 'everyone', label: 'Everyone (on the channel below)' },
                        { value: 'segment', label: 'One customer group' },
                        { value: 'account', label: 'One trade account' },
                      ]}
                      onValueChange={(next) => {
                        set('audience', (next as Audience) ?? 'everyone');
                      }}
                    />
                  </div>
                }
              />
              <FieldDescription>
                A customer group is a saved set of customers; a trade account is one business you
                supply. Both are set up under Customers.
              </FieldDescription>
            </Field>

            {draft.audience === 'segment' ? (
              <Field>
                <FieldLabel>Customer group</FieldLabel>
                <FieldControl
                  render={
                    <div className="max-w-sm">
                      <Select
                        color={audienceError && touched ? 'error' : 'module'}
                        aria-label="Which customer group"
                        placeholder="Choose a customer group"
                        value={draft.customerSegmentId ?? ''}
                        items={(segmentsQuery.data?.items ?? []).map((option) => ({
                          value: option.id,
                          label: option.name,
                        }))}
                        onValueChange={(next) => {
                          set('customerSegmentId', String(next) || null);
                        }}
                      />
                    </div>
                  }
                />
                {audienceError && touched ? (
                  <FieldStatus status="error">{audienceError}</FieldStatus>
                ) : (
                  <ChoiceListNote
                    state={choiceListState(segmentsQuery)}
                    words={{
                      none: 'You have no customer groups yet. Create one under Customers, then choose it here.',
                      noun: 'customer groups',
                    }}
                  />
                )}
              </Field>
            ) : null}

            {draft.audience === 'account' ? (
              <Field>
                <FieldLabel>Trade account</FieldLabel>
                <FieldControl
                  render={
                    <div className="max-w-sm">
                      <Select
                        color={audienceError && touched ? 'error' : 'module'}
                        aria-label="Which trade account"
                        placeholder="Choose a trade account"
                        value={draft.companyId ?? ''}
                        items={(accountsQuery.data?.items ?? []).map((option) => ({
                          value: option.id,
                          label: option.name,
                        }))}
                        onValueChange={(next) => {
                          set('companyId', String(next) || null);
                        }}
                      />
                    </div>
                  }
                />
                {audienceError && touched ? (
                  <FieldStatus status="error">{audienceError}</FieldStatus>
                ) : (
                  <ChoiceListNote
                    state={choiceListState(accountsQuery)}
                    words={{
                      none: 'You have no trade accounts yet. Add one under Wholesale accounts, then choose it here.',
                      noun: 'trade accounts',
                    }}
                  />
                )}
              </Field>
            ) : null}

            <Field>
              <FieldLabel>Where these prices apply</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-sm">
                    <Select
                      color="module"
                      aria-label="Where these prices apply"
                      value={draft.channel}
                      items={channelOptions}
                      onValueChange={(next) => {
                        set('channel', String(next));
                      }}
                    />
                  </div>
                }
              />
              <FieldDescription>
                Which part of your business these prices show up in. Leave it on “Everywhere you
                sell” unless you only want them in one place.
              </FieldDescription>
            </Field>
          </FormSection>

          {/* 2b — When it applies */}
          <FormSection
            title="When it applies"
            description="Switch the list on to start using it. You can also set it to start or stop on a date."
          >
            <Field>
              <FieldLabel>Use these prices</FieldLabel>
              <FieldControl
                render={
                  <Switch
                    color="module"
                    checked={draft.live}
                    onCheckedChange={(next: boolean) => {
                      set('live', next);
                    }}
                  />
                }
              />
              <FieldDescription>
                {draft.live
                  ? 'This list is on. Turn it off to keep it as a draft nobody is charged from.'
                  : 'This list is a draft: no one is charged from it until you switch it on.'}
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
              <Field>
                <FieldLabel>Start date</FieldLabel>
                <FieldControl
                  render={
                    <DayInput
                      color="module"
                      value={draft.startDate}
                      aria-label="Start date"
                      onValueChange={(value) => {
                        set('startDate', value);
                      }}
                    />
                  }
                />
                <FieldDescription>Optional. Leave empty to start straight away.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>End date</FieldLabel>
                <FieldControl
                  render={
                    <DayInput
                      color={dateError ? 'error' : 'module'}
                      value={draft.endDate}
                      aria-label="End date"
                      onValueChange={(value) => {
                        set('endDate', value);
                      }}
                    />
                  }
                />
                {dateError ? (
                  <FieldStatus status="error">{dateError}</FieldStatus>
                ) : (
                  <FieldDescription>
                    Optional. Leave empty to keep it on indefinitely.
                  </FieldDescription>
                )}
              </Field>
            </div>
          </FormSection>

          {/* 2c — Which sites these prices apply on */}
          <SiteScopeField
            value={draft.propertyIds}
            onChange={(next) => {
              set('propertyIds', next);
            }}
            title="Which of your sites these prices apply on"
            description="You run more than one website. Keep a price list to the business it belongs to, or it will set what customers pay at the other one's checkout."
            everyLabel="Use these prices on every site"
          />

          {/* 3 — The prices */}
          <FormSection
            title="The prices"
            description="Set what these customers pay for each product version. A fixed price replaces the normal one; a percentage takes that much off it."
          >
            {entryError && touched ? (
              <Alert color="warning">
                <AlertContent>
                  <AlertTitle>One of the prices needs a look</AlertTitle>
                  <AlertDescription>{entryError}</AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}

            {draft.entries.length === 0 ? (
              <Text className="text-sm">
                No prices yet. Find a product below to give it a price on this list. Any product you
                don’t add here stays at its normal price for these customers.
              </Text>
            ) : (
              <ul className="flex flex-col gap-2">
                {draft.entries.map((entry) => {
                  const mismatch =
                    entry.variantCurrency != null && entry.variantCurrency !== draft.currency;
                  return (
                    <li
                      key={entry.variantId}
                      className="border-base-300 flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{entry.productTitle}</span>
                          {entry.variantName && entry.variantName !== entry.productTitle ? (
                            <Text as="span" className="block text-sm">
                              {entry.variantName}
                            </Text>
                          ) : null}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          color="danger"
                          shape="square"
                          aria-label={`Remove ${entry.productTitle} from this list`}
                          onClick={() => {
                            removeEntry(entry.variantId);
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-44 shrink-0">
                          <Select
                            size="sm"
                            color="module"
                            aria-label={`How to price ${entry.productTitle}`}
                            value={entry.mode}
                            items={[
                              { value: 'fixed', label: 'A fixed price' },
                              { value: 'percent', label: 'A percentage off' },
                            ]}
                            onValueChange={(next) => {
                              setEntry(entry.variantId, { mode: (next as EntryMode) ?? 'fixed' });
                            }}
                          />
                        </div>

                        {entry.mode === 'fixed' ? (
                          <div className="w-32 shrink-0">
                            <MoneyInput
                              color="module"
                              value={entry.fixedPrice}
                              aria-label={`Price for ${entry.productTitle}`}
                              onValueChange={(next) => {
                                setEntry(entry.variantId, { fixedPrice: next });
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex w-32 shrink-0 items-center gap-1">
                            <Input
                              size="sm"
                              color="module"
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              inputMode="numeric"
                              className="text-right tabular-nums"
                              aria-label={`Percentage off for ${entry.productTitle}`}
                              value={String(entry.percentOff)}
                              onChange={(event) => {
                                setEntry(entry.variantId, {
                                  percentOff: Number(event.target.value) || 0,
                                });
                              }}
                            />
                            <Text as="span" className="text-sm">
                              % off
                            </Text>
                          </div>
                        )}

                        <Text as="span" className="text-sm">
                          {entry.mode === 'fixed'
                            ? `${draft.currency} · what they pay`
                            : 'off your normal price'}
                        </Text>
                      </div>

                      {mismatch ? (
                        <Text as="span" className="text-sm">
                          Heads up. This product is normally priced in {entry.variantCurrency}, but
                          this list is in {draft.currency}. Enter the price in {draft.currency}.
                        </Text>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-base-300 flex flex-col gap-2 border-t pt-4">
              <Heading level={3} className="text-base font-semibold">
                Add a product
              </Heading>
              <VariantPicker
                onPick={addVariant}
                excludeIds={draft.entries.map((entry) => entry.variantId)}
                placeholder="Search your products…"
              />
            </div>
          </FormSection>

          {!isNew && list ? (
            <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Text className="text-sm">
                  Retiring this list stops its special prices: the customers it covers go back to
                  your normal prices. Orders already placed are unaffected.
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  color="danger"
                  loading={archive.isPending}
                  onClick={() => {
                    void onArchive();
                  }}
                >
                  <Tag className="size-4" aria-hidden />
                  Retire this price list
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Write a freshly-created list's prices in one request.
 *
 * A plain function, not the `useBulkSetEntries(id)` hook: it runs in the create
 * callback AFTER the list exists, so the hook — bound to the id we didn't have a
 * moment ago — cannot serve.
 *
 * RETURNS WHETHER IT WROTE. The list must survive a failure here — it exists,
 * and throwing would leave the pane on a create form that would make a second
 * one — but SWALLOWING the failure is what this used to do, and the caller then
 * announced "<name> created" over a list with no prices in it. The rejection is
 * turned into an answer instead of a silence, so the caller can say which of the
 * two happened.
 */
async function bulkSetEntriesFor(listId: string, entries: BulkEntryInput[]): Promise<boolean> {
  return api
    .post(`/v1/commerce/price-lists/${listId}/entries/bulk`, { entries })
    .then(() => true)
    .catch(() => false);
}
