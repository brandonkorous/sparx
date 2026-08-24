'use client';

/**
 * Valuation as it stood at a moment in the past.
 *
 * Every other figure on this screen is about today, and today is the wrong day
 * for the two occasions this number is most often wanted: the year-end figure an
 * accountant asks for in March, and "what were we holding when this went wrong".
 * Both are answered by walking the movement and cost ledgers back to the moment
 * asked for — so any date works, not only dates somebody thought to snapshot.
 *
 * The uncosted count is shown rather than hidden. Stock the platform never
 * costed cannot be valued, and a valuation that silently treats it as worthless
 * is the kind of number an audit finds for you.
 */

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  DateInput,
  Text,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faCalendarClock } from '@fortawesome/pro-solid-svg-icons';
import { formatCents, plural } from './data';
import { useValuationAsOf, type AsOfValuation } from './costing-data';
import { InlineWaiting } from '../../components/inline-waiting';
import { NUMBER } from './reports-shared';
import { Figure, ReportCard } from './reports-card';

function UncostedNotice({ units }: { units: number }) {
  if (units === 0) return null;
  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>
          {plural(units, 'unit', 'units')} with no purchase behind{units === 1 ? ' it' : ' them'}
        </AlertTitle>
        <AlertDescription>
          Those units are counted but not valued, because nothing records what they cost — usually
          stock that was here before you started recording deliveries. The value above is everything
          else.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function AsOfRows({ data }: { data: AsOfValuation }) {
  if (data.rows.length === 0) return null;
  return (
    <Table size="sm">
      <thead>
        <tr>
          <th>Item</th>
          <th className="hidden @lg:table-cell">Where</th>
          <th className="hidden text-right @md:table-cell">Units</th>
          <th className="text-right whitespace-nowrap">Value</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.slice(0, 10).map((row) => (
          <tr key={`${row.variantId}:${row.warehouseId}`}>
            <td className="w-full max-w-0">
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{row.title ?? 'Untitled product'}</span>
                <span className="truncate font-mono text-sm">{row.sku ?? 'No code'}</span>
              </span>
            </td>
            <td className="hidden max-w-32 truncate @lg:table-cell">{row.warehouseCode}</td>
            <td className="hidden text-right tabular-nums @md:table-cell">
              {NUMBER.format(row.units)}
            </td>
            <td className="text-right font-medium tabular-nums">
              {formatCents(row.valueCents, data.currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function AsOfBody({ data }: { data: AsOfValuation }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
        <Figure
          tone="module"
          value={formatCents(data.totalValueCents, data.currency)}
          label="Value of the stock you held"
        />
        <Figure value={NUMBER.format(data.totalUnits)} label="Units on hand at that moment" />
      </div>
      <UncostedNotice units={data.uncostedUnits} />
      <AsOfRows data={data} />
    </>
  );
}

export function AsOfCard({ locationId }: { locationId: string }) {
  const [asOf, setAsOf] = useState<Date | null>(() => new Date());
  const report = useValuationAsOf(asOf ? asOf.toISOString() : '', locationId || undefined);

  return (
    <ReportCard
      title="What it was worth on a date"
      glyph={faCalendarClock}
      blurb="The figure an accountant asks for at year end. Worked out from your stock history, so any date works — not only the ones somebody remembered to record."
      aside={
        <DateInput
          color="module"
          value={asOf}
          aria-label="Value the stock as at this date"
          onValueChange={setAsOf}
        />
      }
    >
      {report.isError ? (
        <Text className="text-sm">
          Could not work that out just now. The rest of your figures are fine.
        </Text>
      ) : !report.data ? (
        <InlineWaiting label="Working it out…" />
      ) : (
        <AsOfBody data={report.data} />
      )}
    </ReportCard>
  );
}
