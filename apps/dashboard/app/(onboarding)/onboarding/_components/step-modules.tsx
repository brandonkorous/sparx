'use client';

import * as React from 'react';
import { Badge, Button, Switch, Text, WizardStep, cn } from '@sparx/ui';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { ONBOARDING_MODULES, type OnboardingModule } from '../_lib/modules';
import { saveModulesAction } from '../_lib/actions';
import type { StepNav } from './onboarding-wizard';

// Step 1 — Modules. The exact switchboard from the public pricing page: every
// module is one toggle, and the plan card on the right recomputes the live bill
// the instant you flip one. The selection drives billing AND filters the template
// gallery next, so we persist it (bulk write) on Continue. Free for 14 days — the
// card shows what they'll pay after, not a charge today.

export function StepModules({
  value,
  onChange,
  nav,
}: {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  nav: StepNav;
}) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, startSave] = React.useTransition();

  const active = ONBOARDING_MODULES.filter((m) => value[m.key]);
  const total = active.reduce((s, m) => s + m.price, 0);
  const elsewhere = active.reduce((s, m) => s + m.elsewhere, 0);
  const save = Math.max(0, elsewhere - total);

  function toggle(key: string) {
    onChange({ ...value, [key]: !value[key] });
  }

  function onContinue() {
    setError(null);
    startSave(async () => {
      const res = await saveModulesAction(value);
      if (res.ok) nav.onNext();
      else setError(res.error);
    });
  }

  return (
    <WizardStep
      width="wide"
      header={{
        title: 'Switch on what you use',
        supporting:
          "Every module is one toggle — flip it and your plan updates the instant you do. You're free for 14 days with no card; this is just what you'll pay after, and you can change it anytime. We'll use your picks to show you the right templates next.",
      }}
    >
      <div className="flex items-start gap-8 max-[1040px]:flex-col">
        {/* ── Module list ─────────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {ONBOARDING_MODULES.map((m, i) => {
            const firstAddon = m.addon && (i === 0 || !ONBOARDING_MODULES[i - 1]?.addon);
            return (
              <React.Fragment key={m.key}>
                {firstAddon && (
                  <div className="px-1 pt-4 pb-1.5">
                    <Text size="xs" variant="muted" weight="medium">
                      Add-ons
                    </Text>
                  </div>
                )}
                <ModuleRow
                  module={m}
                  on={Boolean(value[m.key])}
                  open={openKey === m.key}
                  isLast={i === ONBOARDING_MODULES.length - 1}
                  onToggle={() => toggle(m.key)}
                  onExpand={() => setOpenKey((k) => (k === m.key ? null : m.key))}
                />
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Live plan card ──────────────────────────────────────────────── */}
        <aside className="w-[304px] shrink-0 max-[1040px]:order-first max-[1040px]:w-full lg:sticky lg:top-2">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-md">
            <div className="flex flex-col gap-2.5 px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <Text weight="medium">Your plan</Text>
                <Badge color="module" variant="soft" size="sm">
                  {active.length} {active.length === 1 ? 'module on' : 'modules on'}
                </Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[4.5rem] leading-[1] font-medium tracking-[-0.04em] text-[var(--color-text-primary)]">
                  ${total}
                </span>
                <span className="text-xl text-[var(--color-text-tertiary)]">/mo</span>
              </div>
              <Text size="xs" variant="muted">
                After your free trial · one invoice for everything
              </Text>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-6 py-5">
              {active.length === 0 ? (
                <Text size="sm" variant="muted">
                  Flip on a module to start.
                </Text>
              ) : (
                active.map((m) => (
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

            <div className="flex flex-col gap-2.5 border-t border-[var(--color-border-default)] px-6 py-4">
              <div className="flex items-center justify-between">
                <Text size="xs" variant="muted">
                  Same stack, stitched together
                </Text>
                <span className="text-sm text-[var(--color-text-tertiary)] line-through">
                  ${elsewhere}/mo
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[var(--color-success-tint)] px-3 py-2.5">
                <Check className="h-3.5 w-3.5 text-[var(--color-success-text)]" />
                <span className="text-xs font-medium text-[var(--color-success-text)]">
                  You save ${save}/mo on one bill
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 px-6 pt-2 pb-6">
              {error && (
                <Text size="xs" variant="danger" role="alert" aria-live="polite">
                  {error}
                </Text>
              )}
              <Button
                color="module"
                shape="block"
                onClick={onContinue}
                disabled={saving || active.length === 0}
                loading={saving}
                rightIcon={saving ? undefined : <ArrowRight className="h-4 w-4" />}
              >
                Continue
              </Button>
              <Text size="xs" variant="muted" className="text-center">
                Free for 14 days · no card today · cancel anytime
              </Text>
            </div>
          </div>
        </aside>
      </div>
    </WizardStep>
  );
}

function ModuleRow({
  module: m,
  on,
  open,
  isLast,
  onToggle,
  onExpand,
}: {
  module: OnboardingModule;
  on: boolean;
  open: boolean;
  isLast: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  return (
    <div className={cn(!isLast && 'border-b border-[var(--color-border-default)]')}>
      <div className="flex items-center gap-4 py-3.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.colorVar }} />
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={open}
          className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
        >
          <span className="flex items-center gap-2">
            <Text weight="medium">{m.name}</Text>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-[var(--color-text-tertiary)] transition-transform duration-200',
                open && 'rotate-180'
              )}
            />
          </span>
          <Text size="xs" variant="muted">
            {m.desc}
          </Text>
        </button>
        <span
          className={cn(
            'w-16 shrink-0 text-right text-sm',
            on
              ? 'font-medium text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-tertiary)]'
          )}
        >
          + ${m.price}
        </span>
        <Switch checked={on} onCheckedChange={onToggle} color={m.key} aria-label={m.name} />
      </div>

      {open && (
        <div className="flex flex-col gap-3.5 pt-0.5 pr-1 pb-5 pl-[26px]">
          <Text size="sm" variant="muted" className="max-w-[560px]">
            {m.long}
          </Text>
          <ul className="flex flex-wrap gap-x-7 gap-y-2.5">
            {m.feats.map((f) => (
              <li key={f} className="flex w-[248px] max-w-full items-center gap-2.5">
                <span
                  className="h-[5px] w-[5px] shrink-0 rounded-full"
                  style={{ background: m.colorVar }}
                />
                <Text size="sm" variant="muted">
                  {f}
                </Text>
              </li>
            ))}
          </ul>
          <Text size="xs" variant="muted">
            Replaces {m.replaces} — about{' '}
            <span className="font-medium text-[var(--color-text-secondary)]">
              ${m.elsewhere}/mo
            </span>{' '}
            bought separately.
          </Text>
        </div>
      )}
    </div>
  );
}
