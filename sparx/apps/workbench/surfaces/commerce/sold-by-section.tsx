'use client';

// WHO SOLD IT — the staff module's functionality, showing up on a commerce pane.
//
// It lives here because an order is where the answer is known, and it wears
// STAFF's hue rather than commerce's: color follows functionality, not the pane
// (DESIGN.md, and the "Who bought it" block above it does the same for CRM).
//
// ── WHY THIS CONTROL HAD TO EXIST ────────────────────────────────────────────
// An order records no salesperson anywhere in the platform. A `Deal` carries
// `assignedRepId`; an `Order` carries nothing. So until somebody can say who
// sold it, an order can never earn anyone a commission whatever their rate says
// — the calculator, the ledger, the API and the person pane were all built and
// all inert for want of this one field.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ─────────────────────────────────────────
// Removing the credit does NOT delete the commission it produced. An earned
// commission is a record of what somebody was told they were owed, and having it
// vanish because a dropdown changed is how a paid row disappears from a payroll
// reconciliation. The confirm says so in those words.
//
// It is admin-only, because every `/v1/staff/sales/*` route is: pay is the one
// place the viewer/editor ladder is wrong (staff-context.ts). A viewer sees no
// section at all rather than a section that 403s.

import { useState } from 'react';
import { Button, Select, Text, useToast } from '@wizeworks/silicaui-react';
import { HandCoins, X } from 'lucide-react';

import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import {
  useAttributeSale,
  useClearSaleAttribution,
  useSaleAttribution,
  useStaffMembers,
  type SaleType,
} from '../staff/data';
import { formatCents, formatDay } from '../finance/format';
import { outcomeMessage, type OutcomeWords } from './sold-by-message';

/** The sentences live in a sibling `.ts` so they can be tested: a `.tsx` cannot
 *  be imported by vitest here. `words` carries the two formatters so that module
 *  stays free of the money and date helpers. */
const OUTCOME_WORDS: OutcomeWords = { cents: formatCents, day: formatDay };

export function SoldBySection({
  type,
  sourceId,
  canSeePay,
}: {
  type: SaleType;
  sourceId: string;
  /** Staff module on AND this viewer has pay access. Both, or no section. */
  canSeePay: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);

  const attribution = useSaleAttribution(type, sourceId, canSeePay);
  const people = useStaffMembers({ status: 'active' });
  const attribute = useAttributeSale(type, sourceId);
  const clear = useClearSaleAttribution(type, sourceId);

  if (!canSeePay) return null;

  const current = attribution.data ?? null;
  const roster = people.data?.items ?? [];

  const credit = (staffMemberId: string) => {
    const who = roster.find((m) => m.id === staffMemberId)?.name ?? 'They';
    setPending(true);
    attribute.mutate(
      { staffMemberId },
      {
        onSettled: () => {
          setPending(false);
        },
        onSuccess: (result) => {
          afterPaneChange(() => {
            toast.add({
              title: 'Sale credited',
              description: outcomeMessage(result.commission, who, OUTCOME_WORDS),
              type: result.commission.outcome === 'recorded' ? 'success' : 'info',
            });
          });
        },
        onError: () => {
          afterPaneChange(() => {
            toast.add({ title: 'That did not save', type: 'error' });
          });
        },
      }
    );
  };

  const remove = () => {
    void (async () => {
      const ok = await confirm({
        title: 'Remove the credit for this sale?',
        // Says exactly what survives. A confirm that only asks "are you sure"
        // leaves the reader to guess whether the money goes with it.
        description:
          'Nobody will be credited with selling this order. Any commission already earned on it stays on their record: void it from their pay page if that is what you mean.',
        confirmLabel: 'Remove credit',
        cancelLabel: 'Keep it',
        color: 'danger',
      });
      if (!ok) return;
      setPending(true);
      clear.mutate(undefined, {
        onSettled: () => {
          setPending(false);
        },
        onSuccess: () => {
          afterPaneChange(() => {
            toast.add({ title: 'Credit removed', type: 'success' });
          });
        },
      });
    })();
  };

  return (
    <ModuleScope module="staff">
      <FormSection
        title="Who sold it"
        description="Credit this sale to someone on your team. If they are paid on commission, theirs is worked out from it straight away."
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="min-w-56"
              aria-label="Who sold this order"
              disabled={pending || people.isPending}
              value={current?.staffMemberId ?? ''}
              onValueChange={(value) => {
                if (typeof value === 'string' && value) credit(value);
              }}
              items={[
                { value: '', label: 'Nobody yet' },
                ...roster.map((member) => ({ value: member.id, label: member.name })),
              ]}
            />
            {current ? (
              <Button size="sm" variant="ghost" color="danger" loading={pending} onClick={remove}>
                <X className="size-4" aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>

          {roster.length === 0 && !people.isPending ? (
            <Text className="text-base">
              Nobody is on your team yet. Add people under Your team, and they will appear here.
            </Text>
          ) : null}

          {current ? (
            <div className="flex items-center gap-2">
              <HandCoins className="text-module size-4" aria-hidden />
              <Text className="text-base">
                Credited to {current.staffMemberName ?? 'someone no longer on the team'}.
              </Text>
            </div>
          ) : null}
        </div>
      </FormSection>
    </ModuleScope>
  );
}
