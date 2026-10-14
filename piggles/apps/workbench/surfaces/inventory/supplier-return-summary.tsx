'use client';

// What an existing return is worth: the claim, the credit so far, how long it
// has waited, and the lines it is made of.

import {
  Badge,
  Card,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Timestamp,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { formatCents, plural } from './data';
import { formatMoment } from './purchase-orders-data';
import { chaseTone, returnClaimTitle, type SupplierReturnDetail } from './supplier-returns-data';

interface DataProps {
  data: SupplierReturnDetail;
}

export function ReturnStats({ data, settledTitle }: DataProps & { settledTitle: string | null }) {
  return (
    <Stats className="grid grid-cols-1 gap-2 px-2 py-1 @2xl:grid-cols-3">
      <ClaimStat data={data} />
      <CreditedStat data={data} />
      <WaitingStat data={data} settledTitle={settledTitle} />
    </Stats>
  );
}

function ClaimStat({ data }: DataProps) {
  return (
    <Stat>
      {/* NOT a fixed string. `creditExpectedCents` is the size of the CLAIM and
          never moves; whether she is still OWED it does. A fixed "You are owed"
          sat beside "settled in full", sending her to chase money already paid. */}
      <StatTitle>{returnClaimTitle(data.status)}</StatTitle>
      <StatValue>{formatCents(data.creditExpectedCents, data.currency)}</StatValue>
      <StatDesc>at what you paid for these units</StatDesc>
    </Stat>
  );
}

function CreditedStat({ data }: DataProps) {
  return (
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
  );
}

function WaitingStat({ data, settledTitle }: DataProps & { settledTitle: string | null }) {
  return (
    <Stat>
      {/* Three different facts once shared the heading "Waiting", so a return
          settled in full read "Waiting · 39 seconds ago". `resolvedAt` is when it
          actually finished. [[feedback_fetched_but_never_rendered]] */}
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
  );
}

export function ReturnLinesCard({ data }: DataProps) {
  return (
    // `shrink-0`: this pane is one scrolling COLUMN, and a card that may shrink
    // absorbs the whole overflow, squashing the lines while the column never scrolls.
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
  );
}
