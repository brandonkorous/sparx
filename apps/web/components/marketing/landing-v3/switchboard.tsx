'use client';

import { useState } from 'react';
import { Heading, Text } from '@wizeworks/silicaui-react';
import type { MarketingModule } from '../primitives';
import { MODULES, PAID_MODULES, MODULE_ICON, MODULE_HEX } from '../modules-catalog';
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

  // SEO and Automations are free platform capabilities — always on, never
  // togglable, and absent from ELSEWHERE_MONTHLY so they add $0 to both sides.
  const isFree = (id: MarketingModule): boolean => MODULES.some((m) => m.id === id && m.free);
  const isActive = (id: MarketingModule): boolean => isFree(id) || active.has(id);

  const toggle = (id: MarketingModule) => {
    if (isFree(id)) return;
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeModules = MODULES.filter((m) => isActive(m.id));
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
    <section id="modules" className="bg-base-100 m-6 rounded-4xl px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-14">
          {/* ONE heading, at full ink. This was two stacked `<h2>`s — a second
              `<h2>` for what is one sentence's second clause, with the clause
              faded to `/55` and the lede to `/70` to fake a hierarchy that
              scale and the accent already provide. Both were also inked with
              `text-accent-content`, the ink that belongs ON `accent`, on a
              surface that is `base-100`; it happened to render dark and would
              have inverted the day `accent` moved. */}
          <div className="max-w-8xl">
            <Heading
              level={2}
              size="display"
              className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
            >
              Start with a <span className="text-primary">spark</span>.
              <br />
              Switch on the rest when you&apos;re ready.
            </Heading>
            <Text variant="lead" className="text-base-content mt-6 max-w-3xl text-2xl">
              Switch a part on and it joins the story you already have. No migration, no second
              login, no re-typing. Switch it off and your data stays exactly where it is. Pay for
              the parts you use, nothing else.
            </Text>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <ModuleToggleCard
                key={m.id}
                icon={MODULE_ICON[m.id]}
                color={m.id}
                label={m.label}
                title={m.title}
                active={isActive(m.id)}
                disabled={m.free}
                onToggle={() => toggle(m.id)}
                badgeText={
                  m.free
                    ? 'Free'
                    : m.includedWith
                      ? `Free with ${m.includedWith.join(' or ')}`
                      : `$${m.price}/mo`
                }
              />
            ))}
            <StackSummaryCard
              className="lg:col-start-4 lg:row-span-4 lg:row-start-1"
              activeCount={activeModules.filter((m) => !m.free).length}
              totalModules={PAID_MODULES.length}
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
