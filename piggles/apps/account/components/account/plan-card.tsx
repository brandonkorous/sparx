import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { APP_COUNT_WORD } from '@piggles/config';
import { PRICE_MONTHLY } from '@piggles/config/pricing';
import type { BillingSummary } from '@/lib/billing';
import type { PlanState } from '@/lib/plan-state';

const dollars = (cents: number): string => `$${String(Math.round(cents / 100))}`;

/** What this business pays each month: the founding price once it holds one. */
export function PlanCard({ plan, billing }: { plan: PlanState; billing: BillingSummary | null }) {
  const baseCents = billing?.baseMonthlyCents ?? PRICE_MONTHLY * 100;
  const discount = billing?.discount ?? null;
  const pays = discount ? baseCents - discount.amountOffCents : baseCents;

  return (
    <Card>
      <CardBody>
        <h2 className="text-xl font-bold">Your plan</h2>
        <p className="mt-1 text-base">All {APP_COUNT_WORD} apps, one price.</p>
        <p className="mt-4 text-4xl font-extrabold">
          {dollars(pays)}
          <span className="text-base font-bold">/month</span>
        </p>
        {discount ? (
          <p className="mt-2 text-base">
            Founding member price, kept for as long as you stay. The usual price is{' '}
            {dollars(baseCents)}.
          </p>
        ) : null}
        <div className="mt-4">
          {/* `plan.tone` is undefined for states that want nothing: colorless. */}
          <Badge color={plan.tone} variant="soft" size="lg">
            {plan.label}
          </Badge>
        </div>
      </CardBody>
    </Card>
  );
}
