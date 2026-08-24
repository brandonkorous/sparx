'use client';

/**
 * Shrinkage — what left without being sold.
 *
 * Almost every business loses some stock and almost none of them can say where
 * it went, because the losses arrive one write-off at a time and are never added
 * up. The ledger has recorded each one all along; this is the first place they
 * are put together and priced.
 *
 * The rate is shown against the band businesses actually live in — 1–5% a year
 * is normal — so a merchant can tell whether their number is a problem or just a
 * number. Stock FOUND by counting is shown beside the losses rather than
 * subtracted from them: a business that finds as much as it loses has a counting
 * problem, not a theft problem, and netting to zero would hide both.
 */

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Text,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { formatCents, plural } from './data';
import { shrinkageReasonLabel, shrinkageTone, type ShrinkageReport } from './reports-data';
import { NUMBER, barWidthClass } from './reports-shared';
import { Figure, ReportCard } from './reports-card';

interface Modifiers {
  shiftKey: boolean;
  altKey: boolean;
}

function NothingMissing() {
  return (
    <Alert color="success" variant="soft">
      <AlertContent>
        <AlertTitle>Nothing has gone missing</AlertTitle>
        <AlertDescription>
          No losses, no breakages and no shortfalls at a count in this period. Everything that left
          was sold.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function ByReason({ report, currency }: { report: ShrinkageReport; currency: string }) {
  const peak = Math.max(1, ...report.byReason.map((r) => r.valueCents));
  return (
    <ul className="flex flex-col gap-3">
      {report.byReason.map((row) => (
        <li key={row.reason} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Text className="font-medium">{shrinkageReasonLabel(row.reason)}</Text>
            <Text className="text-sm tabular-nums">
              {formatCents(row.valueCents, currency)} · {plural(row.units, 'unit', 'units')} over{' '}
              {plural(row.movements, 'time', 'times')}
            </Text>
          </div>
          <div className="bg-base-200 h-2 w-full overflow-hidden rounded-full">
            <div
              className={`bg-danger h-full rounded-full ${barWidthClass(row.valueCents / peak)}`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function LostRow({
  item,
  currency,
  onOpen,
}: {
  item: ShrinkageReport['topVariants'][number];
  currency: string;
  onOpen: (variantId: string, event: Modifiers) => void;
}) {
  return (
    <tr
      className="hover:bg-base-200 cursor-pointer"
      tabIndex={0}
      onClick={(event) => {
        onOpen(item.variantId, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(item.variantId, { shiftKey: false, altKey: false });
      }}
    >
      <td className="max-w-56">
        <span className="block truncate font-medium">
          {item.productTitle ?? item.variantSku ?? 'Unnamed item'}
        </span>
        {item.variantSku ? <span className="text-sm">{item.variantSku}</span> : null}
      </td>
      <td className="text-right tabular-nums">{NUMBER.format(item.units)}</td>
      <td className="text-right tabular-nums">{formatCents(item.valueCents, currency)}</td>
    </tr>
  );
}

function WhereItWent({
  report,
  currency,
  onOpen,
}: {
  report: ShrinkageReport;
  currency: string;
  onOpen: (variantId: string, event: Modifiers) => void;
}) {
  if (report.topVariants.length === 0) return null;

  return (
    <div className="border-base-300 flex flex-col gap-2 border-t pt-3">
      <Text className="font-medium">Where most of it went</Text>
      <Table className="table-sm">
        <thead>
          <tr>
            <th>Item</th>
            <th className="text-right">Units</th>
            <th className="text-right">Cost to you</th>
          </tr>
        </thead>
        <tbody>
          {report.topVariants.slice(0, 8).map((item) => (
            <LostRow key={item.variantId} item={item} currency={currency} onOpen={onOpen} />
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function ShrinkageCard({
  report,
  currency,
  onOpen,
}: {
  report: ShrinkageReport;
  currency: string;
  onOpen: (variantId: string, event: Modifiers) => void;
}) {
  if (report.totalUnits === 0) return <NothingMissing />;
  const drifting = report.recountGainUnits > report.totalUnits * 0.5;

  return (
    <ReportCard
      title="What left without being sold"
      blurb="Losses, breakages and shortfalls found at a count — added up and priced at what they cost you."
      aside={
        report.percentOfValuation === null ? null : (
          <Badge color={shrinkageTone(report.percentOfValuation)} variant="soft">
            {report.percentOfValuation}% of your stock value
          </Badge>
        )
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Figure
          tone="danger"
          value={formatCents(report.totalValueCents, currency)}
          label={`${plural(report.totalUnits, 'unit', 'units')} written off`}
        />
        <Figure
          tone="success"
          value={formatCents(report.recountGainValueCents, currency)}
          label={`${plural(report.recountGainUnits, 'unit', 'units')} found at a count`}
        />
      </div>

      {drifting ? (
        <Text className="text-sm">
          You are finding almost as much as you lose, which usually means the counting is drifting
          rather than the stock walking. Counting more often, in smaller batches, fixes that.
        </Text>
      ) : null}

      <ByReason report={report} currency={currency} />
      <WhereItWent report={report} currency={currency} onOpen={onOpen} />
    </ReportCard>
  );
}
