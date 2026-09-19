'use client';

// PREORDERS — selling something before it exists, on purpose and in writing.
//
// The setting has been there since the beginning and meant nothing: an item with
// its policy set to "preorder" simply sold past zero and told the customer
// nothing. This screen is the difference between that and an OFFER — a window
// that opens and closes on dates you chose, for a number of units you are
// willing to owe, with something honest to say about when it ships.
//
// ── The date is allowed to be missing ─────────────────────────────────────
//
// The strongest instinct here is to make the availability date required. It is
// wrong. A maker who has not committed to a date is completely ordinary, and a
// merchant forced to fill the field will type something — which then appears on
// the product page as a commitment, in the confirmation email, and in a
// customer's diary. So a window may say "date to be confirmed", which sells
// perfectly well, and the note carries the human version.
//
// ── One live window per item ──────────────────────────────────────────────
//
// Enforced in the database, not just here. Two live windows means two different
// dates promised for the same product, and the way that happens is two people in
// two tabs on an ordinary Tuesday.

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  EmptyState,
  Field,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
  Switch,
  Table,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { CalendarClock, CalendarPlus, CirclePlus } from 'lucide-react';
import { useState } from 'react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { afterCommit } from '../../lib/defer';
import { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { ItemName, itemNameText } from './item-name';
import { plural, stockErrorMessage } from './data';
import { formatDay } from './purchase-orders-data';
import {
  preorderStateLabel,
  preorderTone,
  usePreorderWindows,
  useClosePreorder,
  useOpenPreorder,
  useUpdatePreorder,
  type PreorderWindow,
} from './demand-data';
import { VariantPicker, versionOf } from '../commerce/variant-picker';
import type { VariantChoice } from '../commerce/bundles-data';
import { badDayIn, dayStartUtc } from '../../lib/today';

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  // A row the server should never send still must not take the pane down.
  return Number.isNaN(at.getTime()) ? '' : at.toISOString().slice(0, 10);
}
function toIso(value: string): string | null {
  return value === '' ? null : dayStartUtc(value);
}

