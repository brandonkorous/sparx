import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Dot, getModuleColor, type MarketingModule, Spark } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The markup-heavy structural devices for the /crm page, split out of
 * crm-page.tsx so each file stays cohesive:
 *
 *  - CrmHero ........... tinted-band hero: split copy + the UNIFIED CUSTOMER
 *    RECORD card (stats + module-colored signals) that crossfades through
 *    EXAMPLE_BUSINESSES so CRM reads as the spine for ANY business. The marquee
 *    device — one person, a signal from every module, colored by source.
 *  - RecordCard ........ the record itself.
 *
 * Grounded in docs/11 (CRM PRD) + the real dashboard CRM surfaces (record
 * stats, activity event vocabulary). CRM cyan is a signal, not fill.
 *
 * Class-based per SILICA-VOCABULARY.md; the only inline styles left are the
 * per-module hue VALUES the record's signal dots and the avatar ring need.
 */

const M = getModuleColor('crm');

/** Module hue for a signal source — the record colors each signal by module. */
function sourceColor(module: MarketingModule): string {
  return getModuleColor(module).color;
}

// ── HERO ──────────────────────────────────────────────────────────────────────
export function CrmHero() {
  const lede =
    'sparx CRM is the customer spine — profiles, activity, segments, pipeline, and automation, all on the same database as your orders, emails, and quotes. No sync, no Zapier, no “which system is right?” The record is the record.';
  const chips = [
    'one record, every module',
    'live segments',
    'pipeline + forecast',
    'no sync, ever',
  ];
  return (
    <section className={`${M.bg} bg-soft px-page pb-section-lg pt-[clamp(56px,9vw,96px)]`}>
      <Container>
        <div className="flex flex-col items-center gap-[clamp(40px,6vw,72px)] lg:flex-row">
          <div className="min-w-0 flex-1">
            <Display as="h1" size={84} lineHeight={80}>
              One customer, every signal
              <Spark color={M.color} />
            </Display>
            <p className="mt-7 max-w-[560px] text-[clamp(16px,1.6vw,20px)] leading-[1.55]">
              {lede}
            </p>
            <div className="mt-[34px] flex flex-wrap items-center gap-3">
              <Button color="primary" size="lg">
                Activate CRM →
              </Button>
              <a href="#record">
                <Button size="lg" variant="outline">
                  See a customer record
                </Button>
              </a>
            </div>
            <ul className="mt-[26px] flex list-none flex-wrap items-center gap-2.5">
              {chips.map((c) => (
                <li
                  key={c}
                  className="bg-base-100 border-base-300 inline-flex items-center gap-2 rounded-full border px-[13px] py-[7px]"
                >
                  <Dot color={M.color} size={6} />
                  <span className="font-mono text-sm">{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div id="record" className="w-full min-w-0 flex-1 scroll-mt-20">
            <Cycle
              items={EXAMPLE_BUSINESSES.map((b) => (
                <RecordCard key={b.domain} business={b} />
              ))}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The hero's product-surface proof — one real customer record, every module's
 *  signal attached, colored by source. Crossfades through EXAMPLE_BUSINESSES;
 *  every scene has the same 3 stats + 5 signals so the card never reflows. */
function RecordCard({ business }: { business: ExampleBusiness }) {
  const { crm, customer } = business;
  return (
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border shadow-lg">
      <div className="border-base-300 flex items-center gap-[13px] border-b px-5 py-[18px]">
        <span
          className={`${M.bg} bg-soft ${M.ink} border-module-crm text-md flex size-[42px] shrink-0 items-center justify-center rounded-full border-[1.5px] font-medium`}
        >
          {crm.initials}
        </span>
        <span className="min-w-0">
          <span className="text-md block font-medium">{customer.name}</span>
          {/* Record chrome inside the mimicked CRM surface. */}
          <span className="font-mono text-sm">{crm.type} · one record · 5 live signals</span>
        </span>
        <Dot color={M.color} size={9} />
      </div>
      <div className="border-base-300 grid grid-cols-3 border-b">
        {[
          [crm.totalSpent, 'total spent'],
          [String(crm.orders), 'orders'],
          [crm.avgOrder, 'avg order'],
        ].map(([v, l], i) => (
          <div key={l} className={`px-[18px] py-3.5 ${i === 0 ? '' : 'border-base-200 border-l'}`}>
            <div className="text-lg font-medium tracking-[-0.01em]">{v}</div>
            <div className="mt-0.5 font-mono text-sm">{l}</div>
          </div>
        ))}
      </div>
      <div className="px-5 pt-1.5 pb-3.5">
        {/* Panel label inside the record UI — device chrome, sentence case. */}
        <div className="pt-3 pb-1 font-mono text-sm">activity · from every module</div>
        {crm.signals.map((s, i) => (
          <div
            key={s.label}
            className={`flex items-center gap-[11px] py-2.5 text-sm ${
              i === 0 ? '' : 'border-base-200 border-t'
            }`}
          >
            <Dot color={sourceColor(s.module)} size={8} />
            <span className="min-w-0">{s.label}</span>
            <span className="border-base-300 ml-auto shrink-0 rounded-full border px-2 py-[3px] font-mono text-sm">
              {s.module === 'ai' ? 'mcp' : s.module}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
