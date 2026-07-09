'use client';

import * as React from 'react';
import { Badge, Button, FieldStatus } from '@wizeworks/silicaui-react';
import { cn } from '@sparx/ui';
import { ArrowLeft, Check, ChevronDown } from 'lucide-react';

// The persistent "Your setup" card — the constant right column of the onboarding
// content area on every step (docs/15 v2). It does three jobs at once:
//   1. keeps the plan visible the whole way — the price AND the per-module
//      breakdown (what you're actually paying for), so the bill never goes opaque,
//   2. accretes a receipt — each step adds a confirmed line, the current step's
//      line is the "active" one, so by Launch the card IS the summary, and
//   3. houses the primary CTA in a FIXED place every step, which is what makes
//      the wizard's navigation feel consistent.
//
// It's a dumb renderer: the orchestrator owns all state and hands down the plan
// items, the accreted entries, and the CTA wiring.

export interface SummaryPlanItem {
  key: string;
  name: string;
  price: number;
  /** A bundled capability (e.g. Invoicing with Commerce/B2B) — shown "Included"
   *  rather than a price, and contributes $0 to the total. */
  included?: boolean;
  /** Token var for the module's dot color, e.g. `var(--color-module-builder)`. */
  colorVar: string;
  /** Optional sub-caption under the name (e.g. the story's "comes with Dropship"). */
  caption?: string;
}

export interface SummaryEntry {
  key: string;
  /** Sentence-case label, e.g. "Blueprint" (never an uppercase mono eyebrow). */
  label: string;
  value: React.ReactNode;
  /** `active` = the step being edited right now (highlighted); `done` = a
   *  confirmed earlier step (check mark); `pending` = chosen-but-not-yet-set. */
  status: 'active' | 'done' | 'pending';
}

export interface SummaryCardProps {
  plan: { total: number; elsewhere: number; items: SummaryPlanItem[] };
  entries: SummaryEntry[];
  cta: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };
  onBack?: () => void;
  error?: string | null;
  /** Past the Modules step the breakdown collapses (it's reference, not the
   *  focus) so the accreting receipt below stays the star — expandable anytime. */
  collapsibleModules?: boolean;
  /** Optional rich sections rendered between the savings block and the CTA — the
   *  story flow populates these (starting point, web address, fulfillment, etc.);
   *  the step-by-step wizard leaves it empty and uses `entries` instead. */
  extras?: React.ReactNode;
}

export function SummaryCard({
  plan,
  entries,
  cta,
  onBack,
  error,
  collapsibleModules = false,
  extras,
}: SummaryCardProps) {
  const savings = Math.max(0, plan.elsewhere - plan.total);
  const [expanded, setExpanded] = React.useState(false);
  // On the Modules step (not collapsible) the list is always open; past it, it
  // starts collapsed and the tenant can expand it.
  const showList = !collapsibleModules || expanded;

  return (
    <aside className="border-base-300 bg-base-100 w-full overflow-hidden rounded-2xl border shadow-md lg:sticky lg:top-2">
      {/* ── Plan total ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">Your setup</p>
          <Badge color="module" variant="soft" size="sm">
            {plan.items.length} {plan.items.length === 1 ? 'module' : 'modules'}
          </Badge>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-base-content text-[3.25rem] leading-[1] font-medium tracking-[-0.04em]">
            ${plan.total}
          </span>
          <span className="text-base-content/50 text-lg">/mo</span>
        </div>
        <p className="text-base-content/70 text-xs">
          After your 14-day trial · one invoice for everything
        </p>
      </div>

      {/* ── Per-module breakdown (what you're paying for) ─────────────────── */}
      <div className="border-base-300 bg-base-200 flex flex-col gap-3 border-t px-6 py-4">
        {collapsibleModules && plan.items.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center justify-between"
          >
            <p className="text-base-content/70 text-sm">
              {expanded ? 'Hide modules' : `${plan.items.length} modules`}
            </p>
            <ChevronDown
              className={cn(
                'text-base-content/50 h-4 w-4 transition-transform duration-200',
                expanded && 'rotate-180'
              )}
            />
          </button>
        )}
        {plan.items.length === 0 ? (
          <p className="text-base-content/70 text-sm">Flip on a module to start.</p>
        ) : (
          showList &&
          plan.items.map((m) => (
            <div key={m.key} className="flex items-start justify-between gap-2">
              <span className="flex min-w-0 items-start gap-2.5">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: m.colorVar }}
                />
                <span className="min-w-0">
                  <p className="text-base-content/70 text-sm">{m.name}</p>
                  {m.caption && (
                    <p className="text-base-content/70 block text-xs opacity-80">{m.caption}</p>
                  )}
                </span>
              </span>
              <p className={cn('text-sm font-medium', m.included && 'text-success')}>
                {m.included ? 'Included' : `$${m.price}`}
              </p>
            </div>
          ))
        )}
      </div>

      {/* ── Savings ───────────────────────────────────────────────────────── */}
      {plan.items.length > 0 && (
        <div className="border-base-300 flex flex-col gap-2.5 border-t px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-base-content/70 text-xs">Same stack, stitched together</p>
            <span className="text-base-content/50 text-sm line-through">${plan.elsewhere}/mo</span>
          </div>
          {savings > 0 && (
            <div className="bg-success bg-soft flex items-center gap-2.5 rounded-lg px-3.5 py-3">
              <Check className="text-success h-4 w-4 shrink-0" />
              <span className="text-success text-sm">
                You save{' '}
                <span className="text-base font-semibold">${savings.toLocaleString()}/mo</span> on
                one bill
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Story extras (starting point, web address, fulfillment, payments) ─── */}
      {extras}

      {/* ── Accreting receipt rows (the choices made downstream) ──────────── */}
      {entries.length > 0 && (
        <div className="border-base-300 border-t">
          {entries.map((e) => (
            <div
              key={e.key}
              className={cn(
                'border-base-300 flex items-start gap-3 border-b px-6 py-3 last:border-b-0',
                e.status === 'active' && 'bg-module bg-soft'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                  e.status === 'done'
                    ? 'bg-module text-white'
                    : e.status === 'active'
                      ? 'border-module border-2'
                      : 'border-base-content/30 border-2'
                )}
              >
                {e.status === 'done' && <Check className="h-2.5 w-2.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base-content/70 text-xs">{e.label}</p>
                <div
                  className={cn(
                    'truncate text-sm',
                    e.status === 'pending'
                      ? 'text-base-content/50'
                      : 'text-base-content font-medium'
                  )}
                >
                  {e.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CTA (fixed home for the primary action, every step) ───────────── */}
      <div className="border-base-300 flex flex-col gap-2.5 border-t px-6 py-5">
        {error && (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        )}
        <Button
          color="module"
          block
          onClick={cta.onClick}
          disabled={(cta.disabled ?? false) || (cta.loading ?? false)}
          loading={cta.loading}
        >
          {cta.label}
        </Button>
        <p className="text-base-content/70 text-center text-xs">
          Free for 14 days · no card today · cancel anytime
        </p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-base-content/50 hover:text-base-content mt-1 flex items-center justify-center gap-1 text-xs transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
        )}
      </div>
    </aside>
  );
}
