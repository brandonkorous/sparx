'use client';

// The account's own state, at the bottom of the rail.
//
// The console never knows a PRICE (piggles/CLAUDE.md RULE #2) — this says which
// phase the account is in and hands off to getpiggles.com, which owns every
// question it raises and is the only place allowed to answer them with numbers.

import { Button } from '@wizeworks/silicaui-react';
import { Mark } from '@piggles/brand/react';
import { useLifecycle } from '@/lib/billing/lifecycle';

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
  // The words live in lib/billing/lifecycle.ts, shared with the band above the
  // header. They were inline here, which is how the console ended up warning
  // nobody on a phone: this card is the only thing that said it, and it is
  // mounted inside a rail that phones do not have. Null while the answer has not
  // arrived, and null on a healthy account — standing billing furniture in the
  // rail is account management, and that lives at getpiggles.
  const life = useLifecycle();
  if (!life) return null;

  const calm = life.tone === 'calm';

  return (
    <div
      data-plan-tone={life.tone}
      className="rounded-box border-base-300 bg-chrome-deep mx-1 mb-2 border p-3"
    >
      <div className="flex items-center gap-2">
        <Mark className="text-primary size-5 shrink-0" />
        <span className="text-base font-bold">{life.heading}</span>
      </div>
      {/* A real ink, never faded — this is the line that tells somebody their
          business is about to stop working. */}
      <p className="mt-0.5 text-sm">{life.detail}</p>
      <Button
        // NO color on the calm one. Uncolored, a `.btn` resolves to
        // `base-content` and is right on this card in either theme; `neutral` is
        // theme-stable now because it paints the rail, so pinning it here would
        // put #52454f ink on a #1c212c card in dark. Same call close-band.tsx
        // makes, for the same reason.
        color={calm ? undefined : life.tone}
        variant={calm ? 'outline' : 'solid'}
        size="sm"
        block
        className="mt-2.5"
        onClick={() => {
          // Out to the account app, which owns every question this card raises
          // and is the only place allowed to answer them with numbers.
          window.location.href = `${accountOrigin}/account`;
        }}
      >
        {life.action}
      </Button>
    </div>
  );
}
