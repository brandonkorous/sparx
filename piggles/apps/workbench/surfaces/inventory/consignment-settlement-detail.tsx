'use client';

// ONE SETTLEMENT PERIOD — what sold from somebody else's stock, and what it costs.
//
// A draft is a working document: re-derivable from the ledger, disposable, and
// owing nobody anything. Closing it turns it into a payable. That one-way step is
// the whole lifecycle, and the screen makes the difference obvious rather than
// hiding it behind a status pill.
//
// ── Why the lines are not blended ─────────────────────────────────────────
//
// The same item consigned at two agreed costs shows as two lines. A weighted
// average would produce a total that is right and a line the supplier cannot
// check against their own paperwork — and a settlement that cannot be checked is
// a settlement that gets disputed.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Text,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import {
  faArrowsRotate,
  faCheckDouble,
  faReceipt,
  faWallet,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { useEffect } from 'react';
import { FormSection } from '../../components/form-section';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { afterCommit } from '../../lib/defer';
import { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural, stockErrorMessage } from './data';

/** Registry module for this pane, so the brand draws Stock's own picture rather
 *  than the generic one. */
const MODULE = 'inventory';
import {
  settlementTone,
  useCancelSettlement,
  useCloseSettlement,
  useConsignmentSettlement,
  useMarkSettlementPaid,
  useRefreshSettlement,
} from './demand-data';

