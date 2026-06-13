'use client';

import * as React from 'react';
import { Badge, Switch, Text, cn } from '@sparx/ui';
import { ChevronDown } from 'lucide-react';
import {
  ONBOARDING_MODULES,
  MODULE_BY_KEY,
  effectiveModuleOn,
  moduleLock,
  toggleModule,
  type OnboardingModule,
} from '../_lib/modules';

// Step 1 — Modules (work pane). The switchboard from the public pricing page: each
// module is one toggle, expandable for detail. The running plan + price + Continue
// live in the persistent SummaryCard (the orchestrator owns them), so this body is
// purely the toggle list — flipping a switch updates the card live.
//
// Locked rows mirror Settings → Modules: a BUNDLED_FREE capability (Invoicing via
// Commerce/B2B) drops its switch entirely and reads "Included"; a required
// dependency (Commerce while B2B is on) keeps its on-but-locked switch. Both carry
// a colored pill naming WHY they're on.
type Lock = 'included' | 'required' | null;

/** Human reason a row is locked, naming the providers from the live selection. */
function lockReason(value: Record<string, boolean>, lock: Lock): string | null {
  if (lock === 'required') return `Required by ${MODULE_BY_KEY.b2b?.name ?? 'B2B'}`;
  if (lock === 'included') {
    const providers = ['b2b', 'commerce']
      .filter((k) => value[k])
      .map((k) => MODULE_BY_KEY[k]?.name ?? k);
    return `Included with ${joinNames(providers)}`;
  }
  return null;
}

function joinNames(names: string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

export function StepModules({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  function toggle(key: string) {
    onChange(toggleModule(value, key));
  }

  return (
    <div className="max-w-[620px]">
      {ONBOARDING_MODULES.map((m, i) => {
        const firstAddon = m.addon && (i === 0 || !ONBOARDING_MODULES[i - 1]?.addon);
        const lock = moduleLock(value, m.key);
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
              on={effectiveModuleOn(value, m.key)}
              lock={lock}
              caption={lockReason(value, lock)}
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
  lock,
  caption,
  open,
  isLast,
  onToggle,
  onExpand,
}: {
  module: OnboardingModule;
  on: boolean;
  lock: Lock;
  caption: string | null;
  open: boolean;
  isLast: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  return (
    <div className={cn(!isLast && 'border-b border-[var(--color-border-default)]')}>
      <div className="flex items-center gap-4 py-3.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.colorVar }} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <button
            type="button"
            onClick={onExpand}
            aria-expanded={open}
            className="flex flex-col gap-0.5 text-left"
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
          {caption && (
            <Badge
              color={lock === 'included' ? 'success' : 'neutral'}
              variant="soft"
              size="sm"
              className="mt-1 self-start"
            >
              {caption}
            </Badge>
          )}
        </div>
        <span
          className={cn(
            'w-16 shrink-0 text-right text-sm',
            lock === 'included'
              ? 'font-medium text-[var(--color-success-text)]'
              : on
                ? 'font-medium text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-tertiary)]'
          )}
        >
          {lock === 'included' ? 'Included' : `+ $${m.price}`}
        </span>
        {/* A bundled capability has nothing to toggle — show just "Included" and
            drop the switch, holding its width so the price column stays aligned. */}
        {lock === 'included' ? (
          <span className="w-9 shrink-0" aria-hidden="true" />
        ) : (
          <Switch
            checked={on}
            onCheckedChange={onToggle}
            disabled={lock !== null}
            color={m.key}
            aria-label={m.name}
          />
        )}
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
