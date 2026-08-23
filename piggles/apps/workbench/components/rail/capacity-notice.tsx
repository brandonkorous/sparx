'use client';

import { Button } from '@wizeworks/silicaui-react';
import { METER_LABEL, useCapacity, worstMeter } from '@/surfaces/finance/capacity-data';

// A WARNING when one meter is nearly full. Never a standing usage readout.
//
// Same line as PlanCard draws: capacity MANAGEMENT lives at getpiggles.com, and a
// permanent "4.2 of 10 GB" fixture in the rail would be that management moved
// into the workspace. What belongs here is the operational half — something is
// about to stop being addable — plus a door out.
//
// No number with a currency symbol, and no ceiling arithmetic: the console never
// knows a price (piggles/CLAUDE.md RULE #2).

export function CapacityNotice({ accountOrigin }: { accountOrigin: string }) {
  const { data: capacity } = useCapacity();
  const worst = worstMeter(capacity);

  // Nothing while every meter is comfortable, unmetered, or simply uncounted.
  // A card that appears because nobody has measured yet would be a warning about
  // our own missing data, dressed as a warning about their business.
  if (!worst) return null;

  const over = worst.state === 'over';
  const tone = over ? 'danger' : 'warning';
  const label = METER_LABEL[worst.meter];

  return (
    <div
      data-capacity-tone={tone}
      className="rounded-box border-base-300 bg-chrome-deep mx-1 mb-2 border p-3"
    >
      <div className="flex items-center gap-2">
        <span className="text-base font-bold">{over ? 'Out of room' : 'Nearly full'}</span>
      </div>
      {/* A real ink — this is the line that explains why the next thing they add
          might not go in. */}
      <p className="mt-0.5 text-sm">
        {over
          ? `You are past the ${label} your plan includes. Nothing you already have is affected.`
          : `You are close to the ${label} your plan includes.`}
      </p>
      <Button
        color={tone}
        size="sm"
        block
        className="mt-2.5"
        onClick={() => {
          // Scoped, not billing home: the meter that raised this is the one they
          // should land on.
          window.location.href = `${accountOrigin}/account?meter=${worst.meter}`;
        }}
      >
        Make room
      </Button>
    </div>
  );
}
