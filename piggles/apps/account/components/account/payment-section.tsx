import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { PRICE_MONTHLY } from '@piggles/config/pricing';
import { openPortalAction, startCheckoutAction } from '@/app/account/billing-actions';
import type { BillingSummary, OfferStanding } from '@/lib/billing';
import type { PlanState } from '@/lib/plan-state';

const dollars = (cents: number): string => `$${String(Math.round(cents / 100))}`;

/** The founding offer, while places are left, said with the numbers in it. */
function OfferLine({ offer, baseCents }: { offer: OfferStanding; baseCents: number }) {
  if (offer.remaining <= 0) return null;
  return (
    <p className="mt-3 max-w-prose text-base font-semibold">
      Add a card now and you pay {dollars(baseCents - offer.amountOffCents)} a month instead of{' '}
      {dollars(baseCents)}, for as long as you stay. {offer.remaining} of {offer.limit} founding
      places are left.
    </p>
  );
}

function PayButton({ billing }: { billing: BillingSummary }) {
  if (billing.subscribed && !billing.canManage) return null;
  return (
    <form action={billing.subscribed ? openPortalAction : startCheckoutAction} className="mt-4">
      <button className={buttonClasses({ color: 'primary', size: 'lg' })} type="submit">
        {billing.subscribed ? 'See invoices and change your card' : 'Add a card'}
      </button>
    </form>
  );
}

/** How this business pays: add a card, or manage the one on file. */
export function PaymentSection({
  plan,
  billing,
  mayPay,
}: {
  plan: PlanState;
  billing: BillingSummary | null;
  mayPay: boolean;
}) {
  const baseCents = billing?.baseMonthlyCents ?? PRICE_MONTHLY * 100;
  return (
    <div className="border-base-300 mt-12 border-t pt-8">
      <h2 className="text-xl font-bold">Payment</h2>
      <p className="mt-2 max-w-prose text-base">{plan.payment}</p>
      {billing === null ? (
        <p className="mt-3 max-w-prose text-base">
          Payment details could not be loaded just now. Reload this page in a minute to add or
          change a card.
        </p>
      ) : (
        <>
          {billing.offer ? <OfferLine offer={billing.offer} baseCents={baseCents} /> : null}
          {mayPay ? (
            <PayButton billing={billing} />
          ) : (
            <p className="mt-3 max-w-prose text-base">
              Only the owner or an admin of this business can add or change the card.
            </p>
          )}
        </>
      )}
    </div>
  );
}
