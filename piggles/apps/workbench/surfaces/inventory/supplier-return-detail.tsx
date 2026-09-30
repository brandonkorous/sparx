'use client';

// ONE RETURN — put it together, send it, then chase the credit.
//
// Create and edit are the same surface, so `{id:'new'}` renders the same pane
// that `{id}` does.
//
// ── Nothing leaves the shelf until you say it has ─────────────────────────
//
// A draft is a list being assembled while the pallet is still in the building.
// Stock only moves on "It has gone back", which is a button of its own rather
// than a status dropdown — taking units off a shelf must not be reachable by
// editing a form.
//
// ── The credit is the point ───────────────────────────────────────────────
//
// Every line carries what you PAID for those units, because that is what you are
// owed. A return with no cost on it records the stock movement and quietly
// writes the money off, which is the exact failure this screen exists to stop —
// so the server refuses a line it cannot cost, and asks.

import { useEffect, useRef, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Text,
  Textarea,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import {
  faBan,
  faBoxOpen,
  faCirclePlus,
  faMoneyBill,
  faPaperPlane,
  faTrashCan,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { PANE_SHELL, PANE_SHELL_SCROLL } from '../../components/pane-toolbar';
import { useConfirm } from '../../lib/confirm';
import { afterCommit } from '../../lib/defer';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  formatCents,
  physicalLocations,
  plural,
  stockErrorMessage,
  useStockLocations,
} from './data';
import { formatMoment } from './purchase-orders-data';
import { useSuppliers, useVariantLookup } from './suppliers-data';
import {
  RETURN_REASONS,
  chaseTone,
  returnReasonLabel,
  returnReasonTone,
  returnStatusLabel,
  returnStatusTone,
  returnSettledTitle,
  returnClaimTitle,
  useCancelSupplierReturn,
  useCloseSupplierReturn,
  useCreateSupplierReturn,
  useRecordSupplierCredit,
  useSendSupplierReturn,
  useSupplierReturn,
  useUpdateSupplierReturn,
} from './supplier-returns-data';
import { moneyCents, moneyText, MoneyTextInput } from '../../components/money-input';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

interface DraftLine {
  variantId: string;
  sku: string;
  productTitle: string | null;
  quantity: number;
  /** Whole currency units as typed; blank means "work it out from what we
   *  paid", which the server does — and refuses if it cannot. */
  unitCost: string;
}

export function SupplierReturnDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = ctx.params.id ?? 'new';
  const isNew = id === 'new';

  const existing = useSupplierReturn(id);
  const data = existing.data;

  // The tab's name, once the record is here. Sixty-one of this console's
  // seventy-five detail panes do this; the ones that did not put identical
  // words on every tab they opened, which is the one thing the strip is for.
  // [[feedback_a_fix_leaves_its_neighbour_behind]]
  useEffect(() => {
    if (data) ctx.setTitle(data.number);
  }, [data, ctx]);

  if (isNew) return <NewReturn ctx={ctx} />;

  if (existing.isError) {
    return (
      <div className={PANE_SHELL}>
        <EmptyState
          icon={<Icon glyph={faBoxOpen} className="size-6" aria-hidden />}
          title="Could not load that return"
          description="This is a problem reaching the server, not a statement that the return is gone. Try again in a moment."
        />
      </div>
    );
  }
  if (existing.isLoading || !data) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting label="Loading the return…" />
      </div>
    );
  }

  return <ExistingReturn ctx={ctx} id={id} />;
}

/* ── Putting one together ───────────────────────────────────────────────── */

