'use client';

// WHAT THEY'RE PAID — the rate history, and adding the next one.
//
// A raise is a NEW rate, never an edit. Editing yesterday's rate would rewrite
// the cost of every job this person has ever worked, and last quarter's profit
// would move for a reason nothing on any screen could explain.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import { FormSection } from '../../components/form-section';
import { useConfirm } from '../../lib/confirm';
import { isForbidden, staffErrorMessage, useDeleteRate, usePayRates } from './data';
import { basisLabel, formatDate, rateAmountLabel, rateWindowLabel } from './format';
import { NewRateForm } from './person-pay-form';

export function PaySection({
  staffMemberId,
  canSeePay,
}: {
  staffMemberId: string;
  canSeePay: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const rates = usePayRates(staffMemberId, canSeePay);
  const removeRate = useDeleteRate();
  const [adding, setAdding] = useState(false);

  const forbidden = !canSeePay || isForbidden(rates.error);

  const drop = async (id: string, label: string) => {
    const ok = await confirm({
      title: 'Remove this rate?',
      description: `This deletes the ${label} rate outright. If they simply stopped earning it, set an end date instead — deleting it removes the ability to explain any cost already worked out from it.`,
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    removeRate.mutate(id, {
      onError: (error) => {
        toast.add({
          title: 'Could not remove that rate',
          description: staffErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  if (forbidden) {
    return (
      <FormSection title="What they're paid">
        <Alert color="info">
          <AlertContent>
            <AlertTitle>Only an account admin can see pay</AlertTitle>
            <AlertDescription>
              Rates, documents and commission are limited to admins and owners. This person may well
              have a rate on file — you are not able to see it.
            </AlertDescription>
          </AlertContent>
        </Alert>
      </FormSection>
    );
  }

  const items = rates.data?.items ?? [];
  const current = items.find((rate) => rate.effectiveTo === null);

  return (
    <FormSection
      title="What they're paid"
      description="A raise is a new rate, not an edit — so what a job cost last March still explains itself."
      action={
        adding ? null : (
          <Button
            size="sm"
            variant="outline"
            color="module"
            onClick={() => {
              setAdding(true);
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            New rate
          </Button>
        )
      }
    >
      {rates.isPending ? (
        <Text className="text-sm">Loading…</Text>
      ) : items.length === 0 && !adding ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>No pay rate on file</AlertTitle>
            <AlertDescription>
              Until there is one, this person’s hours are counted but never costed — they show up as
              unpriced on the timesheet rather than as free labour.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {current ? (
        <div className="border-base-300 rounded-box flex items-center justify-between gap-3 border p-3">
          <div className="min-w-0">
            <div className="font-medium">{rateAmountLabel(current.basis, current.amountCents)}</div>
            <Text className="text-sm">
              {basisLabel(current.basis)} · from {formatDate(current.effectiveFrom)}
              {current.basis === 'commission' && current.commissionPercent > 0
                ? ` · ${String(current.commissionPercent)}% of each sale`
                : ''}
              {current.burdenPercent > 0
                ? ` · plus ${String(current.burdenPercent)}% employer costs`
                : ''}
            </Text>
          </div>
          <Badge color="success" size="sm">
            In force
          </Badge>
        </div>
      ) : null}

      {adding ? (
        <NewRateForm
          staffMemberId={staffMemberId}
          onCancel={() => {
            setAdding(false);
          }}
        />
      ) : null}

      {items.length > 0 ? (
        <Table size="sm">
          <thead>
            <tr>
              <th>Rate</th>
              <th>Applies</th>
              <th className="hidden @lg:table-cell">Note</th>
              <th className="text-right" />
            </tr>
          </thead>
          <tbody>
            {items.map((rate) => (
              <tr key={rate.id}>
                <td className="font-medium tabular-nums">
                  {rateAmountLabel(rate.basis, rate.amountCents, rate.currency)}
                </td>
                <td className="text-sm">{rateWindowLabel(rate.effectiveFrom, rate.effectiveTo)}</td>
                <td className="hidden text-sm @lg:table-cell">{rate.note ?? '—'}</td>
                <td className="text-right">
                  <Button
                    size="xs"
                    variant="ghost"
                    color="danger"
                    aria-label="Remove this rate"
                    onClick={() => {
                      void drop(rate.id, rateAmountLabel(rate.basis, rate.amountCents));
                    }}
                  >
                    <Icon glyph={faTrashCan} className="size-4" aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </FormSection>
  );
}
