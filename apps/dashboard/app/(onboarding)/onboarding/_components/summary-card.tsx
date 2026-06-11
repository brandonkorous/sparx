'use client';

import * as React from 'react';
import { Badge, Button, Text, cn } from '@sparx/ui';
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
  /** Token var for the module's dot color, e.g. `var(--module-builder)`. */
  colorVar: string;
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
}

export function SummaryCard({
  plan,
  entries,
  cta,
  onBack,
  error,
  collapsibleModules = false,
}: SummaryCardProps) {
  const savings = Math.max(0, plan.elsewhere - plan.total);
  const [expanded, setExpanded] = React.useState(false);
  // On the Modules step (not collapsible) the list is always open; past it, it
  // starts collapsed and the tenant can expand it.
  const showList = !collapsibleModules || expanded;

  return (
    <aside className="w-full overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-md lg:sticky lg:top-2">
      {/* ── Plan total ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <Text weight="medium">Your setup</Text>
          <Badge color="module" variant="soft" size="sm">
            {plan.items.length} {plan.items.length === 1 ? 'module' : 'modules'}
          </Badge>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[3.25rem] leading-[1] font-medium tracking-[-0.04em] text-[var(--color-text-primary)]">
            ${plan.total}
          </span>
          <span className="text-lg text-[var(--color-text-tertiary)]">/mo</span>
        </div>
        <Text size="xs" variant="muted">
          After your 14-day trial · one invoice for everything
        </Text>
      </div>

      {/* ── Per-module breakdown (what you're paying for) ─────────────────── */}
      <div className="flex flex-col gap-3 border-t border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-6 py-4">
        {collapsibleModules && plan.items.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center justify-between"
          >
            <Text size="sm" variant="muted">
              {expanded ? 'Hide modules' : `${plan.items.length} modules`}
            </Text>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-[var(--color-text-tertiary)] transition-transform duration-200',
                expanded && 'rotate-180'
              )}
            />
          </button>
        )}
        {plan.items.length === 0 ? (
          <Text size="sm" variant="muted">
            Flip on a module to start.
          </Text>
        ) : (
          showList &&
          plan.items.map((m) => (
            <div key={m.key} className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: m.colorVar }}
                />
                <Text size="sm" variant="muted">
                  {m.name}
                </Text>
              </span>
              <Text size="sm" weight="medium">
                ${m.price}
              </Text>
            </div>
          ))
        )}
      </div>

      {/* ── Savings ───────────────────────────────────────────────────────── */}
      {plan.items.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-[var(--color-border-default)] px-6 py-4">
          <div className="flex items-center justify-between">
            <Text size="xs" variant="muted">
              Same stack, stitched together
            </Text>
            <span className="text-sm text-[var(--color-text-tertiary)] line-through">
              ${plan.elsewhere}/mo
            </span>
          </div>
          {savings > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--color-success-tint)] px-3 py-2.5">
              <Check className="h-3.5 w-3.5 text-[var(--color-success-text)]" />
              <span className="text-xs font-medium text-[var(--color-success-text)]">
                You save ${savings}/mo on one bill
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Accreting receipt rows (the choices made downstream) ──────────── */}
      {entries.length > 0 && (
        <div className="border-t border-[var(--color-border-default)]">
          {entries.map((e) => (
            <div
              key={e.key}
              className={cn(
                'flex items-start gap-3 border-b border-[var(--color-border-default)] px-6 py-3 last:border-b-0',
                e.status === 'active' && 'bg-[var(--module-active-tint)]'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                  e.status === 'done'
                    ? 'bg-[var(--module-active)] text-white'
                    : e.status === 'active'
                      ? 'border-2 border-[var(--module-active)]'
                      : 'border-2 border-[var(--color-border-strong)]'
                )}
              >
                {e.status === 'done' && <Check className="h-2.5 w-2.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <Text size="xs" variant="muted">
                  {e.label}
                </Text>
                <div
                  className={cn(
                    'truncate text-sm',
                    e.status === 'pending'
                      ? 'text-[var(--color-text-tertiary)]'
                      : 'font-medium text-[var(--color-text-primary)]'
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
      <div className="flex flex-col gap-2.5 border-t border-[var(--color-border-default)] px-6 py-5">
        {error && (
          <Text size="xs" variant="danger" role="alert" aria-live="polite">
            {error}
          </Text>
        )}
        <Button
          color="module"
          shape="block"
          onClick={cta.onClick}
          disabled={(cta.disabled ?? false) || (cta.loading ?? false)}
          loading={cta.loading}
        >
          {cta.label}
        </Button>
        <Text size="xs" variant="muted" className="text-center">
          Free for 14 days · no card today · cancel anytime
        </Text>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-1 flex items-center justify-center gap-1 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
        )}
      </div>
    </aside>
  );
}
