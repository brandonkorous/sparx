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
 * (@wizeworks/modules): only B2B requires Commerce (auto co-enabled + locked
 * on); Invoicing and Inventory ride free ($0, locked) while Commerce or B2B
 * is active.
 *
 * `elsewhere` is the real, published 2026 price of the tool each module
 * replaces — the same figures as the CostSavings ledger below, so the
 * switchboard and the ledger never disagree about what a stitched-together
 * stack costs.
 */
import { useState } from 'react';
import { Text } from '@wizeworks/silicaui-react';
import { Display } from './primitives';
import { MODULES, PAID_MODULES, MODULE_HEX, MODULE_ICON } from './modules-catalog';
import { ModuleToggleCard } from './module-toggle-card';
import { StackSummaryCard, type StackLineItem } from './stack-summary-card';

const DEFAULT_ON = new Set(['builder', 'commerce', 'cms']);

const ELSEWHERE_MONTHLY: Record<string, number> = {
  builder: 39,
  commerce: 399,
  cms: 99,
  crm: 300,
  invoicing: 33,
  email: 165,
  b2b: 2400,
  dropship: 60,
  inventory: 99,
  chat: 74,
  scheduling: 61,
  ai: 103,
  // An expense tracker, NOT an accounting package — sparx does not replace
  // QuickBooks and must not price itself as though it did.
  finance: 54,
  // Scheduling plus a time clock, which is what a nine-person business buys.
  // NOT a payroll bureau — sparx does not run payroll.
  staff: 60,
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
// SEO and Automations are free platform capabilities, not billable modules:
// always on, never togglable, and deliberately absent from ELSEWHERE_MONTHLY so
// they add $0 to BOTH sides of the comparison. Pricing a "what this replaces"
// figure for them would need real sourced 2026 competitor prices and would move
// the advertised savings total, so it stays a deliberate omission.
const FREE_IDS = new Set<string>(MODULES.filter((m) => m.free).map((m) => m.id));

type Lock = 'included' | 'required' | 'free' | null;

const lockOfState = (on: Record<string, boolean>, id: string): Lock => {
  if (FREE_IDS.has(id)) return 'free';
  if (activeBundlers(on, id).length > 0) return 'included';
  if (activeRequirers(on, id).length > 0) return 'required';
  return null;
};

export function PricingSwitchboard() {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULES.map((m) => [m.id, DEFAULT_ON.has(m.id)]))
  );

  // Dependency model mirrors the server (@wizeworks/modules graph): only B2B
  // requires Commerce; a required provider is co-enabled, billed, and locked
  // on. Invoicing/Inventory are BUNDLED_FREE with Commerce/B2B — $0
  // ("Included") while either is on, else their normal price.
  const effectiveOn = (id: string): boolean =>
    !!on[id] ||
    FREE_IDS.has(id) ||
    activeBundlers(on, id).length > 0 ||
    activeRequirers(on, id).length > 0;
  const lockOf = (id: string): Lock => lockOfState(on, id);
  const reasonOf = (id: string): string | null => {
    const lock = lockOf(id);
    if (lock === 'free') return 'Free with sparx';
    if (lock === 'included') return `Included with ${joinNames(activeBundlers(on, id))}`;
    if (lock === 'required') return `Required by ${joinNames(activeRequirers(on, id))}`;
    return null;
  };
  const billed = (id: string, price: number): number => {
    const lock = lockOf(id);
    return lock === 'included' || lock === 'free' ? 0 : price;
  };
  // Mirrors `billed`: only the $0 sides (bundled-free, platform-free) drop off
  // the comparison. A `required` module is still paid for, so it still counts.
  const elsewhereOf = (id: string): number => {
    const lock = lockOf(id);
    return lock === 'included' || lock === 'free' ? 0 : (ELSEWHERE_MONTHLY[id] ?? 0);
  };

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
        <Text variant="lead" className="mt-4 max-w-[480px]">
          Every module is one switch. Flip it and the stack summary recomputes the instant you do —
          one platform, one invoice, nothing you&apos;re not using.
        </Text>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => {
          const isOn = effectiveOn(m.id);
          const lock = lockOf(m.id);
          return (
            <ModuleToggleCard
              key={m.id}
              icon={MODULE_ICON[m.id]}
              color={m.id}
              label={m.label}
              title={m.title}
              active={isOn}
              disabled={lock !== null}
              onToggle={() => toggle(m.id)}
              badgeText={
                lock === 'free' ? 'Free' : lock === 'included' ? 'Included' : `$${m.price}/mo`
              }
              reason={reasonOf(m.id) ?? undefined}
            />
          );
        })}
        <StackSummaryCard
          className="lg:col-start-4 lg:row-span-4 lg:row-start-1"
          activeCount={activeModules.filter((m) => !m.free).length}
          totalModules={PAID_MODULES.length}
          lineItems={lineItems}
          total={total}
          elsewhereTotal={elsewhereTotal}
          ctaRef="pricing-switchboard"
        />
      </div>
    </div>
  );
}
