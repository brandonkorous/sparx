'use client';

// COMMISSION — what they have earned on top of their wage.

import { Badge, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { FormSection } from '../../components/form-section';
import { isForbidden, useCommissions } from './data';
import { commissionState, formatCents, formatDate } from './format';

export function CommissionSection({
  staffMemberId,
  canSeePay,
}: {
  staffMemberId: string;
  canSeePay: boolean;
}) {
  const commissions = useCommissions({ staffMemberId }, canSeePay);
  if (!canSeePay || isForbidden(commissions.error)) return null;
  const items = commissions.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <FormSection title="Commission" description="What they have earned on top of their wage.">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {formatCents(commissions.data?.totalCents ?? 0)}
        </span>
        <Text className="text-sm">across {String(items.length)}</Text>
      </div>
      <Table size="sm">
        <thead>
          <tr>
            <th>What for</th>
            <th>Earned</th>
            <th>State</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const state = commissionState(row.status);
            return (
              <tr key={row.id}>
                <td className="max-w-48 truncate">{row.sourceLabel ?? row.sourceType}</td>
                <td className="whitespace-nowrap">{formatDate(row.earnedOn)}</td>
                <td>
                  <Badge color={state.tone} variant="soft" size="sm">
                    {state.label}
                  </Badge>
                </td>
                <td className="text-right font-medium tabular-nums">
                  {formatCents(row.amountCents, row.currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </FormSection>
  );
}
