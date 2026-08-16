'use client';

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
  EmptyState,
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
import { faBan, faBoxCheck, faBoxMagnifyingGlass } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { useConfirm } from '../../lib/confirm';
import { afterCommit } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural, stockErrorMessage } from './data';
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

  const notice = useAdvanceShipNotice(id);
  const cancel = useCancelAsn();
  const confirm = useConfirm();
  const toast = useToast();

  const data = notice.data;

  const onCancel = async () => {
    if (!data) return;
    const ok = await confirm({
      title: `Mark ${data.number} as not coming?`,
      description:
        'The record stays — a notice that was given and then withdrawn is evidence of a promise. What changes is that it stops appearing as something you are waiting for.',
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
    return (
      <div className={PANE_SHELL}>
        <EmptyState
          icon={<Icon glyph={faBoxMagnifyingGlass} className="size-6" aria-hidden />}
          title="Could not load that shipment"
          description="This is a problem reaching the server, not a statement that the shipment is gone. Try again in a moment."
        />
      </div>
    );
  }
  if (notice.isLoading || !data) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting label="Loading the shipment…" />
      </div>
    );
  }

  const shortLines = data.lines.filter(
    (line) => line.discrepancyUnits !== null && line.discrepancyUnits < 0
  ).length;

  return (
    <div className={`${PANE_SHELL} overflow-y-auto`}>
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
              <Icon glyph={faBan} className="size-4" aria-hidden />
              Not coming
            </Button>
          ) : null}
        </div>
      </div>

      <Stats className="w-full">
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
            {data.expectedArrivalAt ? (
              <Timestamp value={data.expectedArrivalAt} format="relative" />
            ) : (
              'No date'
            )}
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
        <Alert color="info" variant="soft">
          <AlertContent>
            <AlertTitle>Nothing has been checked in against this yet</AlertTitle>
            <AlertDescription>
              The quantities below are what the supplier SAYS is on the way. Nothing has been
              compared, because nothing has arrived — book the delivery in and this screen will tell
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
                ? `${plural(shortLines, 'line', 'lines')} came in short of the notice. Check the invoice before it is paid — this is exactly the gap that gets billed for.`
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
                <td className="w-full max-w-0">
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
                <td className="text-right tabular-nums">{line.quantityReceived}</td>
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
            <Icon glyph={faBoxCheck} className="size-4" aria-hidden />
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
