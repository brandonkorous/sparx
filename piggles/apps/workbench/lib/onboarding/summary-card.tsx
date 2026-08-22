'use client';

// The persistent "Your setup" card that rides the right column of both onboarding
// flows. A dumb renderer: it holds no step state, it only shows what is switched
// on, the receipt the flow has accreted so far, and the fixed primary CTA
// (Continue / Build / Launch) that every step drives through here so the commit
// button never moves.
//
// IT SHOWS NO MONEY. It used to price each row, add them into a running total and
// print "you save $N/mo vs $M elsewhere" — a per-module bill on the screen that
// introduces a product sold as one flat price with everything in it. The console
// never knows a price (RULE #2); what belongs here is the LIST, because what a
// person is choosing is their workspace, not their bill.
//
// Built on silicaui-react + Tailwind, in the workbench's floating-card idiom
// (base-100 card lifted on the recessed setup canvas, separated by edge and color,
// never a shadow). The primary CTA wears `color="module"` so it takes the flow's
// module hue from the ModuleScope the gate wraps everything in.

import type { ReactNode } from 'react';
import { Button, Heading, Text } from '@wizeworks/silicaui-react';

export interface SummaryPlanItem {
  key: string;
  name: string;
}

export interface SummaryEntry {
  label: string;
  value: string;
}

export interface SummaryCardProps {
  title?: string;
  /** What is switched on. No total, and nothing to total. */
  plan: { items: SummaryPlanItem[] };
  /** The accreting receipt — one line per decision made so far. */
  entries?: SummaryEntry[];
  primary: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  back?: { onClick: () => void; disabled?: boolean };
  /** Flow-specific block above the CTA (story's starting point, web address, etc.). */
  extras?: ReactNode;
  /** The switch-flow affordance, pinned under the CTA. */
  altAction?: ReactNode;
  /** Surfaced under the CTA when a commit fails. */
  error?: string | null;
}

export function SummaryCard({
  title = 'Your setup',
  plan,
  entries,
  primary,
  back,
  extras,
  altAction,
  error,
}: SummaryCardProps) {
  const activeItems = plan.items;

  return (
    <aside className="bg-base-100 border-base-300 flex w-full flex-col gap-5 rounded-xl border p-5">
      <Heading level={2} className="text-lg">
        {title}
      </Heading>

      {/* What is switched on. A list, with no column of figures beside it. */}
      <div className="flex flex-col gap-2">
        {activeItems.length === 0 ? (
          <Text className="text-sm">Switch on what you use and it will show up here.</Text>
        ) : (
          activeItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2.5 text-sm">
              <span className="bg-module size-1.5 shrink-0 rounded-full" aria-hidden />
              <span>{item.name}</span>
            </div>
          ))
        )}
      </div>

      {activeItems.length > 0 ? (
        <div className="border-base-300 border-t pt-3">
          {/* The one true sentence about money on this screen, and it is not a
              number: turning something on does not change what anybody pays. */}
          <Text className="text-sm font-medium">
            All of it is in your plan. Adding one never changes your bill.
          </Text>
        </div>
      ) : null}

      {/* Receipt — the decisions accreted so far. */}
      {entries && entries.length > 0 ? (
        <div className="border-base-300 flex flex-col gap-2 border-t pt-3">
          {entries.map((entry) => (
            <div key={entry.label} className="flex items-baseline justify-between gap-3 text-sm">
              <span>{entry.label}</span>
              <span className="text-right font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {extras}

      {/* CTA — fixed here on every step so the commit button never moves. */}
      <div className="mt-auto flex flex-col gap-3">
        {error ? <Text className="text-error text-sm">{error}</Text> : null}
        <div className="flex items-center gap-3">
          {back ? (
            <Button variant="ghost" onClick={back.onClick} disabled={back.disabled}>
              Back
            </Button>
          ) : null}
          <Button
            color="module"
            className="flex-1"
            onClick={primary.onClick}
            disabled={Boolean(primary.disabled) || Boolean(primary.loading)}
            loading={primary.loading}
          >
            {primary.label}
          </Button>
        </div>
        {altAction}
      </div>
    </aside>
  );
}
