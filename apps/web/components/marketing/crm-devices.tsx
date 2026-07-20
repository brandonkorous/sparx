import { getModuleColor, type MarketingModule, Section, SectionHeader } from './primitives';
import { Dot } from './primitives';

/**
 * More structural devices for the /crm page (split from crm-sections.tsx for
 * cohesion / line budget):
 *
 *  - CrmOneRecord ... the "no sync" argument as a before/after: a stack of
 *    tools trading webhooks vs. ONE sparx record, joined by a connector arrow
 *    that rotates to point down when the panels stack.
 *
 * Grounded in docs/11 + the dashboard activity-timeline.tsx event vocabulary.
 *
 * Class-based per SILICA-VOCABULARY.md. The "usual stack" drift markers used a
 * literal amber (#B45309); they are semantic warnings, so they now wear
 * `text-warning` / `--color-warning`. Panel header labels are device chrome.
 */

const M = getModuleColor('crm');
const WARNING = 'var(--color-warning)';

function hue(module: MarketingModule): string {
  return getModuleColor(module).color;
}

// ── ONE-RECORD PROOF (before / after) ───────────────────────────────────────────
export function CrmOneRecord() {
  const before: { module: MarketingModule | 'warn'; label: string; tag: string }[] = [
    { module: 'commerce', label: 'Store platform — the order', tag: 'webhook ↻' },
    { module: 'crm', label: 'Bolt-on CRM — a copy of the customer', tag: 'webhook ↻' },
    { module: 'email', label: 'Email tool — its own list', tag: 'sync ↻' },
    { module: 'b2b', label: 'Spreadsheet — the “real” numbers', tag: 'manual' },
  ];
  const after: { module: MarketingModule; label: string }[] = [
    { module: 'commerce', label: 'orders & spend' },
    { module: 'email', label: 'email engagement' },
    { module: 'crm', label: 'segments & pipeline' },
    { module: 'ai', label: 'AI conversations' },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="The records never disagree, because there’s only one"
        lede="Most CRMs keep a second copy of your customer, stitched to your store with webhooks that drift, dedupe rules that fight, and a 3am sync that broke. sparx CRM isn’t a copy — it reads the same rows the order does."
      />
      <div className="mt-[52px] flex flex-col items-stretch gap-0 lg:flex-row">
        <div className="min-w-0 flex-1">
          <Panel header="the usual stack" headerDot={WARNING}>
            {before.map((row, i) => (
              <div
                key={row.label}
                className={`text-ink-muted text-small flex items-center gap-[11px] px-5 py-[13px] ${
                  i === 0 ? '' : 'border-base-200 border-t'
                }`}
              >
                <Dot color={row.module === 'warn' ? WARNING : hue(row.module)} size={8} />
                <span className="min-w-0">{row.label}</span>
                <span className="text-warning text-micro ml-auto shrink-0 font-mono">
                  {row.tag}
                </span>
              </div>
            ))}
          </Panel>
        </div>
        <div className="mkt-arrow-connector" aria-hidden>
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke={M.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <Panel header="sparx · one database" headerDot={M.color} accent>
            <div className="px-5 pt-4 pb-[18px]">
              <div className="flex items-center gap-[11px] pb-1">
                <span
                  className={`${M.bg} bg-soft ${M.ink} border-module-crm text-micro flex size-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] font-medium`}
                >
                  DR
                </span>
                <span className="text-small font-medium">one customer, one row</span>
              </div>
              {after.map((row) => (
                <div
                  key={row.label}
                  className="border-base-200 text-small flex items-center gap-[11px] border-t py-2.5"
                >
                  <Dot color={hue(row.module)} size={8} />
                  <span>{row.label}</span>
                  <span
                    className={`${M.bg} bg-soft ${M.ink} text-micro ml-auto rounded-full px-2 py-[3px] font-mono`}
                  >
                    live
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Section>
  );
}

function Panel({
  header,
  headerDot,
  accent,
  children,
}: {
  header: string;
  headerDot: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-base-100 border-base-300 h-full overflow-hidden rounded-2xl border-x border-b ${
        accent ? 'border-t-module-crm border-t-[3px]' : 'border-t'
      }`}
    >
      {/* Panel caption — device chrome naming the two stacks being compared. */}
      <div className="border-base-300 text-ink-subtle text-micro flex items-center gap-[9px] border-b px-5 py-[15px] font-mono tracking-[0.05em] uppercase">
        <Dot color={headerDot} size={8} />
        {header}
      </div>
      {children}
    </div>
  );
}
