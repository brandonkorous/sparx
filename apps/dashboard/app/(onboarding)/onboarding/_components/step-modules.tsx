'use client';

import * as React from 'react';
import { Switch, Text, cn } from '@sparx/ui';
import { ChevronDown } from 'lucide-react';
import { ONBOARDING_MODULES, type OnboardingModule } from '../_lib/modules';

// Step 1 — Modules (work pane). The switchboard from the public pricing page: each
// module is one toggle, expandable for detail. The running plan + price + Continue
// live in the persistent SummaryCard (the orchestrator owns them), so this body is
// purely the toggle list — flipping a switch updates the card live.
export function StepModules({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  function toggle(key: string) {
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <div className="max-w-[620px]">
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
