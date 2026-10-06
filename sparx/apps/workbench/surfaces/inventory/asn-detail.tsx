'use client';

import { useEffect } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';

// ONE SHIPMENT — what they said, and what actually turned up.
//
// ── Three states of "did it match", not two ───────────────────────────────
//
// Before anything is booked in there is NO discrepancy — not a zero, not a
// match. Nobody has opened the pallet, so the software has nothing to say, and
// printing "matched" there would be a claim about an unopened box. Once the
// delivery is booked, every line reads short, over, or matched.
//
// ── Lines cannot be edited ────────────────────────────────────────────────
//
// Deliberately. This document is the supplier's statement of what they sent, and
// the only thing it is good for is being compared against reality. Letting
// somebody quietly rewrite the claim to match the delivery would destroy the one
// piece of evidence in the transaction.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Heading,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Table,
  Text,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { PackageCheck, Ban } from 'lucide-react';
import { PANE_SHELL, PANE_SHELL_SCROLL } from '../../components/pane-toolbar';
import { useConfirm } from '../../lib/confirm';
import { afterCommit } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural, stockErrorMessage } from './data';
import { dayCountLabel } from './purchase-orders-data';
import { useBusinessZone } from '../../lib/business-timezone';
import { daysUntilDue } from '../../lib/console/days';
import {
  asnSourceLabel,
  asnStatusLabel,
  asnStatusTone,
  discrepancyLabel,
  discrepancyTone,
  useAdvanceShipNotice,
  useCancelAsn,
} from './advance-ship-notices-data';

