import { Section, SectionHeader, Spark } from './primitives';
import { Reveal } from './reveal';

/**
 * The developer / API beat.
 *
 * The band is `.mkt-secondary` — a solid `--color-secondary` plate — so every
 * ink inside resolves from the paired `--color-secondary-content` token rather
 * than a hand-picked white or an `rgba()` fade. The code panel is a nested
 * `data-theme="dark"` island: the whole `--color-base-*` ramp flips, so its
 * surface, border, gutter, and code ink come from tokens with no literal hexes.
 * Syntax highlighting maps to the registered module + ink colors (a real
 * palette that flips with the theme), never a frozen editor hex set.
 */

/** Syntax palette — registered color utilities, one role per entry. */
const SYN = {
  keyword: 'text-module-ai',
  string: 'text-module-dropship',
  ident: 'text-module-crm',
  number: 'text-module-commerce',
  method: 'text-module-builder',
  property: 'text-ink-muted',
  comment: 'text-ink-subtle',
} as const;

const FEATURES = [
  {
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
        <path d="M8 5L3 12L8 19M16 5L21 12L16 19" stroke="currentColor" strokeWidth={2} />
      </svg>
    ),
    title: 'REST + GraphQL',
    body: 'One schema, two transports. Versioned, deprecation-warned, never silently broken.',
  },
  {
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
        <circle cx={12} cy={12} r={3} stroke="currentColor" strokeWidth={2} />
        <path
          d="M12 1V5M12 19V23M4.2 4.2L7 7M17 17L19.8 19.8M1 12H5M19 12H23M4.2 19.8L7 17M17 7L19.8 4.2"
          stroke="currentColor"
          strokeWidth={2}
        />
      </svg>
    ),
    title: 'Pub/Sub webhooks',
    body: 'order.placed, crm.customer.created, email.send. Subscribe; we deliver with retries and signed payloads.',
  },
  {
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
        <rect x={3} y={3} width={18} height={18} rx={2} stroke="currentColor" strokeWidth={2} />
        <path d="M9 9H15V15H9V9Z" stroke="currentColor" strokeWidth={2} />
      </svg>
    ),
    title: 'Headless SDKs',
    body: 'Builder SDK for Next.js, Remix, Astro. TypeScript types generated from your schema.',
  },
  {
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
        <path d="M21 16V8L12 3L3 8V16L12 21L21 16Z" stroke="currentColor" strokeWidth={2} />
      </svg>
    ),
    title: 'Self-host or managed',
    body: 'Run sparx on your own GKE cluster, or let WizeWorks operate it ($750/mo, includes Gillett-tier support).',
  },
] as const;

export function DeveloperSection() {
  return (
    <Section id="docs" padding="xl" className="mkt-secondary text-secondary-content">
      <Reveal className="flex flex-col gap-16">
        <SectionHeader
          ledeColor="var(--color-secondary-content)"
          headline={
            <>
              API-first means
              <br />
              the UI is one consumer
              <Spark />
            </>
          }
          lede={
            <>
              Every sparx feature exists as a REST and GraphQL endpoint before it exists as a
              screen. Webhook into Pub/Sub. Ship headless with the Builder SDK. Self-host if you
              want it.
            </>
          }
        />

        <div className="flex flex-col items-stretch gap-8 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="border-secondary-content/20 bg-secondary-content/10 text-secondary-content flex flex-col gap-2 rounded-lg border p-6"
              >
                <div className="flex items-center gap-2.5">
                  {f.icon}
                  <span className="text-body-sm font-sans font-medium">{f.title}</span>
                </div>
                <span className="text-caption font-sans">{f.body}</span>
              </div>
            ))}
          </div>

          <CodeCard />
        </div>
      </Reveal>
    </Section>
  );
}

function CodeCard() {
  return (
    <div
      data-theme="dark"
      className="bg-base-100 border-base-300 border-t-primary flex flex-1 flex-col overflow-hidden rounded-xl border border-t-[3px]"
    >
      <CodeTabs />
      <CodeBody />
    </div>
  );
}

