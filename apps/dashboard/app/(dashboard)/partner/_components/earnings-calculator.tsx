'use client';

import * as React from 'react';
import {
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
  Label,
  Radio,
} from '@wizeworks/silicaui-react';
import type { PartnerTier } from '@sparx/partner-schemas';

import { TIER_ORDER, TIERS } from '../_lib/tiers';

// The upsell's centerpiece (docs/114 §B.7): a live "what could I earn" estimator
// on the join landing. Rates are the snapshot economics from _lib/tiers — informal
// 20% / registered 30% first payment, certified adds 5% ongoing on managed
// accounts. A neutral card (the landing's one violet tint rides the hero above);
// the figures carry the module hue so the payoff is what draws the eye.

const FIRST_RATE: Record<PartnerTier, number> = {
  informal: 0.2,
  registered: 0.3,
  certified: 0.3,
};
const ONGOING_RATE: Record<PartnerTier, number> = {
  informal: 0,
  registered: 0,
  certified: 0.05,
};

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function EarningsCalculator() {
  const [clients, setClients] = React.useState(5);
  const [monthly, setMonthly] = React.useState(149);
  const [tier, setTier] = React.useState<PartnerTier>('registered');

  const firstPayment = clients * monthly * FIRST_RATE[tier];
  const ongoingMonthly = clients * monthly * ONGOING_RATE[tier];
  const firstYear = firstPayment + ongoingMonthly * 12;

  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">Estimate your earnings</h2>
            <p className="text-base-content/70 text-sm">
              A rough projection — adjust the numbers to match the clients you have in mind.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Clients you’ll bring in a year</FieldLabel>
              <FieldControl
                id="calc-clients"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={clients}
                onChange={(e) => setClients(clampInt(e.target.value, 1, 500, 1))}
              />
            </Field>
            <Field>
              <FieldLabel>Their average monthly Sparx bill</FieldLabel>
              <FieldControl
                id="calc-monthly"
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                value={monthly}
                onChange={(e) => setMonthly(clampInt(e.target.value, 0, 100000, 0))}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Your tier</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TIER_ORDER.map((t) => (
                <div
                  key={t}
                  className="border-base-300 flex items-center gap-2 rounded-lg border p-3"
                >
                  <Radio
                    name="calc-tier"
                    id={`calc-tier-${t}`}
                    value={t}
                    checked={tier === t}
                    onChange={() => setTier(t as PartnerTier)}
                    color="module"
                  />
                  <Label htmlFor={`calc-tier-${t}`}>{TIERS[t].label}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="border-base-300 grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-3">
            <Figure label="First-payment commissions" value={usd.format(firstPayment)} />
            <Figure
              label="Ongoing, per month"
              value={usd.format(ongoingMonthly)}
              hint={tier === 'certified' ? '5% on managed accounts' : 'Certified tier only'}
              muted={tier !== 'certified'}
            />
            <Figure label="Estimated first-year total" value={usd.format(firstYear)} emphasis />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Figure({
  label,
  value,
  hint,
  emphasis,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-base-content/70 text-sm">{label}</p>
      <span
        className={
          emphasis
            ? 'text-module text-[2rem] leading-none font-medium'
            : muted
              ? 'text-base-content/50 text-[1.65rem] leading-none font-medium'
              : 'text-base-content text-[1.65rem] leading-none font-medium'
        }
      >
        {value}
      </span>
      {hint ? <p className="text-base-content/70 text-xs">{hint}</p> : null}
    </div>
  );
}
