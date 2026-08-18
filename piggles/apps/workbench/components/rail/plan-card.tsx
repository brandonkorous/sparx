'use client';

// The account's own state, at the bottom of the rail.
//
// The console never knows a PRICE (piggles/CLAUDE.md RULE #2) — this says which
// phase the account is in and hands off to getpiggles.com, which owns every
// question it raises and is the only place allowed to answer them with numbers.

import { Button } from '@wizeworks/silicaui-react';
import { Mark } from '@piggles/brand/react';
import { useBill } from '@/surfaces/finance/bill-data';

/**
 * A WARNING, when the business is about to stop working. Never a plan card.
 *
 * ── THE LINE THIS DRAWS ─────────────────────────────────────────────────────
 *
 * Account management — the plan, the renewal date, payment methods, invoices,
 * capacity — belongs to getpiggles.com and never appears here
 * (piggles/CLAUDE.md, "The three surfaces"). This used to sit in the rail
 * permanently saying "Business plan · Renews 12 Jul", which is exactly that: a
 * standing account-management fixture in the operating workspace.
 *
 * What survives is the half that is operational rather than commercial. A trial
 * running out or a site already dark is something happening TO the workspace,
 * and the alternative to saying so is a trial that ends by the lights going out
 * with no explanation anywhere in the app. So: nothing at all while the account
 * is healthy, a warning when it is not, and the only action is a door OUT to the
 * app that owns the conversation.
 *
 * A door is not management. A number with a currency symbol in here would be.
 */
export function PlanCard({ accountOrigin }: { accountOrigin: string }) {
  const { data: bill } = useBill();

  // Nothing until the answer arrives. A card that says "Business plan" before it
  // knows the plan is a value nobody measured being rendered as one — and the
  // entire job of this card is telling somebody the truth about their account
  // before it stops working.
  if (!bill) return null;

  // ── ONLY THE PHASE VIEW IS READ ─────────────────────────────────────────────
  //
  // `Bill` also carries `planTotalCents`, `planModules` and a card's last four
  // digits. NONE of it is touched here and none of it may be: the console never
  // knows a price (piggles/CLAUDE.md RULE #2), and `bill.billing` is exactly the
  // lifecycle slice — phase, days left, dates — with no money in it.
  //
  // The cleaner long-term shape is a narrow account-service endpoint that
  // returns only this, so the console cannot fetch an amount even by accident.
  // Until that exists, the discipline is the destructure below: read `billing`,
  // never `bill` itself.
  const { phase, daysLeft } = bill.billing;
  const days = daysLeft ?? 0;

  // A healthy account has nothing to say here. Standing billing furniture in the
  // rail is account management, and account management lives at getpiggles.
  if (phase !== 'trialing' && phase !== 'grace' && phase !== 'suspended') return null;

  const tone: 'neutral' | 'warning' | 'danger' =
    phase === 'suspended' ? 'danger' : phase === 'grace' || days <= 3 ? 'warning' : 'neutral';

  const heading = phase === 'trialing' ? 'Free trial' : 'Action needed';

  const detail =
    phase === 'suspended'
      ? 'Your site is offline'
      : phase === 'grace'
        ? `Site stays live ${days} more day${days === 1 ? '' : 's'}`
        : `${days} day${days === 1 ? '' : 's'} left`;

  return (
    <div
      data-plan-tone={tone}
      className="rounded-box border-base-300 bg-neutral-dark mx-1 mb-2 border p-3"
    >
      <div className="flex items-center gap-2">
        <Mark className="text-primary size-5 shrink-0" />
        <span className="text-base font-bold">{heading}</span>
      </div>
      {/* A real ink, never faded — this is the line that tells somebody their
          business is about to stop working. */}
      <p className="mt-0.5 text-sm">{detail}</p>
      <Button
        // NO color on the calm one. Uncolored, a `.btn` resolves to
        // `base-content` and is right on this card in either theme; `neutral` is
        // theme-stable now because it paints the rail, so pinning it here would
        // put #52454f ink on a #1c212c card in dark. Same call close-band.tsx
        // makes, for the same reason.
        color={tone === 'neutral' ? undefined : tone}
        variant={tone === 'neutral' ? 'outline' : 'solid'}
        size="sm"
        block
        className="mt-2.5"
        onClick={() => {
          // Out to the account app, which owns every question this card raises
          // and is the only place allowed to answer them with numbers.
          window.location.href = `${accountOrigin}/account`;
        }}
      >
        {tone === 'neutral' ? 'Set up payment' : 'Keep my business running'}
      </Button>
    </div>
  );
}
