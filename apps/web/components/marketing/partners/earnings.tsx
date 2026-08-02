'use client';

import { useMemo, useState } from 'react';
import { Button, Heading, Slider, Text } from '@wizeworks/silicaui-react';

/**
 * The earnings ledger — what the page was missing entirely.
 *
 * The old /partners quoted "20–30% first-payment commission" and "5% ongoing on
 * managed accounts" and then never named a single dollar. A percentage of an
 * unstated number is not an offer: an agency reading it could not answer the one
 * question it came with, which is "what would I actually make?". Every figure it
 * needed was already in the codebase — module prices in `pricing/data.ts`,
 * commission rates in docs/114 §B.4 — and nothing joined them.
 *
 * So this joins them, and shows BOTH sides of the deal on purpose. The
 * commission on a $186/mo client is real but modest, and a page that led with it
 * alone would be overselling a small number. The larger, truer argument for an
 * agency is the client's side: the same stack costs $1,002/mo elsewhere, so the
 * book of clients you bring over stops paying roughly $9,800 each per year. That
 * is what makes the sale easy — the commission is what you get on top of a fee
 * sparx never touches.
 *
 * Every input is a real published figure, and the assumptions are stated under
 * the result rather than buried, because an earnings widget that hides its
 * arithmetic is the kind of thing this audience distrusts on sight.
 */

export interface StackOption {
  key: string;
  label: string;
  sub: string;
  /** sparx monthly total for the stack, in whole dollars. */
  monthly: number;
  /** Published monthly cost of the separate tools it replaces. */
  elsewhere: number;
}

type TierKey = 'informal' | 'registered' | 'certified';