function NewReturn({ ctx }: { ctx: SurfaceContext }) {
  const suppliers = useSuppliers({ includeArchived: false, take: 250, skip: 0 });
  const locations = useStockLocations();
  // Somewhere a pallet can physically leave from. "In transit" is a bucket,
  // not a loading bay, and it sat in this list between the two real ones.
  const activeLocations = physicalLocations(locations.data?.items ?? []);

  const create = useCreateSupplierReturn();
  const lookup = useVariantLookup();
  const toast = useToast();

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState<string>('damaged');
  const [rmaNumber, setRmaNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [skuInput, setSkuInput] = useState('');
  // The location the console filled in, when there was only one to fill in.
  // Choosing a different one is her work; accepting the only answer there is is
  // not, and a form she never touched must close without a question.
  const defaultWarehouseRef = useRef('');

  // ONLY when there is one, which is what the note above always said and what
  // the code never did: it filled in whichever location sorted first. A shop
  // with a shop floor and a stockroom got "Fulfillment Center" pre-chosen over
  // "Main Warehouse" purely on the alphabet, and sending a return out of the
  // wrong place takes the stock off the wrong shelf. With more than one, she
  // picks. (`bin-detail` next door has had this right all along.)
  useEffect(() => {
    if (warehouseId === '' && activeLocations.length === 1) {
      const only = activeLocations[0]?.id ?? '';
      setWarehouseId(only);
      defaultWarehouseRef.current = only;
    }
  }, [activeLocations, warehouseId]);

  // What is on screen, against what was put there. The flag used to be sticky:
  // any keystroke set it and only a save cleared it, so emptying a box again
  // still left the pane claiming unsaved work (issue 507). `!create.isSuccess`
  // because this pane replaces itself with the saved return the moment it
  // succeeds.
  const dirty =
    !create.isSuccess &&
    (supplierId !== '' ||
      warehouseId !== defaultWarehouseRef.current ||
      reason !== 'damaged' ||
      rmaNumber.trim() !== '' ||
      notes.trim() !== '' ||
      skuInput.trim() !== '' ||
      lines.length > 0);
  useDirtySource(dirty, 'This return has not been saved. Close it anyway?');

  const addLine = () => {
    const sku = skuInput.trim();
    if (sku === '') return;
    lookup.mutate(sku, {
      onSuccess: (found) => {
        setSkuInput('');
        setLines((current) => [
          ...current,
          {
            variantId: found.variantId,
            sku: found.sku,
            productTitle: found.productTitle,
            quantity: 1,
            unitCost: '',
          },
        ]);
      },
      onError: () => {
        afterCommit(() => {
          toast.add({
            title: 'No item with that code',
            description: `Nothing in your catalog is coded “${sku}”. Check the code and try again.`,
            type: 'error',
          });
        });
      },
    });
  };

  const canSave =
    supplierId !== '' &&
    warehouseId !== '' &&
    lines.length > 0 &&
    lines.every((l) => l.quantity > 0);

  const onSave = () => {
    create.mutate(
      {
        supplierId,
        warehouseId,
        reason,
        ...(rmaNumber.trim() ? { rmaNumber: rmaNumber.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          ...(line.unitCost.trim() !== '' && Number.isFinite(Number(line.unitCost))
            ? { unitCostCents: Math.round(Number(line.unitCost) * 100) }
            : {}),
        })),
      },
      {
        onSuccess: (saved) => {
          afterCommit(() => {
            toast.add({
              title: `${saved.number} put together`,
              description: `${formatCents(saved.creditExpectedCents, saved.currency)} to claim back. Nothing has left the shelf yet.`,
              type: 'success',
            });
          });
          ctx.open('inventory.supplier-returns.detail', { id: saved.id });
        },
        onError: (error) => {
          afterCommit(() => {
            toast.add({
              title: 'Could not save that return',
              description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
              type: 'error',
            });
          });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL_SCROLL}>
      <div className={COLUMN}>
        <Heading level={2} className="text-lg">
          Send something back to a supplier
        </Heading>

        <FormSection
          title="Who and where"
          description="Which supplier it goes back to, and which of your locations it is leaving."
        >
          <Field>
            <FieldLabel>Supplier</FieldLabel>
            <FieldControl
              render={
                <NativeSelect
                  color="module"
                  value={supplierId}
                  onChange={(event) => {
                    setSupplierId(event.target.value);
                  }}
                >
                  <option value="">Choose a supplier…</option>
                  {(suppliers.data?.items ?? []).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </NativeSelect>
              }
            />
          </Field>
          <Field>
            <FieldLabel>Leaving from</FieldLabel>
            <FieldControl
              render={
                <NativeSelect
                  color="module"
                  value={warehouseId}
                  onChange={(event) => {
                    setWarehouseId(event.target.value);
                  }}
                >
                  {/* A blank option, because nothing is chosen until she chooses
                      it. Without one a select holding '' still DRAWS the first
                      location, so the screen said "Fulfillment Center" while the
                      form held nothing and the button stayed greyed out with
                      nothing to say why. */}
                  <option value="">Choose a location…</option>
                  {activeLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </NativeSelect>
              }
            />
          </Field>
        </FormSection>

        <FormSection
          title="Why it is going back"
          description="This is what you will be quoting at them, and it is what their record is scored on."
        >
          <Field>
            <FieldLabel>Reason</FieldLabel>
            <FieldControl
              render={
                <NativeSelect
                  color="module"
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                  }}
                >
                  {RETURN_REASONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              }
            />
          </Field>
          <Field>
            <FieldLabel>Their return number</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  value={rmaNumber}
                  placeholder="RMA-4471"
                  onChange={(event) => {
                    setRmaNumber(event.target.value);
                  }}
                />
              }
            />
            <FieldDescription>
              Most suppliers will not take anything back without one. Leave it blank if they have
              not given you one yet. You can add it later.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Notes</FieldLabel>
            <FieldControl
              render={
                <Textarea
                  color="module"
                  rows={2}
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                  }}
                />
              }
            />
          </Field>
        </FormSection>

        <FormSection
          title="What is going back"
          description="Add each item by its code. Leave the cost blank and we will use what you paid."
        >
          <div className="flex items-end gap-2">
            <Field className="flex-1">
              <FieldLabel>Item code</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={skuInput}
                    placeholder="SATCHEL-1"
                    onChange={(event) => {
                      setSkuInput(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      addLine();
                    }}
                  />
                }
              />
            </Field>
            <Button color="module" loading={lookup.isPending} onClick={addLine}>
              <Icon glyph={faCirclePlus} className="size-4" aria-hidden />
              Add
            </Button>
          </div>

          {lines.length === 0 ? (
            <Text className="text-sm">Nothing added yet.</Text>
          ) : (
            <Table size="sm">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="w-24 text-right">Going back</th>
                  <th className="w-32 text-right">Paid each</th>
                  <th className="w-0" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.variantId}:${index}`}>
                    <td className="w-full max-w-0 min-w-56">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{line.productTitle ?? 'Untitled product'}</span>
                        <span className="truncate font-mono text-sm">{line.sku}</span>
                      </span>
                    </td>
                    <td>
                      <Input
                        size="sm"
                        color="module"
                        type="number"
                        min={1}
                        aria-label={`How many ${line.sku} are going back`}
                        /* A WIDTH. The item cell beside this one is the give
                           cell — `w-full`, which in a table means "take whatever
                           is left" — so an unfloored number box beside it pays
                           the whole shortfall: measured at about 20px, showing a
                           sliver of the digit. A quantity you cannot read is not
                           a smaller field, it is a wrong one. Receiving and
                           recipes next door have carried `w-20`/`w-24` all
                           along. */
                        className="w-20 text-right tabular-nums"
                        value={line.quantity}
                        onChange={(event) => {
                          const quantity = Number.parseInt(event.target.value, 10);
                          setLines((current) =>
                            current.map((l, i) =>
                              i === index
                                ? { ...l, quantity: Number.isFinite(quantity) ? quantity : 1 }
                                : l
                            )
                          );
                        }}
                      />
                    </td>
                    <td>
                      <MoneyTextInput
                        size="sm"
                        color="module"
                        className="w-28"
                        placeholder="What you paid"
                        aria-label={`What you paid for each ${line.sku}`}
                        text={line.unitCost}
                        onTextChange={(unitCost) => {
                          setLines((current) =>
                            current.map((l, i) => (i === index ? { ...l, unitCost } : l))
                          );
                        }}
                      />
                    </td>
                    <td className="w-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        color="danger"
                        aria-label={`Remove ${line.sku}`}
                        onClick={() => {
                          setLines((current) => current.filter((_, i) => i !== index));
                        }}
                      >
                        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </FormSection>

        <div className="flex flex-wrap items-center gap-2 pb-4">
          <Button color="module" disabled={!canSave} loading={create.isPending} onClick={onSave}>
            Put the return together
          </Button>
          <Text className="text-sm">
            Nothing leaves the shelf yet. You send it on the next screen.
          </Text>
        </div>
      </div>
    </div>
  );
}

/* ── Working an existing one ────────────────────────────────────────────── */

/**
 * A return that has stopped being a chase, and which of the three ways it
 * stopped. Absent while it is still open, which the card reads as "Waiting".
 */
function ExistingReturn({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const existing = useSupplierReturn(id);
  const update = useUpdateSupplierReturn(id);
  const send = useSendSupplierReturn(id);
  const credit = useRecordSupplierCredit(id);
  const close = useCloseSupplierReturn(id);
  const cancel = useCancelSupplierReturn(id);
  const confirm = useConfirm();
  const toast = useToast();

  const data = existing.data;
  const [creditAmount, setCreditAmount] = useState('');
  const [tracking, setTracking] = useState('');
  const [trackingDirty, setTrackingDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    setCreditAmount(moneyText(data.creditExpectedCents));
    setTracking(data.trackingNumber ?? '');
    setTrackingDirty(false);
  }, [data]);

  if (!data) return null;
  const settledTitle = returnSettledTitle(data.status);

  const fail = (title: string) => (error: unknown) => {
    afterCommit(() => {
      toast.add({
        title,
        description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
        type: 'error',
      });
    });
  };

  const onSend = async () => {
    const ok = await confirm({
      title: `Send ${data.number} back?`,
      description: `${plural(data.lines.length, 'item', 'items')} will come off the shelf at ${data.warehouseName ?? 'this location'}, and ${formatCents(data.creditExpectedCents, data.currency)} goes on the list of what this supplier owes you. This cannot be undone from here: a mistake is corrected with a count.`,
      confirmLabel: 'It has gone back',
      cancelLabel: 'Not yet',
      color: 'warning',
    });
    if (!ok) return;
    send.mutate(undefined, {
      onSuccess: () => {
        afterCommit(() => {
          toast.add({
            title: `${data.number} sent`,
            description: `${formatCents(data.creditExpectedCents, data.currency)} now owed by ${data.supplierName ?? 'the supplier'}.`,
            type: 'success',
          });
        });
      },
      onError: fail('Could not send that return'),
    });
  };

  const onCredit = () => {
    // Read the way a person writes money — "1,250.00", "$8.00" (issue 486).
    const creditReceivedCents = creditAmount.trim() === '' ? null : moneyCents(creditAmount);
    if (creditReceivedCents === null) return;
    credit.mutate(
      { creditReceivedCents },
      {
        onSuccess: (saved) => {
          afterCommit(() => {
            toast.add({
              title: 'Credit recorded',
              description:
                (saved.creditShortfallCents ?? 0) > 0
                  ? `${formatCents(saved.creditShortfallCents ?? 0, saved.currency)} less than expected: worth querying.`
                  : 'Settled in full.',
              type: (saved.creditShortfallCents ?? 0) > 0 ? 'warning' : 'success',
            });
          });
        },
        onError: fail('Could not record that credit'),
      }
    );
  };

  const onClose = async () => {
    const ok = await confirm({
      title: `Write off ${formatCents(data.creditExpectedCents, data.currency)}?`,
      description:
        'This says you have accepted that no credit is coming. The return stays on the record, and the money stops being chased.',
      confirmLabel: 'Write it off',
      cancelLabel: 'Keep chasing',
      color: 'danger',
    });
    if (!ok) return;
    close.mutate('No credit expected: written off.', {
      onSuccess: () => {
        afterCommit(() => {
          toast.add({ title: `${data.number} written off`, type: 'info' });
        });
      },
      onError: fail('Could not close that return'),
    });
  };

  const onCancel = async () => {
    const ok = await confirm({
      title: `Abandon ${data.number}?`,
      description: 'Nothing has left the shelf, so nothing needs putting back. The record stays.',
      confirmLabel: 'Abandon it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    cancel.mutate(undefined, {
      onSuccess: () => {
        afterCommit(() => {
          toast.add({ title: `${data.number} abandoned`, type: 'info' });
        });
        ctx.close();
      },
      onError: fail('Could not abandon that return'),
    });
  };

  const onSaveTracking = () => {
    update.mutate(
      { trackingNumber: tracking.trim() === '' ? null : tracking.trim() },
      {
        onSuccess: () => {
          setTrackingDirty(false);
          afterCommit(() => {
            toast.add({ title: 'Tracking saved', type: 'success' });
          });
        },
        onError: fail('Could not save that tracking number'),
      }
    );
  };

  return (
    <div className={PANE_SHELL_SCROLL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={2} className="text-lg">
          <span className="font-mono">{data.number}</span> · {data.supplierName ?? 'Supplier'}
        </Heading>
        <div className="flex items-center gap-2">
          <Badge color={returnReasonTone(data.reason)} variant="soft">
            {returnReasonLabel(data.reason)}
          </Badge>
          <Badge color={returnStatusTone(data.status)} variant="soft">
            {returnStatusLabel(data.status)}
          </Badge>
        </div>
      </div>

      <Stats className="grid grid-cols-1 gap-2 px-2 py-1 @2xl:grid-cols-3">
        <Stat>
          {/* NOT a fixed string. `creditExpectedCents` is the size of the
              CLAIM and never moves; whether she is still OWED it does. This
              card read "You are owed $18.00" beside a card reading "settled in
              full", sending her to chase money that had already arrived. The
              stat on the right had been taught this and its two neighbours had
              not. */}
          <StatTitle>{returnClaimTitle(data.status)}</StatTitle>
          <StatValue>{formatCents(data.creditExpectedCents, data.currency)}</StatValue>
          <StatDesc>at what you paid for these units</StatDesc>
        </Stat>
        <Stat>
          <StatTitle>They have credited</StatTitle>
          {/* NULL is not zero. "Waiting" and "they gave us nothing" are
              different facts and only one of them should stop the chasing. */}
          <StatValue>
            {data.creditReceivedCents === null
              ? 'Nothing yet'
              : formatCents(data.creditReceivedCents, data.currency)}
          </StatValue>
          <StatDesc>
            {data.creditReceivedCents === null
              ? 'no credit note recorded'
              : (data.creditShortfallCents ?? 0) > 0
                ? `${formatCents(data.creditShortfallCents ?? 0, data.currency)} short`
                : 'settled in full'}
          </StatDesc>
        </Stat>
        <Stat>
          {/* THREE DIFFERENT FACTS USED TO SHARE ONE HEADING. `awaitingCreditDays`
              goes null the moment a credit is recorded, and this card then fell
              back to the time the goods LEFT — under the word "Waiting". A return
              settled in full read "Waiting · 39 seconds ago", which is neither the
              right label nor the right moment. `resolvedAt` is when it actually
              finished, and it was being fetched into both consoles and drawn by
              nothing. [[feedback_fetched_but_never_rendered]] */}
          <StatTitle>{settledTitle ?? 'Waiting'}</StatTitle>
          <StatValue>
            {settledTitle !== null ? (
              formatMoment(data.resolvedAt)
            ) : data.awaitingCreditDays === null ? (
              data.sentAt ? (
                <Timestamp value={data.sentAt} format="relative" />
              ) : (
                'Not sent'
              )
            ) : (
              <Badge color={chaseTone(data.awaitingCreditDays)} variant="soft">
                {plural(data.awaitingCreditDays, 'day', 'days')}
              </Badge>
            )}
          </StatValue>
          <StatDesc>{data.rmaNumber ? `their ref ${data.rmaNumber}` : 'no return number'}</StatDesc>
        </Stat>
      </Stats>

      {data.status === 'sent' && (data.awaitingCreditDays ?? 0) >= 30 ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>This has been outstanding for over a month</AlertTitle>
            <AlertDescription>
              Most suppliers&apos; own terms say a credit should have been issued by now. Either
              chase it, or write it off deliberately so it stops sitting on your list.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {/* `shrink-0`: this pane is one scrolling COLUMN, and a card that may
          shrink absorbs the whole overflow — squashing the lines to a couple of
          rows while the column itself never scrolls. */}
      <Card className="shrink-0 overflow-x-auto">
        <Table size="sm">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right whitespace-nowrap">Quantity</th>
              <th className="text-right whitespace-nowrap">Paid each</th>
              <th className="text-right whitespace-nowrap">Worth</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.id}>
                <td className="w-full max-w-0 min-w-56">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{line.productTitle ?? 'Untitled product'}</span>
                    <span className="truncate text-sm">
                      <span className="font-mono">{line.variantSku ?? 'No code'}</span>
                      {line.lotNumber ? ` · batch ${line.lotNumber}` : ''}
                    </span>
                  </span>
                </td>
                <td className="text-right tabular-nums">{line.quantity}</td>
                <td className="text-right tabular-nums">
                  {formatCents(line.unitCostCents, data.currency)}
                </td>
                <td className="text-right tabular-nums">
                  {formatCents(line.lineTotalCents, data.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {data.status === 'draft' ? (
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <Button
            color="warning"
            loading={send.isPending}
            onClick={() => {
              void onSend();
            }}
          >
            <Icon glyph={faPaperPlane} className="size-4" aria-hidden />
            It has gone back
          </Button>
          <Button
            className="ml-auto"
            variant="outline"
            color="danger"
            loading={cancel.isPending}
            onClick={() => {
              void onCancel();
            }}
          >
            <Icon glyph={faBan} className="size-4" aria-hidden />
            Abandon
          </Button>
        </div>
      ) : null}

      {data.status === 'sent' ? (
        <Card className="flex flex-col gap-3 p-3">
          <Heading level={3} className="text-base">
            When the credit comes
          </Heading>
          <div className="flex flex-wrap items-end gap-2">
            <Field className="max-w-48">
              <FieldLabel>They credited</FieldLabel>
              <FieldControl
                render={
                  <MoneyTextInput
                    color="module"
                    aria-label="What they credited you"
                    text={creditAmount}
                    onTextChange={setCreditAmount}
                  />
                }
              />
            </Field>
            <Button color="success" loading={credit.isPending} onClick={onCredit}>
              <Icon glyph={faMoneyBill} className="size-4" aria-hidden />
              Record the credit
            </Button>
            <Button
              className="ml-auto"
              variant="outline"
              color="danger"
              loading={close.isPending}
              onClick={() => {
                void onClose();
              }}
            >
              Write it off
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Field className="max-w-64">
              <FieldLabel>Tracking number</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={tracking}
                    placeholder="Added after the carrier collects"
                    onChange={(event) => {
                      setTracking(event.target.value);
                      setTrackingDirty(true);
                    }}
                  />
                }
              />
            </Field>
            <Button
              variant="outline"
              color="module"
              disabled={!trackingDirty}
              loading={update.isPending}
              onClick={onSaveTracking}
            >
              Save
            </Button>
          </div>
        </Card>
      ) : null}

      {data.notes ? <Text className="text-sm">{data.notes}</Text> : null}
    </div>
  );
}