function CodeTabs() {
  return (
    <div className="bg-base-200 border-base-300 flex items-center border-b px-4">
      <span className="border-b-primary text-mini border-b px-4 py-3.5 font-mono font-medium">
        create-order.ts
      </span>
      {['curl', 'graphql.gql', 'webhook.json'].map((t) => (
        <span key={t} className="text-ink-subtle text-mini px-4 py-3.5 font-mono">
          {t}
        </span>
      ))}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="bg-success size-1.5 rounded-full" />
        <span className="text-ink-muted text-micro font-mono">200 OK · 41ms</span>
      </div>
    </div>
  );
}

const LINES = Array.from({ length: 17 }, (_, i) => i + 1);

const CODE: React.ReactNode[] = [
  <span key="c1" className={SYN.comment}>
    {'// Place a B2B order with net 30 terms'}
  </span>,
  <>
    <span className={SYN.keyword}>import</span> {'{ sparx }'}{' '}
    <span className={SYN.keyword}>from</span>{' '}
    <span className={SYN.string}>&quot;@sparx/api&quot;</span>;
  </>,
  ' ',
  <>
    <span className={SYN.keyword}>const</span> <span className={SYN.ident}>client</span> = sparx(
    {'{ '}
    <span className={SYN.property}>apiKey:</span>{' '}
    <span className={SYN.string}>process.env.SPARX_KEY</span>
    {' }'});
  </>,
  ' ',
  <>
    <span className={SYN.keyword}>const</span> <span className={SYN.ident}>order</span> ={' '}
    <span className={SYN.keyword}>await</span> client.
    <span className={SYN.number}>commerce</span>.orders.
    <span className={SYN.method}>create</span>({'{'}
  </>,
  <>
    {'  '}
    <span className={SYN.property}>customerId:</span>{' '}
    <span className={SYN.string}>&quot;cus_8R4Xz1QkM&quot;</span>,{' '}
    <span className={SYN.comment}>{'// Halcyon & Reed'}</span>
  </>,
  <>
    {'  '}
    <span className={SYN.property}>module:</span>{' '}
    <span className={SYN.string}>&quot;b2b&quot;</span>,
  </>,
  <>
    {'  '}
    <span className={SYN.property}>terms:</span> {'{ type: '}
    <span className={SYN.string}>&quot;net&quot;</span>, days:{' '}
    <span className={SYN.number}>30</span> {'}'},
  </>,
  <>
    {'  '}
    <span className={SYN.property}>poNumber:</span>{' '}
    <span className={SYN.string}>&quot;PO-8841&quot;</span>,
  </>,
  <>
    {'  '}
    <span className={SYN.property}>lines:</span> [
  </>,
  <>
    {'    { '}
    <span className={SYN.property}>sku:</span>{' '}
    <span className={SYN.string}>&quot;INJ-6.7-CR&quot;</span>,{' '}
    <span className={SYN.property}>qty:</span> <span className={SYN.number}>8</span> {' },'}
  </>,
  <>
    {'    { '}
    <span className={SYN.property}>sku:</span>{' '}
    <span className={SYN.string}>&quot;FLT-FUEL-CAT3&quot;</span>,{' '}
    <span className={SYN.property}>qty:</span> <span className={SYN.number}>24</span> {' },'}
  </>,
  '  ],',
  '});',
  ' ',
  <span key="c-final" className={SYN.comment}>
    {'// → order.id: "ord_KdQ19wPmFf" · status: "approved"'}
  </span>,
];

function CodeBody() {
  return (
    <div className="bg-base-100 flex overflow-x-auto py-6">
      <div className="border-base-300 text-ink-subtle text-mini flex flex-col gap-2 border-r px-4 font-mono leading-5">
        {LINES.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="text-mini flex flex-col gap-2 px-5 font-mono leading-5">
        {CODE.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </div>
    </div>
  );
}