export function PreordersSurface(_props: { ctx: SurfaceContext }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('');
  const list = usePreorderWindows(status ? { status } : {});
  // `'new'` is the window that does not exist yet. There was no way to reach one
  // at all until 2026-09-18: `useOpenPreorder` had zero callers in either
  // console, so the table below could only ever be empty and the empty state
  // sent the reader to a product screen that has no such control (issue 678).
  const [editing, setEditing] = useState<PreorderWindow | 'new' | null>(null);
  const start = () => {
    setEditing('new');
  };

  const rows = list.data?.items ?? [];
  const live = rows.filter((r) => r.isTakingOrders);
  const committed = rows.reduce((sum, r) => sum + r.soldQuantity, 0);

  const body = () => {
    if (list.isError) {
      return (
        <EmptyState
          icon={<CalendarClock className="size-6" aria-hidden />}
          title="Could not load your preorders"
          description="This is a problem reaching the server. Try again in a moment."
        />
      );
    }
    if (list.isLoading) {
      return (
        <p className="p-4 text-base" role="status">
          Loading preorders…
        </p>
      );
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={<CalendarPlus className="size-6" aria-hidden />}
          title="No preorders running"
          description="A preorder takes orders for something before it arrives: a production run, a seasonal line, a restock you have already paid for. You choose the item, how long the offer stays open, how many you are willing to owe, and what your product page says about when it ships."
          actions={
            <Button size="sm" color="module" onClick={start}>
              <CirclePlus className="size-4" aria-hidden />
              Take preorders for something
            </Button>
          }
        />
      );
    }

    return (
      <Table size="sm" hover>
        <thead>
          <tr>
            <th>Item</th>
            <th className="whitespace-nowrap">Ships</th>
            <th className="text-right whitespace-nowrap">Committed</th>
            <th className="hidden whitespace-nowrap @lg:table-cell">Window</th>
            <th className="whitespace-nowrap">State</th>
            <th className="text-right" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="w-full max-w-0 min-w-56">
                <span className="flex min-w-0 flex-col">
                  <ItemName
                    productTitle={row.productTitle}
                    variantName={row.variantName}
                    code={row.variantSku}
                  />
                  {row.availabilityNote ? (
                    <span className="truncate text-sm">{row.availabilityNote}</span>
                  ) : null}
                </span>
              </td>
              <td className="whitespace-nowrap">
                {/* "To be confirmed" is a real answer and reads as one. A blank
                    cell here would look like a bug and an invented date would be
                    a promise nobody made.

                    `formatDay`, not a timestamp: all three dates on this row are
                    calendar DAYS picked from a date box and stored at UTC
                    midnight, and printing one on the reader's own clock shows
                    the day BEFORE the one that was typed, everywhere west of
                    Greenwich (issue 679). */}
                {row.availableAt ? (
                  formatDay(row.availableAt)
                ) : (
                  <Badge color="warning" variant="soft" size="sm">
                    To be confirmed
                  </Badge>
                )}
              </td>
              <td className="text-right whitespace-nowrap tabular-nums">
                {row.soldQuantity}
                {/* Only when capped. `remaining` is null for an uncapped run and
                    there is no honest number for "no limit". */}
                {row.remaining !== null ? (
                  <span className="text-sm"> · {row.remaining} left</span>
                ) : null}
              </td>
              <td className="hidden whitespace-nowrap @lg:table-cell">
                {row.startsAt ? formatDay(row.startsAt) : 'Now'}
                {' → '}
                {row.endsAt ? formatDay(row.endsAt) : 'open-ended'}
              </td>
              <td className="whitespace-nowrap">
                <Badge color={preorderTone(row)} variant="soft" size="sm">
                  {preorderStateLabel(row)}
                </Badge>
              </td>
              <td className="text-right whitespace-nowrap">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setEditing(row);
                  }}
                >
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Preorder controls"
        status={
          <Text className="text-sm">
            {live.length > 0
              ? `${plural(live.length, 'preorder', 'preorders')} taking orders · ${plural(committed, 'unit', 'units')} committed`
              : 'Nothing taking preorders'}
          </Text>
        }
        primary={
          <Button className="ml-auto" size="sm" color="module" onClick={start}>
            <CirclePlus className="size-4" aria-hidden />
            Take preorders for something
          </Button>
        }
        controls={
          <>
            <NativeSelect
              size="sm"
              className="max-w-40 shrink"
              aria-label="Which preorders"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
              }}
            >
              <option value="">All</option>
              <option value="open">Running</option>
              <option value="scheduled">Not started</option>
              <option value="closed">Finished</option>
              <option value="cancelled">Canceled</option>
            </NativeSelect>
          </>
        }
        refresh={
          <RefreshButton
            className="ml-auto"
            isFetching={list.isFetching}
            updatedAt={list.data ? list.dataUpdatedAt : undefined}
            onRefresh={() => {
              void list.refetch();
            }}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-auto">{body()}</Card>

      {editing ? (
        <PreorderEditor
          window={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null);
          }}
          onFail={(title, error) => {
            afterCommit(() => {
              toast.add({
                title,
                description: stockErrorMessage(error, 'Nothing was changed.'),
                type: 'error',
              });
            });
          }}
          onSaved={() => {
            afterCommit(() => {
              toast.add({ title: 'Preorder updated', type: 'success' });
            });
          }}
          onOpened={(name, live) => {
            afterCommit(() => {
              toast.add({
                title: live ? `${name} is taking preorders` : `${name} is set up to take preorders`,
                // Deliberately not "your page offers it now". The shop shows the
                // preorder line INSTEAD of "Out of stock", so an item with
                // stock left still sells the ordinary way until it runs out.
                description: live
                  ? 'Your product page offers it the moment this one runs out, with the date and the words you gave it.'
                  : 'Nothing changes on your product page until the opening date.',
                type: 'success',
              });
            });
          }}
          confirm={confirm}
          onClosed={() => {
            afterCommit(() => {
              toast.add({
                title: 'Preorder closed',
                description: 'Existing commitments are unaffected. They are still owed.',
                type: 'info',
              });
            });
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * The preorder form, in both of the states it has: an offer that exists and one
 * that does not yet.
 *
 * Kept as ONE component on purpose. Every field is identical between the two,
 * and splitting it so each half stays short is how a field ends up owned by two
 * components that drift. The only difference is the front of the form — a new
 * offer has to name the item it is for — and the back, where one says Save and
 * the other says start.
 */
function PreorderEditor({
  window: row,
  onClose,
  onSaved,
  onOpened,
  onClosed,
  onFail,
  confirm,
}: {
  /** Null for an offer that does not exist yet. */
  window: PreorderWindow | null;
  onClose: () => void;
  onSaved: () => void;
  onOpened: (itemName: string, live: boolean) => void;
  onClosed: () => void;
  onFail: (title: string, error: unknown) => void;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const isNew = row === null;
  const [picked, setPicked] = useState<VariantChoice | null>(null);

  const update = useUpdatePreorder(row?.id ?? '');
  const close = useClosePreorder(row?.id ?? '');
  const open = useOpenPreorder(picked?.id ?? '');

  // Every offer that is live or waiting to be, whatever the list behind this
  // dialog is filtered to. An item may only have one, so the rest of the catalog
  // is what there is to choose from — offering a second and failing on save
  // would be a choice that could never have worked.
  const existing = usePreorderWindows({});
  const taken = (existing.data?.items ?? [])
    .filter((w) => w.effectiveStatus === 'open' || w.effectiveStatus === 'scheduled')
    .map((w) => w.variantId);

  const sold = row?.soldQuantity ?? 0;
  const [availableAt, setAvailableAt] = useState(toDateInput(row?.availableAt ?? null));
  const [note, setNote] = useState(row?.availabilityNote ?? '');
  const [startsAt, setStartsAt] = useState(toDateInput(row?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toDateInput(row?.endsAt ?? null));
  const [capped, setCapped] = useState(row?.isCapped ?? false);
  // Empty rather than "0" for an uncapped window: the box is hidden until the
  // limit switch is on, and it should open blank rather than pre-filled with a
  // number that means "no limit".
  const [maxQuantity, setMaxQuantity] = useState(row?.maxQuantity ? String(row.maxQuantity) : '');

  const canEdit = isNew || row.effectiveStatus === 'open' || row.effectiveStatus === 'scheduled';
  // A date box can hold something that is not a date; see `lib/today`.
  const dateError = badDayIn(availableAt, startsAt, endsAt);
  const pending = update.isPending || open.isPending;
  const body = {
    availableAt: toIso(availableAt),
    availabilityNote: note.trim() === '' ? null : note.trim(),
    startsAt: toIso(startsAt),
    endsAt: toIso(endsAt),
    isCapped: capped,
    maxQuantity: capped ? Number(maxQuantity) || 0 : 0,
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>
          {isNew
            ? (picked?.productTitle ?? 'Take preorders for something')
            : itemNameText(row, 'Preorder')}
        </DialogTitle>
        <DialogDescription>
          {isNew && picked === null
            ? 'Choose the thing you want to sell before you have it. One offer at a time per item, so anything already on preorder is left out of this list.'
            : 'Leave the shipping date blank if the maker has not committed to one. The product page then says “date to be confirmed”, which sells honestly: a guess in this field becomes a promise the moment somebody reads it.'}
        </DialogDescription>

        {isNew && picked === null ? (
          <div className="py-2">
            <VariantPicker
              excludeIds={taken}
              placeholder="Search your products…"
              onPick={(variant) => {
                setPicked(variant);
              }}
            />
          </div>
        ) : null}

        <div className={`flex flex-col gap-3 py-2 ${isNew && picked === null ? 'hidden' : ''}`}>
          {isNew && picked ? (
            <Field>
              <FieldLabel>What you are taking orders for</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Text className="min-w-0 flex-1 text-base">
                  {picked.productTitle}
                  {versionOf(picked) ? ` · ${versionOf(picked)}` : ''}
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setPicked(null);
                  }}
                >
                  Choose a different one
                </Button>
              </div>
            </Field>
          ) : null}

          <Field>
            <FieldLabel>Ships on</FieldLabel>
            <Input
              type="date"
              value={availableAt}
              onChange={(event) => {
                setAvailableAt(event.target.value);
              }}
            />
          </Field>

          <Field>
            <FieldLabel>What to tell people instead, or as well</FieldLabel>
            <Textarea
              rows={2}
              value={note}
              placeholder="Ships with the spring run"
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          </Field>

          <div className="grid gap-3 @md:grid-cols-2">
            <Field>
              <FieldLabel>Opens</FieldLabel>
              <Input
                type="date"
                value={startsAt}
                onChange={(event) => {
                  setStartsAt(event.target.value);
                }}
              />
            </Field>
            <Field>
              <FieldLabel>Closes</FieldLabel>
              <Input
                type="date"
                value={endsAt}
                onChange={(event) => {
                  setEndsAt(event.target.value);
                }}
              />
            </Field>
          </div>

          {dateError ? <FieldStatus status="error">{dateError}</FieldStatus> : null}

          <Field>
            <FieldLabel>Limit how many you will owe</FieldLabel>
            <Switch
              checked={capped}
              onCheckedChange={(next) => {
                setCapped(next);
              }}
            />
            <Text className="text-sm">
              {capped
                ? 'Once the limit is reached the product page says sold out.'
                : 'No limit: sensible for made-to-order, risky for anything else.'}
            </Text>
          </Field>

          {capped ? (
            <Field>
              <FieldLabel>How many</FieldLabel>
              <Input
                type="number"
                className="w-28 tabular-nums"
                min={Math.max(1, sold)}
                value={maxQuantity}
                onChange={(event) => {
                  setMaxQuantity(event.target.value);
                }}
              />
              {sold > 0 ? (
                <Text className="text-sm">
                  {sold} already committed: the limit cannot go below that.
                </Text>
              ) : null}
            </Field>
          ) : null}

          {/* There WAS a "Take payment now" switch here. Nothing read the column
              it wrote: not the checkout, not the product page, not an email, in
              either console or on any site (MEASURED 2026-09-18, issue 680). Its
              off position promised something the platform cannot do — a card
              authorisation expires long before a spring run ships — so it was a
              choice that could only ever have been kept by accident. What
              actually happens is one sentence, and here it is. */}
          <Text className="text-sm">
            A preorder is paid for at the checkout, the same as anything else in your shop. Say so
            in the words above if the wait is a long one: people mind far less when they were told.
          </Text>
        </div>

        <DialogFooter>
          {row !== null && canEdit ? (
            <Button
              color="danger"
              variant="soft"
              disabled={close.isPending}
              onClick={() => {
                void confirm({
                  title: 'Stop taking preorders?',
                  description: `${plural(sold, 'order', 'orders')} already committed stay owed: closing only stops new ones. The window and its history are kept.`,
                  confirmLabel: 'Stop taking them',
                  cancelLabel: 'Keep it open',
                  color: 'danger',
                }).then((confirmed) => {
                  if (!confirmed) return;
                  close.mutate('closed', {
                    onSuccess: () => {
                      onClose();
                      onClosed();
                    },
                    onError: (error) => {
                      onFail('Could not close it', error);
                    },
                  });
                });
              }}
            >
              Close it
            </Button>
          ) : null}
          <DialogClose>
            <Button variant="outline" color="neutral">
              Cancel
            </Button>
          </DialogClose>
          <Button
            color="module-inventory"
            disabled={pending || !canEdit || dateError !== null || (isNew && picked === null)}
            onClick={() => {
              if (isNew) {
                if (!picked) return;
                const name = picked.productTitle;
                open.mutate(body, {
                  onSuccess: (created) => {
                    onClose();
                    onOpened(name, created.isTakingOrders);
                  },
                  onError: (error) => {
                    onFail('Could not start it', error);
                  },
                });
                return;
              }
              update.mutate(body, {
                onSuccess: () => {
                  onClose();
                  onSaved();
                },
                onError: (error) => {
                  onFail('Could not save that', error);
                },
              });
            }}
          >
            {isNew
              ? pending
                ? 'Starting…'
                : 'Start taking preorders'
              : pending
                ? 'Saving…'
                : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
