import { getModuleColor, type MarketingModule, Section, SectionHeader } from './primitives';
import { Dot } from './primitives';

/**
 * More structural devices for the /crm page (split from crm-sections.tsx for
 * cohesion / line budget):
 *
 *  - CrmOneRecord ... the "no sync" argument as a before/after: a stack of
 *    tools trading webhooks vs. ONE sparx record, joined by a connector arrow
 *    that rotates to point down when the panels stack.
 *  - CrmTimeline .... the append-only activity feed (module-colored markers,
 *    real CRM event types) beside three callout pins.
 *
 * Grounded in docs/11 + the dashboard activity-timeline.tsx event vocabulary.
 */

const M = getModuleColor('crm');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

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
      <div
        className="mkt-stack-on-tablet"
        style={{ marginTop: '52px', gap: 0, alignItems: 'stretch' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Panel header="the usual stack" headerDot="#B45309">
            {before.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '13px 20px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--color-base-200)',
                  fontFamily: SANS,
                  fontSize: '13.5px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                }}
              >
                <Dot color={row.module === 'warn' ? '#B45309' : hue(row.module)} size={8} />
                <span style={{ minWidth: 0 }}>{row.label}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: MONO,
                    fontSize: '10.5px',
                    color: '#B45309',
                    flexShrink: 0,
                  }}
                >
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <Panel header="sparx · one database" headerDot={M.color} accent>
            <div style={{ padding: '16px 20px 18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  paddingBottom: '4px',
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '9999px',
                    backgroundColor: M.tint,
                    border: `1.5px solid ${M.color}`,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: SANS,
                    fontWeight: 500,
                    fontSize: '11px',
                    color: M.text,
                  }}
                >
                  DR
                </span>
                <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '14px' }}>
                  one customer, one row
                </span>
              </div>
              {after.map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '11px',
                    padding: '10px 0',
                    borderTop: '1px solid var(--color-base-200)',
                    fontFamily: SANS,
                    fontSize: '13.5px',
                  }}
                >
                  <Dot color={hue(row.module)} size={8} />
                  <span>{row.label}</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontFamily: MONO,
                      fontSize: '10.5px',
                      color: M.text,
                      padding: '3px 8px',
                      backgroundColor: M.tint,
                      borderRadius: '9999px',
                    }}
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
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderTop: accent ? `3px solid ${M.color}` : '1px solid var(--color-base-300)',
        borderRadius: '16px',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '15px 20px',
          borderBottom: '1px solid var(--color-base-300)',
          fontFamily: MONO,
          fontSize: '11px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
        }}
      >
        <Dot color={headerDot} size={8} />
        {header}
      </div>
      {children}
    </div>
  );
}
