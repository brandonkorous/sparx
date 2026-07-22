'use client';

// Step 1 — Modules (the work pane). The "switch on what you use" board: one toggle
// per module, expandable to the full pitch. The running plan, total, and Continue
// live in the persistent SummaryCard the orchestrator owns — flipping a switch here
// updates that card live, so this body is purely the toggle list.
//
// Locked rows mirror Settings → Modules: a bundled-free capability (Invoicing via
// Commerce/B2B) drops its switch and reads "Included"; a required dependency
// (Commerce while B2B is on) keeps an on-but-locked switch. Both carry a colored
// pill naming WHY, via lockReasonText.

import { useState } from 'react';
import { Badge, Switch } from '@wizeworks/silicaui-react';
import { ChevronDown } from 'lucide-react';
import { ModuleScope, type WorkbenchModule } from '../../../components/module-scope';
import {
  SWITCHBOARD_MODULES,
  effectiveModuleOn,
  moduleLock,
  lockReasonText,
  type SwitchboardModule,
} from '../../../lib/onboarding/modules';

type Lock = 'included' | 'required' | null;

export function StepModules({
  value,
  onToggle,
}: {
  /** The current module selection (derived from the shared story). */
  value: Record<string, boolean>;
  /** Flip one module — the shared model owns the dependency graph + clause bridge. */
  onToggle: (key: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  function toggle(key: string) {
    onToggle(key);
  }

  return (
    <div className="border-base-300 bg-base-100 flex max-w-2xl flex-col rounded-xl border px-5">
      {SWITCHBOARD_MODULES.map((m, i) => {
        const firstAddon = m.addon && !SWITCHBOARD_MODULES[i - 1]?.addon;
        return (
          <div key={m.key}>
            {firstAddon ? (
              <div className="border-base-300 mt-1 border-t pt-4 pb-1">
                <p className="text-base-content text-sm font-medium">Add-ons</p>
                <p className="text-base-content text-sm">
                  Optional extras, priced on top of your core modules.
                </p>
              </div>
            ) : null}
            <ModuleRow
              module={m}
              on={effectiveModuleOn(value, m.key)}
              lock={moduleLock(value, m.key)}
              caption={lockReasonText(value, m.key)}
              open={openKey === m.key}
              isLast={i === SWITCHBOARD_MODULES.length - 1}
              onToggle={() => toggle(m.key)}
              onExpand={() => setOpenKey((k) => (k === m.key ? null : m.key))}
            />
          </div>
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
  module: SwitchboardModule;
  on: boolean;
  lock: Lock;
  caption: string | null;
  open: boolean;
  isLast: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  return (
    <ModuleScope
      module={m.key as WorkbenchModule}
      className={isLast ? '' : 'border-base-300 border-b'}
    >
      <div className="flex items-center gap-4 py-4">
        <span className="bg-module size-2.5 shrink-0 rounded-full" aria-hidden />
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={open}
          className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="text-base-content font-medium">{m.name}</span>
            <ChevronDown
              className={`text-base-content size-4 transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </span>
          <span className="text-base-content text-sm">{m.desc}</span>
        </button>

        {caption ? (
          <Badge color={lock === 'included' ? 'success' : 'info'} variant="soft" size="sm">
            {caption}
          </Badge>
        ) : null}

        <span
          className={`w-16 shrink-0 text-right text-sm tabular-nums ${
            lock === 'included' ? 'text-success font-medium' : 'text-base-content'
          }`}
        >
          {lock === 'included' ? 'Included' : `+ $${m.price}`}
        </span>

        {/* A bundled capability has nothing to toggle — hold the switch's width so
            the price column stays aligned across every row. */}
        {lock === 'included' ? (
          <span className="w-9 shrink-0" aria-hidden />
        ) : (
          <Switch
            color="module"
            checked={on}
            disabled={lock !== null}
            onCheckedChange={onToggle}
            aria-label={on ? `Turn off ${m.name}` : `Turn on ${m.name}`}
          />
        )}
      </div>

      {open ? (
        <div className="flex flex-col gap-4 pb-5 pl-[26px]">
          <p className="text-base-content max-w-prose text-sm">{m.long}</p>
          <ul className="grid gap-y-2.5 sm:grid-cols-2 sm:gap-x-8">
            {m.feats.map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span className="bg-module size-1.5 shrink-0 rounded-full" aria-hidden />
                <span className="text-base-content text-sm">{f}</span>
              </li>
            ))}
          </ul>
          <p className="text-base-content text-sm">
            Replaces {m.replaces} — about{' '}
            <span className="text-base-content font-medium">${m.elsewhere}/mo</span> bought
            separately.
          </p>
        </div>
      ) : null}
    </ModuleScope>
  );
}
