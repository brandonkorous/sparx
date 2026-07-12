'use client';

import type { LucideIcon } from 'lucide-react';
import { Alert, Button, Card, CardBody, Text } from '@wizeworks/silicaui-react';
import { signupHref } from './cta';

/**
 * The "Your stack" live summary — running module list, monthly total, and a
 * savings callout vs. buying each capability separately, plus the primary
 * CTA. Shared by /pricing's switchboard and the homepage's switchboard so
 * the savings story is tuned once and reads identically on both surfaces.
 *
 * The monthly total, the "stitched together" strike-through, and the savings
 * badge are sized up on purpose — this is the single biggest persuasion beat
 * on the card and needs to read at a glance, not get lost among line items.
 */

export interface StackLineItem {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  price: number;
  included: boolean;
}

export function StackSummaryCard({
  className,
  activeCount,
  totalModules,
  lineItems,
  total,
  elsewhereTotal,
  ctaRef,
}: {
  className?: string;
  activeCount: number;
  totalModules: number;
  lineItems: StackLineItem[];
  total: number;
  elsewhereTotal: number;
  ctaRef: string;
}) {
  const save = Math.max(0, elsewhereTotal - total);

  return (
    <Card className={className}>
      <CardBody className="flex h-full flex-col gap-4">
        <div>
          <Text variant="caption" className="tracking-[0.08em] uppercase">
            Your stack
          </Text>
          <div className="mt-1 text-2xl font-medium tracking-[-0.02em]">
            {activeCount} of {totalModules} on
          </div>
        </div>

        <div className="divide-base-300 flex flex-1 flex-col divide-y overflow-y-auto">
          {lineItems.length === 0 ? (
            <Text variant="caption" className="py-3">
              Flip a switch to add a module.
            </Text>
          ) : (
            lineItems.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: m.color }}
                  >
                    <Icon size={14} color="#FFFFFF" strokeWidth={2} aria-hidden />
                  </span>
                  <Text as="span" className="flex-1 text-sm">
                    {m.label}
                  </Text>
                  <Text as="span" variant="caption">
                    {m.included ? 'included' : `$${m.price}`}
                  </Text>
                </div>
              );
            })
          )}
        </div>

        <div className="border-base-300 flex flex-col gap-4 border-t pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Text as="span" className="text-sm font-medium">
                Est. monthly
              </Text>
              <span className="text-4xl font-semibold tracking-[-0.02em]">
                ${total}
                <span className="text-base-content/50 text-base font-normal">/mo</span>
              </span>
            </div>

            {elsewhereTotal > total && (
              <div className="flex items-baseline justify-between">
                <Text as="span" className="text-sm">
                  Same stack, stitched together
                </Text>
                <Text as="span" className="text-base-content/50 text-base line-through">
                  ${elsewhereTotal}/mo
                </Text>
              </div>
            )}

            {save > 0 && (
              <Alert
                color="success"
                variant="soft"
                role="status"
                className="items-center text-base font-semibold"
              >
                <CheckIcon />
                You save ${save}/mo with only one bill
              </Alert>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              color="primary"
              variant="solid"
              className="w-full"
              render={<a href={signupHref(ctaRef)} aria-label="Start 14-day free trial" />}
            >
              Start 14-day free trial
            </Button>
            <Text variant="caption" className="text-center">
              No card to start &middot; cancel anytime
            </Text>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function CheckIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12L10 17L19 7" stroke="currentColor" strokeWidth={3} />
    </svg>
  );
}