export function ConsignmentSettlementDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  const toast = useToast();
  const confirm = useConfirm();
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } =
    useConsignmentSettlement(id);
  const refresh = useRefreshSettlement(id);
  const close = useCloseSettlement(id);
  const pay = useMarkSettlementPaid(id);
  const cancel = useCancelSettlement(id);

  useEffect(() => {
    if (data) ctx.setTitle(data.number);
  }, [data, ctx]);

  // Both non-ready states fill the same card the settlement itself does, so the
  // pane does not go from a bare recessed surface to a grid of lifted panels as
  // the record arrives.
  if (isLoading) {
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 overflow-y-auto">
          <PaneWaiting module={MODULE} label="Loading the settlement…" />
        </Card>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 overflow-y-auto">
          <PaneLoadError
            module={MODULE}
            icon={<Icon glyph={faReceipt} className="size-6" aria-hidden />}
            title="Could not load that settlement"
            description="It may have been cancelled, or the server is unreachable. Nothing owed to anybody has changed."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  const isDraft = data.status === 'draft';
  const owner = data.supplierName ?? data.customerName ?? 'an unnamed owner';
  const fail = (title: string) => (error: unknown) => {
    afterCommit(() => {
      toast.add({
        title,
        description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
        type: 'error',
      });
    });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Settlement controls"
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
        status={
          <>
            <Badge color={settlementTone(data.status)} variant="soft">
              {data.status}
            </Badge>
            <Text className="text-sm">
              {owner} · <Timestamp value={data.periodStart} format="absolute" /> →{' '}
              <Timestamp value={data.periodEnd} format="absolute" />
            </Text>
          </>
        }
        primary={
          <>
            {isDraft ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  disabled={refresh.isPending}
                  onClick={() => {
                    refresh.mutate(undefined, {
                      onSuccess: () => {
                        afterCommit(() => {
                          toast.add({
                            title: 'Rebuilt from the ledger',
                            description: 'Any sale recorded since you opened this is now included.',
                            type: 'success',
                          });
                        });
                      },
                      onError: fail('Could not rebuild it'),
                    });
                  }}
                >
                  <Icon glyph={faArrowsRotate} className="size-4" aria-hidden />
                  Rebuild
                </Button>
                <Button
                  color="module-inventory"
                  size="sm"
                  disabled={close.isPending}
                  onClick={() => {
                    void confirm({
                      title: `Close ${data.number}?`,
                      description: `${formatCents(data.totalCents, data.currency)} becomes owed to ${owner}. A closed period cannot be edited or rebuilt — a later correction goes in the NEXT period, which is what lets them reconcile against their own paperwork.`,
                      confirmLabel: 'Close the period',
                      cancelLabel: 'Keep it as a draft',
                      color: 'warning',
                    }).then((confirmed) => {
                      if (!confirmed) return;
                      close.mutate(undefined, {
                        onSuccess: () => {
                          afterCommit(() => {
                            toast.add({
                              title: `${data.number} closed`,
                              description: `${formatCents(data.totalCents, data.currency)} owed to ${owner}.`,
                              type: 'success',
                            });
                          });
                        },
                        onError: fail('Could not close it'),
                      });
                    });
                  }}
                >
                  <Icon glyph={faCheckDouble} className="size-4" aria-hidden />
                  Close the period
                </Button>
              </>
            ) : null}
            {data.status === 'closed' || data.status === 'invoiced' ? (
              <Button
                color="success"
                variant="soft"
                size="sm"
                className="ml-auto"
                disabled={pay.isPending}
                onClick={() => {
                  pay.mutate(undefined, {
                    onSuccess: () => {
                      afterCommit(() => {
                        toast.add({ title: 'Marked as paid', type: 'success' });
                      });
                    },
                    onError: fail('Could not record that'),
                  });
                }}
              >
                <Icon glyph={faWallet} className="size-4" aria-hidden />
                Mark as paid
              </Button>
            ) : null}
          </>
        }
        controls={
          data.status !== 'paid' && data.status !== 'cancelled' ? (
            <Button
              color="danger"
              variant="soft"
              size="sm"
              disabled={cancel.isPending}
              onClick={() => {
                void confirm({
                  title: `Cancel ${data.number}?`,
                  description:
                    'The period stops being owed. The sales it covered go back to being unsettled, so they will appear in the next period you open.',
                  confirmLabel: 'Cancel it',
                  cancelLabel: 'Keep it',
                  color: 'danger',
                }).then((confirmed) => {
                  if (!confirmed) return;
                  cancel.mutate(undefined, {
                    onSuccess: () => {
                      afterCommit(() => {
                        toast.add({ title: `${data.number} cancelled`, type: 'info' });
                      });
                    },
                    onError: fail('Could not cancel it'),
                  });
                });
              }}
            >
              Cancel
            </Button>
          ) : null
        }
      />

      {/* The one thing that blocks closing, said plainly and only while it can
          still be acted on. */}
      {isDraft && data.unpricedUnits > 0 ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>
              {plural(data.unpricedUnits, 'unit', 'units')} sold with no cost recorded
            </AlertTitle>
            <AlertDescription>
              They are not in the total below, and they are not worth nothing — nobody has recorded
              what they cost. Closing now would pay {owner} short. Put a cost on those items, then
              rebuild.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <div className="grid gap-3 @3xl:grid-cols-3">
        <FormSection className="bg-module bg-soft" title="Owed for the period">
          <div>
            <Text className="text-2xl font-semibold tabular-nums">
              {formatCents(data.totalCents, data.currency)}
            </Text>
            <Text className="text-sm">
              {plural(data.unitsSold, 'unit', 'units')} across{' '}
              {plural(data.lines.length, 'line', 'lines')}
            </Text>
          </div>
        </FormSection>
        <FormSection title="Owner">
          <div>
            <Text>{owner}</Text>
            <Text className="text-sm">
              {data.ownerType === 'supplier' ? 'A supplier' : 'A customer'}
            </Text>
          </div>
        </FormSection>
        <FormSection title="Where it got to">
          <div className="flex flex-col gap-1">
            <Text className="text-sm">
              Closed:{' '}
              {data.closedAt ? <Timestamp value={data.closedAt} format="absolute" /> : 'not yet'}
            </Text>
            <Text className="text-sm">
              Billed:{' '}
              {data.invoicedAt ? (
                <Timestamp value={data.invoicedAt} format="absolute" />
              ) : (
                'not yet'
              )}
            </Text>
            <Text className="text-sm">
              Paid: {data.paidAt ? <Timestamp value={data.paidAt} format="absolute" /> : 'not yet'}
            </Text>
          </div>
        </FormSection>
      </div>

      <FormSection className="min-h-0 flex-1 overflow-auto" title="What sold">
        <div className="p-0">
          {data.lines.length === 0 ? (
            /* No extra card — the FormSection is one already, and this section is
               the pane's scrolling body, so its empty state gets the same
               treatment the pane's own states do. */
            <PaneEmpty
              module={MODULE}
              icon={<Icon glyph={faReceipt} className="size-6" aria-hidden />}
              title="Nothing sold in this period"
              description="No consigned stock of theirs moved between these dates. The period can still be closed at zero, which is a useful thing to be able to send."
            />
          ) : (
            <Table size="sm">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="hidden @lg:table-cell">Location</th>
                  <th className="text-right whitespace-nowrap">Units</th>
                  <th className="text-right whitespace-nowrap">Agreed cost</th>
                  <th className="text-right whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="w-full max-w-0">
                      <span className="truncate">
                        {line.variantName ?? line.variantSku ?? 'Unnamed item'}
                        {line.variantSku && line.variantName ? (
                          <span className="ml-1.5 font-mono text-sm">{line.variantSku}</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="hidden max-w-[12rem] truncate @lg:table-cell">
                      {line.warehouseName ?? '—'}
                    </td>
                    <td className="text-right tabular-nums">{line.unitsSold}</td>
                    <td className="text-right tabular-nums">
                      {formatCents(line.unitCostCents, data.currency)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCents(line.amountCents, data.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </FormSection>
    </div>
  );
}