export function AsnDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = ctx.params.id ?? '';
  // Calendar days in the SHOP's own zone, never elapsed hours on whichever
  // clock the reader happens to be near. `lib/console/days.ts` is the rule.
  const zone = useBusinessZone();
  const now = new Date();

  const notice = useAdvanceShipNotice(id);
  const cancel = useCancelAsn();
  const confirm = useConfirm();
  const toast = useToast();

  const data = notice.data;

  // The tab's name, once the record is here. Sixty-one of this console's
  // seventy-five detail panes do this; the ones that did not put identical
  // words on every tab they opened, which is the one thing the strip is for.
  // [[feedback_a_fix_leaves_its_neighbour_behind]]
  useEffect(() => {
    if (data) ctx.setTitle(data.number);
  }, [data, ctx]);

  const onCancel = async () => {
    if (!data) return;
    const ok = await confirm({
      title: `Mark ${data.number} as not coming?`,
      description:
        'The record stays: a notice that was given and then withdrawn is evidence of a promise. What changes is that it stops appearing as something you are waiting for.',
      confirmLabel: 'It is not coming',
      cancelLabel: 'Keep waiting',
      color: 'danger',
    });
    if (!ok) return;
    cancel.mutate(data.id, {
      onSuccess: () => {
        afterCommit(() => {
          toast.add({ title: `${data.number} marked as not coming`, type: 'info' });
        });
      },
      onError: (error) => {
        afterCommit(() => {
          toast.add({
            title: 'Could not update that shipment',
            description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
            type: 'error',
          });
        });
      },
    });
  };

  if (notice.isError) {
    // A 404 (removed, or another business's id) and a failed request say
    // different things; the shared screen reads which from the error rather
    // than calling every one a connection problem (persona issue 226).
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          error={notice.error}
          noun="shipment"
          title="Could not load that shipment"
          description="This is a problem reaching the server. The shipment itself is unaffected. Try again in a moment."
          onRetry={() => {
            void notice.refetch();
          }}
        />
      </div>
    );
  }
  if (notice.isLoading || !data) {
    return (
      <div className={PANE_SHELL}>
        <p className="p-4 text-base" role="status">
          Loading the shipment…
        </p>
      </div>
    );
  }

  const shortLines = data.lines.filter(
    (line) => line.discrepancyUnits !== null && line.discrepancyUnits < 0
  ).length;

  return (
    <div className={PANE_SHELL_SCROLL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={2} className="text-lg">
          <span className="font-mono">{data.number}</span> · {data.supplierName ?? 'Supplier'}
        </Heading>
        <div className="flex items-center gap-2">
          <Badge color={asnStatusTone(data)} variant="soft">
            {asnStatusLabel(data)}
          </Badge>
          {data.status === 'expected' ? (
            <Button
              size="sm"
              variant="outline"
              color="danger"
              loading={cancel.isPending}
              onClick={() => {
                void onCancel();
              }}
            >
              <Ban className="size-4" aria-hidden />
              Not coming
            </Button>
          ) : null}
        </div>
      </div>

      <Stats className="grid grid-cols-1 gap-2 px-2 py-1 @2xl:grid-cols-3">
        <Stat>
          <StatTitle>They say they sent</StatTitle>
          <StatValue>{data.unitsShipped}</StatValue>
          <StatDesc>
            {data.packageCount === null
              ? 'units'
              : `units in ${plural(data.packageCount, 'package', 'packages')}`}
          </StatDesc>
        </Stat>
        <Stat>
          <StatTitle>Expected</StatTitle>
          <StatValue className={data.isOverdue ? 'text-danger' : undefined}>
            {/* A DAY, counted in days. Not `<Timestamp format="relative">`,
                which reads a day stored at UTC midnight as an instant on the
                reader's clock (issue 885). */}
            {dayCountLabel(daysUntilDue(data.expectedArrivalAt, now, zone), 'No date')}
          </StatValue>
          <StatDesc>
            {data.shippedAt ? (
              <>
                Left <Timestamp value={data.shippedAt} format="relative" />
              </>
            ) : (
              'No dispatch date given'
            )}
          </StatDesc>
        </Stat>
        <Stat>
          <StatTitle>Against order</StatTitle>
          <StatValue className="font-mono text-lg">{data.purchaseOrderNumber ?? '—'}</StatValue>
          <StatDesc>{asnSourceLabel(data.source)}</StatDesc>
        </Stat>
      </Stats>

      {/* Three genuinely different banners for three genuinely different
          situations. The third — nothing booked in yet — is the one a naive
          screen would render as a green tick. */}
      {data.hasDiscrepancy === null ? (
        <Alert color="info">
          <AlertContent>
            <AlertTitle>Nothing has been checked in against this yet</AlertTitle>
            <AlertDescription>
              The quantities below are what the supplier SAYS is on the way. Nothing has been
              compared, because nothing has arrived: book the delivery in and this screen will tell
              you, line by line, whether it agreed.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : data.hasDiscrepancy ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>What arrived does not match what they said</AlertTitle>
            <AlertDescription>
              {shortLines > 0
                ? `${plural(shortLines, 'line', 'lines')} came in short of the notice. Check the invoice before it is paid. This is exactly the gap that gets billed for.`
                : 'More arrived than the notice claimed. Worth checking before it is paid for twice.'}
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : (
        <Alert color="success" variant="soft">
          <AlertContent>
            <AlertTitle>What arrived matched the notice</AlertTitle>
            <AlertDescription>
              Every line came in at the quantity they said it would.
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}

      <Card className="min-h-0 overflow-x-auto">
        <Table size="sm">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right whitespace-nowrap">On order</th>
              <th className="text-right whitespace-nowrap">They sent</th>
              <th className="text-right whitespace-nowrap">Arrived</th>
              <th className="whitespace-nowrap">Match</th>
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
                <td className="text-right tabular-nums">{line.quantityOrdered}</td>
                <td className="text-right tabular-nums">{line.quantityShipped}</td>
                {/* What arrived on THIS delivery, not what the order line has
                    taken in over its life — the second is what made a perfectly
                    matched second notice read "4 more than the notice". */}
                <td className="text-right tabular-nums">
                  {line.quantityArrivedOnThisDelivery ?? '—'}
                </td>
                <td className="whitespace-nowrap">
                  <Badge color={discrepancyTone(line.discrepancyUnits)} variant="soft" size="sm">
                    {discrepancyLabel(line.discrepancyUnits)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {data.status === 'expected' ? (
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <Button
            color="module"
            onClick={() => {
              // The receipt screen takes the notice's id and pre-fills from it.
              // A read, then a person confirms — the software never books what
              // the supplier claimed on its own.
              ctx.open('inventory.receiving.detail', {
                id: 'new',
                purchaseOrderId: data.purchaseOrderId,
                advanceShipNoticeId: data.id,
              });
            }}
          >
            <PackageCheck className="size-4" aria-hidden />
            Book this delivery in
          </Button>
          <Text className="text-sm">
            The lines above are filled in for you; you confirm or correct what actually arrived.
          </Text>
        </div>
      ) : null}

      {data.notes ? <Text className="text-sm">{data.notes}</Text> : null}
    </div>
  );
}