const TIERS: { key: TierKey; label: string; first: number; ongoing: number; note: string }[] = [
  { key: 'informal', label: 'Informal', first: 0.2, ongoing: 0, note: 'No application needed.' },
  { key: 'registered', label: 'Registered', first: 0.3, ongoing: 0, note: 'A brief review.' },
  {
    key: 'certified',
    label: 'Certified',
    first: 0.3,
    ongoing: 0.05,
    note: 'Certification, plus the ongoing 5%.',
  },
];

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function PartnersEarnings({ stacks }: { stacks: StackOption[] }) {
  const [stackKey, setStackKey] = useState(stacks[0]?.key ?? '');
  const [tierKey, setTierKey] = useState<TierKey>('certified');
  const [clients, setClients] = useState(10);

  const stack = stacks.find((s) => s.key === stackKey) ?? stacks[0];
  const tier = TIERS.find((t) => t.key === tierKey) ?? TIERS[2]!;

  const sums = useMemo(() => {
    if (!stack) return null;
    const firstPayments = clients * tier.first * stack.monthly;
    const ongoingMonthly = clients * tier.ongoing * stack.monthly;
    return {
      firstPayments,
      ongoingMonthly,
      // Year one assumes each client is live for the full twelve months, which
      // is the optimistic read — said plainly in the footnote rather than left
      // for the reader to discover.
      yearOne: firstPayments + ongoingMonthly * 12,
      clientSaves: clients * (stack.elsewhere - stack.monthly) * 12,
    };
  }, [clients, stack, tier]);

  if (!stack || !sums) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Inputs and result share ONE panel: they are one instrument, and the rule
          between them reads as "therefore". It also has to be a lifted
          `base-100` surface rather than the grey page band — the slider's
          unfilled track is `base-300`, which against `base-200` is invisible, so
          on the bare band the control looked like a stub of Ember with no range
          behind it. */}
      <div className="border-base-300 bg-base-100 flex flex-col gap-9 rounded-4xl border p-8 sm:p-10">
        {/* ── The three inputs ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-7">
          <Control label="What your clients run">
            <div className="flex flex-wrap gap-2.5">
              {stacks.map((s) => (
                <Button
                  key={s.key}
                  size="lg"
                  // Selection is the filled shape (RULE #4). `soft` is deliberately
                  // NOT the selected state here — the old apply form had it exactly
                  // backwards, with the chosen tier pale and the two you had not
                  // chosen outlined, so the inactive buttons looked strongest.
                  {...(s.key === stack.key
                    ? { color: 'primary' as const, variant: 'solid' as const }
                    : { variant: 'outline' as const })}
                  onClick={() => setStackKey(s.key)}
                  aria-pressed={s.key === stack.key}
                >
                  {`${s.label} — ${money(s.monthly)}/mo`}
                </Button>
              ))}
            </div>
            <Text className="text-md">{stack.sub}</Text>
          </Control>

          <Control label="Your tier">
            <div className="flex flex-wrap gap-2.5">
              {TIERS.map((t) => (
                <Button
                  key={t.key}
                  size="lg"
                  {...(t.key === tier.key
                    ? { color: 'primary' as const, variant: 'solid' as const }
                    : { variant: 'outline' as const })}
                  onClick={() => setTierKey(t.key)}
                  aria-pressed={t.key === tier.key}
                >
                  {t.label}
                </Button>
              ))}
            </div>
            <Text className="text-md">{tier.note}</Text>
          </Control>

          <Control label={`Clients you bring over in a year — ${clients}`}>
            <div className="flex w-full max-w-xl items-center gap-4">
              <Text as="span" className="text-md">
                1
              </Text>
              <Slider
                color="primary"
                size="lg"
                min={1}
                max={50}
                value={clients}
                onValueChange={(v) => setClients(typeof v === 'number' ? v : (v[0] ?? 1))}
                showValue={false}
                aria-label="Clients you bring over in a year"
                className="w-full"
              />
              <Text as="span" className="text-md">
                50
              </Text>
            </div>
          </Control>
        </div>

        {/* ── The result ──────────────────────────────────────────────────── */}
        <div className="border-base-300 flex flex-col gap-8 border-t pt-9">
          <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-3">
            <Figure
              v={money(sums.firstPayments)}
              k="paid to you as those clients place their first invoice."
            />
            <Figure
              v={sums.ongoingMonthly > 0 ? `${money(sums.ongoingMonthly)}/mo` : 'Certified only'}
              k={
                sums.ongoingMonthly > 0
                  ? 'every month after, for as long as you manage them.'
                  : 'the ongoing 5% starts once you are certified — nothing here yet.'
              }
              quiet={sums.ongoingMonthly === 0}
            />
            <Figure
              total
              v={money(sums.yearOne)}
              k="your first twelve months, both parts together."
            />
          </div>

          {/* The client's side of the same trade. It is the bigger number by an
              order of magnitude, and it is the reason the sale is easy at all —
              so it gets its own row rather than a footnote. */}
          <div className="border-base-300 flex flex-col gap-3 border-t pt-8">
            <Heading level={3} size={4} className="tracking-tight">
              {`And those ${clients} clients stop paying ${money(sums.clientSaves)} a year`}
            </Heading>
            <Text className="text-lg">
              {`Between them. The same stack costs ${money(stack.elsewhere)} a month across ` +
                `separate subscriptions and ${money(stack.monthly)} a month on sparx — so every ` +
                `client you move keeps ${money((stack.elsewhere - stack.monthly) * 12)} a year ` +
                `that used to go to software. That is the conversation, and it is the reason ` +
                `your fee never has to be the thing that gets cut.`}
            </Text>
          </div>
        </div>
      </div>

      {/* Stated, not buried. An earnings widget that hides its arithmetic is the
          kind of thing this audience distrusts on sight. */}
      <Text className="text-md max-w-4xl">
        {`Rates are the published ones: ${Math.round(TIERS[0]!.first * 100)}% of the first ` +
          `payment at Informal, ${Math.round(TIERS[1]!.first * 100)}% at Registered and ` +
          `Certified, plus 5% of every month after on accounts you manage as a Certified ` +
          `partner. Stack prices are sparx's own; the comparison figure is the published 2026 ` +
          `price of the tools each module replaces. Year one assumes each client stays the full ` +
          `twelve months — real books churn, so treat it as the ceiling, not the forecast.`}
      </Text>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <Heading level={3} size={5} className="tracking-tight">
        {label}
      </Heading>
      {children}
    </div>
  );
}

/**
 * `total` is what wears the Ember. All three figures were coloured at first,
 * which is three identical accents distinguishing nothing — the components are
 * plain ink and the answer is the one that is coloured, so the eye lands on it.
 */
function Figure({
  v,
  k,
  quiet,
  total,
}: {
  v: string;
  k: string;
  quiet?: boolean;
  total?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className={[
          quiet ? 'text-2xl' : 'text-4xl sm:text-5xl',
          total ? 'text-primary' : '',
          'font-medium tracking-[-0.02em]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {v}
      </span>
      <Text className="text-lg leading-snug">{k}</Text>
    </div>
  );
}
