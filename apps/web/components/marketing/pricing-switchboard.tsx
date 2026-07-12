'use client';

/**
 * The pricing switchboard — the page's interactive centerpiece. A card grid
 * (one tile per module) with a fixed "Your stack" summary card in the 4th
 * column, recomputing the live bill, breakdown, and savings the instant a
 * module flips — the same card pattern proven on the homepage's switchboard,
 * built on the same shared ModuleToggleCard / StackSummaryCard.
 *
 * Dependency graph (REQUIRES / BUNDLED_FREE) is derived from the module
 * catalog's own `requires` / `includedWith` fields — mirrors the server
 * (@sparx/modules): only B2B requires Commerce (auto co-enabled + locked
 * on); Invoicing and Inventory ride free ($0, locked) while Commerce or B2B
 * is active.
 *
 * `elsewhere` is the real, published 2026 price of the tool each module
 * replaces — the same figures as the CostSavings ledger below, so the
 * switchboard and the ledger never disagree about what a stitched-together
 * stack costs.
 */
import { useState } from 'react';
import { Display } from './primitives';
import { MODULES, MODULE_HEX, MODULE_ICON } from './modules-catalog';
import { ModuleToggleCard } from './module-toggle-card';
import { StackSummaryCard, type StackLineItem } from './stack-summary-card';

const DEFAULT_ON = new Set(['builder', 'commerce', 'cms']);

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

const idByLabel = new Map(MODULES.map((m) => [m.label, m.id]));
const REQUIRES: Record<string, string> = Object.fromEntries(
  MODULES.filter((m) => m.requires).map((m) => [m.id, idByLabel.get(m.requires!)!])
);
const BUNDLED_FREE: Record<string, string[]> = Object.fromEntries(
  MODULES.filter((m) => (m.includedWith?.length ?? 0) > 0).map((m) => [
    m.id,
    m.includedWith!.map((label) => idByLabel.get(label)!),
  ])
);
const moduleName = (id: string): string => MODULES.find((m) => m.id === id)?.label ?? id;
const activeBundlers = (on: Record<string, boolean>, id: string): string[] =>
  (BUNDLED_FREE[id] ?? []).filter((p) => on[p]);
const activeRequirers = (on: Record<string, boolean>, id: string): string[] =>
  Object.keys(REQUIRES).filter((k) => REQUIRES[k] === id && on[k]);
const requiredIds = (id: string): string[] => {
  const out = new Set<string>();
  const visit = (k: string): void => {
    const dep = REQUIRES[k];
    if (dep && !out.has(dep)) {
      out.add(dep);
      visit(dep);
    }
  };
  visit(id);
  return [...out];
};
const joinNames = (ids: string[]): string => {
  const names = ids.map(moduleName);
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
};
const lockOfState = (on: Record<string, boolean>, id: string): 'included' | 'required' | null => {
  if (activeBundlers(on, id).length > 0) return 'included';
  if (activeRequirers(on, id).length > 0) return 'required';
  return null;
};

export function PricingSwitchboard() {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULES.map((m) => [m.id, DEFAULT_ON.has(m.id)]))
  );

  // Dependency model mirrors the server (@sparx/modules graph): only B2B
  // requires Commerce; a required provider is co-enabled, billed, and locked
  // on. Invoicing/Inventory are BUNDLED_FREE with Commerce/B2B — $0
  // ("Included") while either is on, else their normal price.
  const effectiveOn = (id: string): boolean =>
    !!on[id] || activeBundlers(on, id).length > 0 || activeRequirers(on, id).length > 0;
  const lockOf = (id: string): 'included' | 'required' | null => lockOfState(on, id);
  const reasonOf = (id: string): string | null => {
    const lock = lockOf(id);
    if (lock === 'included') return `Included with ${joinNames(activeBundlers(on, id))}`;
    if (lock === 'required') return `Required by ${joinNames(activeRequirers(on, id))}`;
    return null;
  };
  const billed = (id: string, price: number): number => (lockOf(id) === 'included' ? 0 : price);
  const elsewhereOf = (id: string): number =>
    lockOf(id) === 'included' ? 0 : (ELSEWHERE_MONTHLY[id] ?? 0);

  const toggle = (id: string): void =>
    setOn((s) => {
      if (lockOfState(s, id) !== null) return s; // bundled or required — locked on
      const next = { ...s, [id]: !s[id] };
      if (next[id]) for (const dep of requiredIds(id)) next[dep] = true; // co-enable requirements
      return next;
    });

  const activeModules = MODULES.filter((m) => effectiveOn(m.id));
  const total = activeModules.reduce((sum, m) => sum + billed(m.id, m.price), 0);
  const elsewhereTotal = activeModules.reduce((sum, m) => sum + elsewhereOf(m.id), 0);
  const lineItems: StackLineItem[] = activeModules.map((m) => ({
    id: m.id,
    label: m.label,
    icon: MODULE_ICON[m.id],
    color: MODULE_HEX[m.id],
    price: billed(m.id, m.price),
    included: lockOf(m.id) === 'included',
  }));

  return (
    <div className="flex flex-col gap-14">
      <div className="max-w-2xl">
        <Display as="h1" size={60} lineHeight={60}>
          Switch on what you use
        </Display>
        <p
          style={{
            margin: '18px 0 0',
            maxWidth: '480px',
            fontFamily: 'var(--font-sans)',
            fontSize: '17px',
            lineHeight: '27px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          }}
        >
          Every module is one switch. Flip it and the stack summary recomputes the instant you do —
          one platform, one invoice, nothing you&apos;re not using.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => {
          const isOn = effectiveOn(m.id);
          const lock = lockOf(m.id);
          return (
            <ModuleToggleCard
              key={m.id}
              icon={MODULE_ICON[m.id]}
              color={MODULE_HEX[m.id]}
              label={m.label}
              title={m.title}
              active={isOn}
              disabled={lock !== null}
              onToggle={() => toggle(m.id)}
              badgeText={lock === 'included' ? 'Included' : `$${m.price}/mo`}
              badgeColor={lock === 'included' ? 'success' : isOn ? 'primary' : 'neutral'}
              reason={reasonOf(m.id) ?? undefined}
            />
          );
        })}
        <StackSummaryCard
          className="lg:col-start-4 lg:row-span-4 lg:row-start-1"
          activeCount={activeModules.length}
          totalModules={MODULES.length}
          lineItems={lineItems}
          total={total}
          elsewhereTotal={elsewhereTotal}
          ctaRef="pricing-switchboard"
        />
      </div>
    </div>
  );
}
