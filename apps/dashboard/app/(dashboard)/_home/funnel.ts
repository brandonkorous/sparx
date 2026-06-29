import { fmtPercent, ratio } from './format';
import { SAMPLE_FUNNEL } from './samples';
import type { FunnelStage, Raw } from './types';

// The conversion funnel — Visitors → Sessions → Signups → Add-to-cart →
// Checkout → Orders. Only the stages whose modules are active are rendered, and
// they collapse contiguously, so a CMS-only tenant sees a content funnel
// (Visitors → Sessions → Signups) and a commerce tenant sees the full chain.
// Each stage shows its step-conversion from the prior stage (more actionable
// than cumulative — it locates the leak). docs research §4.

interface Built {
  stages: FunnelStage[] | null;
  isSample: boolean;
}

function withRates(
  rows: { label: string; value: number; module: FunnelStage['module'] }[]
): FunnelStage[] {
  return rows.map((s, i) => {
    const prev = rows[i - 1];
    return {
      ...s,
      rate: i === 0 || !prev ? undefined : fmtPercent(ratio(s.value, prev.value) * 100, 0),
    };
  });
}

export function buildFunnel(raw: Raw, m: ReadonlySet<string>): Built {
  const has = (mod: string) => m.has(mod);
  const stages: { label: string; value: number; module: FunnelStage['module'] }[] = [];

  if (has('builder') && raw.siteCur) {
    stages.push({ label: 'Visitors', value: raw.siteCur.visitors, module: 'builder' });
    stages.push({ label: 'Sessions', value: raw.siteCur.sessions, module: 'builder' });
    if (!has('crm') || raw.siteCur.signups > 0) {
      stages.push({ label: 'Signups', value: raw.siteCur.signups, module: 'builder' });
    }
  }
  if (has('crm') && raw.leads && !has('builder')) {
    stages.push({ label: 'Leads', value: raw.leads.totalLeads, module: 'crm' });
  }
  if (has('commerce') && raw.funnel) {
    if (stages.length === 0) {
      stages.push({ label: 'Sessions', value: raw.funnel.sessions, module: 'commerce' });
    }
    stages.push({ label: 'Add to cart', value: raw.funnel.cartsCreated, module: 'commerce' });
    stages.push({ label: 'Checkout', value: raw.funnel.checkoutsStarted, module: 'commerce' });
    stages.push({ label: 'Orders', value: raw.funnel.ordersPlaced, module: 'commerce' });
  }

  // The funnel only earns its place at 3+ stages (research §4).
  if (stages.length < 3) return { stages: null, isSample: false };

  // A funnel with nothing at the top reads as broken (0 → 0 → 1 → 8). When the
  // first stage has no data, show a badged sample so the signature widget still
  // reads, replaced the moment real top-of-funnel traffic exists.
  const hasData = (stages[0]?.value ?? 0) > 0;
  if (!hasData) {
    return {
      stages: withRates([
        { label: 'Visitors', value: SAMPLE_FUNNEL.visitors, module: 'builder' },
        { label: 'Sessions', value: SAMPLE_FUNNEL.sessions, module: 'builder' },
        { label: 'Add to cart', value: SAMPLE_FUNNEL.addToCart, module: 'commerce' },
        { label: 'Checkout', value: SAMPLE_FUNNEL.checkout, module: 'commerce' },
        { label: 'Orders', value: SAMPLE_FUNNEL.orders, module: 'commerce' },
      ]),
      isSample: true,
    };
  }

  return { stages: withRates(stages), isSample: false };
}
