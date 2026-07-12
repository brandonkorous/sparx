'use client';

import { useState } from 'react';
import { Heading } from '@wizeworks/silicaui-react';
import { Container } from '../primitives';
import type { MarketingModule } from '../primitives';
import { MODULES, MODULE_ICON, MODULE_HEX } from '../modules-catalog';
import { ModuleToggleCard } from '../module-toggle-card';
import { StackSummaryCard, type StackLineItem } from '../stack-summary-card';
import { SECTION_DISPLAY_STYLE } from './heading-style';

// The "switch on what you need" beat. A real, clickable switchboard built
// from the actual module catalog (price, bundling, icon) — the card tile and
// the "Your stack" summary are the shared components /pricing's switchboard
// also builds on, so the two surfaces read identically.

const DEFAULT_ACTIVE: MarketingModule[] = ['builder', 'commerce', 'crm'];

// The real, published market rate each module replaces — mirrors the vetted
// `elsewhere` figures on the /pricing switchboard so the two pages never
// disagree about what a stitched-together stack costs.
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

export function LandingV2Switchboard() {
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
    <section
      id="modules"
      className="mkt-brand bg-accent px-[var(--gutter-page)] py-[var(--section-py-xl)]"
    >
      <Container>
        <div className="flex flex-col gap-14">
          <div className="max-w-3xl">
            <Heading
              level={2}
              size="display"
              style={SECTION_DISPLAY_STYLE}
              className="text-accent-content"
            >
              Start with a spark.
            </Heading>
            <Heading
              level={2}
              size="display"
              style={SECTION_DISPLAY_STYLE}
              className="text-accent-content"
            >
              <span style={{ opacity: 0.55 }}>Switch on the rest when you&apos;re ready.</span>
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
              ctaRef="landing-v2-switchboard"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
