'use client';

import { useState } from 'react';
import { Heading } from '@wizeworks/silicaui-react';
import type { MarketingModule } from '../primitives';
import { MODULES, MODULE_ICON, MODULE_HEX } from '../modules-catalog';
import { ModuleToggleCard } from '../module-toggle-card';
import { StackSummaryCard, type StackLineItem } from '../stack-summary-card';

/**
 * v3 of the "switch on what you need" beat. The tile and summary card were
 * already pure silicaui (shared with /pricing's switchboard), so this is
 * just the outer shell rebuilt: `bg-accent` (a real theme token) instead of
 * the `mkt-brand` class, and `size="display"` + a `text-*` class instead of
 * the custom `heading-style.ts` override, matching the rest of v3.
 */
const DEFAULT_ACTIVE: MarketingModule[] = ['builder', 'commerce', 'crm'];

const ELSEWHERE_MONTHLY: Record<string, number> = {
  builder: 39,
  commerce: 399,
  cms: 99,
  crm: 300,
  invoicing: 30,
  email: 165,
  b2b: 2400,
  dropship: 60,
  inventory: 99,
  chat: 74,
  scheduling: 61,
  ai: 103,
};

export function LandingV3Switchboard() {
  const [active, setActive] = useState<Set<MarketingModule>>(new Set(DEFAULT_ACTIVE));

  const toggle = (id: MarketingModule) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeModules = MODULES.filter((m) => active.has(m.id));
  const activeLabels = new Set(activeModules.map((m) => m.label));
  const lineItems: StackLineItem[] = activeModules.map((m) => {
    const included = m.includedWith?.some((label) => activeLabels.has(label)) ?? false;
    return {
      id: m.id,
      label: m.label,
      icon: MODULE_ICON[m.id],
      color: MODULE_HEX[m.id],
      price: included ? 0 : m.price,
      included,
    };
  });
  const total = lineItems.reduce((sum, m) => sum + m.price, 0);
  const elsewhereTotal = lineItems.reduce(
    (sum, m) => sum + (m.included ? 0 : (ELSEWHERE_MONTHLY[m.id] ?? 0)),
    0
  );

  return (
    <section id="modules" className="bg-accent m-6 rounded-4xl px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-14">
          <div className="max-w-3xl">
            <Heading
              level={2}
              size="display"
              className="text-accent-content text-6xl leading-[0.95] tracking-tight sm:text-7xl"
            >
              Start with a spark.
            </Heading>
            <Heading
              level={2}
              size="display"
              className="text-accent-content/55 text-6xl leading-[0.95] tracking-tight sm:text-7xl"
            >
              Switch on the rest when you&apos;re ready.
            </Heading>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <ModuleToggleCard
                key={m.id}
                icon={MODULE_ICON[m.id]}
                color={MODULE_HEX[m.id]}
                label={m.label}
                title={m.title}
                active={active.has(m.id)}
                onToggle={() => toggle(m.id)}
                badgeText={m.includedWith ? `Free with ${m.includedWith[0]}` : `$${m.price}/mo`}
                badgeColor={active.has(m.id) ? 'primary' : 'neutral'}
              />
            ))}
            <StackSummaryCard
              className="lg:col-start-4 lg:row-span-4 lg:row-start-1"
              activeCount={activeModules.length}
              totalModules={MODULES.length}
              lineItems={lineItems}
              total={total}
              elsewhereTotal={elsewhereTotal}
              ctaRef="landing-v3-switchboard"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
