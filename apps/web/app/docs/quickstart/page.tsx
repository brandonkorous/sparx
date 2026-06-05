import type { Metadata } from 'next';
import {
  DocArticle,
  DocSection,
  Callout,
  Steps,
  Step,
  Accordion,
  DocTable,
  TypeTag,
  Badge,
  EndpointChip,
  DocQuote,
  DocFigure,
  NextSteps,
  NextCard,
  InlineCode,
  DocLink,
} from '@/components/docs/prose';
import { CodeBlock } from '@/components/docs/code-block';

export const metadata: Metadata = {
  title: 'Quickstart',
  description:
    'Go from zero to a live Sparx integration in about ten minutes — create an API key, install the SDK, place your first order, and subscribe to an event.',
  alternates: { canonical: '/docs/quickstart' },
};

const INSTALL_TABS = [
  { label: 'pnpm', code: 'pnpm add @sparx/api' },
  { label: 'npm', code: 'npm install @sparx/api' },
  { label: 'bun', code: 'bun add @sparx/api' },
];

const REQUEST_TABS = [
  {
    label: 'TypeScript',
    code: `import { sparx } from "@sparx/api";

const client = sparx({ apiKey: process.env.SPARX_KEY });

const order = await client.commerce.orders.create({
  customerId: "cus_8R4Xz1QkM",
  terms: { type: "net", days: 30 },
  lines: [{ sku: "INJ-6.7-CR", qty: 8 }],
});`,
  },
  {
    label: 'cURL',
    code: `curl https://api.sparx.works/v1/commerce/orders \\
  -H "Authorization: Bearer $SPARX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "customerId": "cus_8R4Xz1QkM",
        "lines": [{ "sku": "INJ-6.7-CR", "qty": 8 }] }'`,
  },
  {
    label: 'Python',
    code: `from sparx import Sparx

client = Sparx(api_key=os.environ["SPARX_KEY"])

order = client.commerce.orders.create(
  customer_id="cus_8R4Xz1QkM",
  lines=[{"sku": "INJ-6.7-CR", "qty": 8}],
)`,
  },
  {
    label: 'GraphQL',
    code: `mutation CreateOrder {
  commerceOrderCreate(input: {
    customerId: "cus_8R4Xz1QkM"
    lines: [{ sku: "INJ-6.7-CR", qty: 8 }]
  }) { id status total { amount currency } }
}`,
  },
];

const SUBSCRIBE_CODE = `// Verify the signature, then react to the event
export async function POST(req: Request) {
  const event = await client.webhooks.verify(req, process.env.SPARX_WEBHOOK_SECRET);
  if (event.type === "order.created") {
    await fulfil(event.data); // your code
  }
  return new Response("ok");
}`;

export default function QuickstartPage() {
  return (
    <DocArticle
      breadcrumb={[
        { label: 'Docs', href: '/docs' },
        { label: 'Getting started' },
        { label: 'Quickstart' },
      ]}
      title="Quickstart"
      badge={<Badge tone="gray">API v1</Badge>}
      lede="Go from zero to a live integration in about ten minutes. You'll create an API key, install the SDK, place your first order, and subscribe to an event — the same path the dashboard takes, because every Sparx feature is an API endpoint first."
      meta={
        <>
          <span>Updated 2026-06-05</span>
          <span>10 min read</span>
        </>
      }
      toc={[
        { id: 'overview', label: 'Overview' },
        { id: 'build', label: 'Build the integration' },
        { id: 'advanced', label: 'Advanced topics' },
        { id: 'errors', label: 'Errors & status codes' },
        { id: 'faq', label: 'Frequently asked' },
        { id: 'next', label: 'Next steps' },
      ]}
      editPath="apps/web/app/docs/quickstart/page.tsx"
      updated="2026-06-05"
      prev={{ title: 'Introduction', href: '/docs' }}
      next={{ title: 'Authentication', href: '/docs/authentication' }}
    >
      <Callout type="info" title="Prerequisites">
        You need a Sparx tenant and Node.js 20+. No tenant yet?{' '}
        <DocLink href="/#pricing">Create one free</DocLink> — live in under five minutes, no card
        required.
      </Callout>

      <DocSection id="overview" title="Overview">
        <p>
          Sparx is API-first: the dashboard, the storefront, and AI agents over MCP are all just
          consumers of the same REST and GraphQL surface. An integration touches three things — an
          authenticated <strong>client</strong>, a <strong>resource</strong> you read or write, and
          the <strong>events</strong> Sparx emits in response.
        </p>
        <DocFigure caption="A write returns immediately and emits an event; side effects run in workers, never inline in the request.">
          <span className="pillbox">Your app</span>
          <span className="arrow">
            <svg width={40} height={16} viewBox="0 0 40 16" fill="none" aria-hidden>
              <path d="M0 8H36M36 8L29 2M36 8L29 14" stroke="currentColor" strokeWidth={1.5} />
            </svg>
          </span>
          <span
            className="pillbox"
            style={{ borderColor: 'var(--sparx-primary)', color: 'var(--sparx-primary-hover)' }}
          >
            api.sparx.works/v1
          </span>
          <span className="arrow">
            <svg width={40} height={16} viewBox="0 0 40 16" fill="none" aria-hidden>
              <path d="M0 8H36M36 8L29 2M36 8L29 14" stroke="currentColor" strokeWidth={1.5} />
            </svg>
          </span>
          <span className="pillbox">Pub/Sub event</span>
        </DocFigure>
      </DocSection>

      <DocSection id="build" title="Build the integration">
        <p>Follow these five steps. Each one is independently runnable against your tenant.</p>
        <Steps>
          <Step n={1} title="Create an API key" done>
            <p>
              In your dashboard, open <InlineCode>Settings → API keys</InlineCode> and create a
              secret key. Scope it to only the modules you’ll call. Store it as{' '}
              <InlineCode>SPARX_KEY</InlineCode> — you won’t be able to view it again.
            </p>
            <Callout type="warn">
              Keys inherit Row-Level Security — a key can never read another tenant’s data, even on
              a malformed request. Treat it like a password anyway.
            </Callout>
          </Step>

          <Step n={2} title="Install the SDK" done>
            <p>Add the typed client for your package manager:</p>
            <CodeBlock tabs={INSTALL_TABS} />
          </Step>

          <Step n={3} title="Make your first request">
            <p>
              Every endpoint lives under <InlineCode>api.sparx.works/v1</InlineCode>. Here’s a B2B
              order placed with net-30 terms, in four languages:
            </p>
            <EndpointChip method="POST" path="/v1/commerce/orders" />
            <CodeBlock tabs={REQUEST_TABS} status="200 OK · 41ms" />
          </Step>

          <Step n={4} title="Handle the response">
            <p>
              Successful writes return the created resource with a server-assigned{' '}
              <InlineCode>id</InlineCode> and computed fields. The shape is identical across REST,
              GraphQL, and the SDK:
            </p>
            <DocTable>
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>Field</th>
                  <th style={{ width: '22%' }}>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>id</code>
                  </td>
                  <td>
                    <TypeTag>string</TypeTag>
                  </td>
                  <td>
                    Stable identifier, prefixed by type (<code>ord_</code>).
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>status</code>
                  </td>
                  <td>
                    <TypeTag>enum</TypeTag>
                  </td>
                  <td>
                    <code>approved</code> · <code>pending_review</code> · <code>rejected</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>total</code>
                  </td>
                  <td>
                    <TypeTag>Money</TypeTag>
                  </td>
                  <td>
                    Computed line total in minor units, with <code>currency</code>.
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>createdAt</code>
                  </td>
                  <td>
                    <TypeTag>string</TypeTag>
                  </td>
                  <td>ISO-8601 timestamp, always UTC.</td>
                </tr>
              </tbody>
            </DocTable>
          </Step>

          <Step n={5} title="Subscribe to events">
            <p>
              Side effects are event-driven. Rather than polling, subscribe to{' '}
              <InlineCode>order.created</InlineCode> and let Sparx deliver signed payloads with
              retries.
            </p>
            <CodeBlock tabs={[{ label: 'webhook.ts', code: SUBSCRIBE_CODE }]} />
            <Callout type="tip" title="The same event stream powers AI.">
              An MCP agent reads live orders and writes back the moment they’re created — no
              exports, no CSVs. Webhooks are just one consumer.
            </Callout>
          </Step>
        </Steps>
      </DocSection>

      <DocSection id="advanced" title="Advanced topics">
        <p>
          The basics above cover most integrations. These deeper behaviors matter once you go to
          production — expand what’s relevant.
        </p>
        <Accordion title="Idempotency keys">
          <p>
            Pass an <InlineCode>Idempotency-Key</InlineCode> header on any write. Sparx stores the
            result for 24 hours and replays it if the same key arrives again, so a retried request
            never double-charges or double-creates.
          </p>
        </Accordion>
        <Accordion title="Pagination & cursors">
          <p>
            List endpoints return a <InlineCode>cursor</InlineCode>. Pass it as{' '}
            <InlineCode>?after=</InlineCode> to fetch the next page. Cursors are stable across
            inserts, so you never skip or repeat a record mid-iteration.
          </p>
        </Accordion>
        <Accordion title="Sandbox vs. live keys">
          <p>
            A key prefixed <InlineCode>sk_test_</InlineCode> writes to an isolated sandbox tenant;{' '}
            <InlineCode>sk_live_</InlineCode> hits production. Both share the same API surface, so
            you promote an integration by swapping one environment variable.
          </p>
        </Accordion>
      </DocSection>

      <DocSection id="errors" title="Errors & status codes">
        <p>
          Sparx uses conventional HTTP status codes and returns a machine-readable{' '}
          <InlineCode>error.code</InlineCode> on every failure. Handle these at minimum:
        </p>
        <DocTable>
          <thead>
            <tr>
              <th style={{ width: '16%' }}>Status</th>
              <th style={{ width: '30%' }}>Code</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Badge tone="post">200</Badge>
              </td>
              <td>
                <code>ok</code>
              </td>
              <td>Request succeeded.</td>
            </tr>
            <tr>
              <td>
                <Badge tone="gray">401</Badge>
              </td>
              <td>
                <code>unauthorized</code>
              </td>
              <td>Missing or invalid API key.</td>
            </tr>
            <tr>
              <td>
                <Badge tone="gray">403</Badge>
              </td>
              <td>
                <code>module_disabled</code>
              </td>
              <td>The key’s tenant hasn’t activated that module.</td>
            </tr>
            <tr>
              <td>
                <Badge tone="del">429</Badge>
              </td>
              <td>
                <code>rate_limited</code>
              </td>
              <td>
                Too many requests — back off using <code>Retry-After</code>.
              </td>
            </tr>
          </tbody>
        </DocTable>
        <DocQuote cite="— Sparx API design principle">
          “AI builds it, Sparx keeps it.” Every endpoint you call today is versioned and
          deprecation-warned — never silently broken under you.
        </DocQuote>
      </DocSection>

      <DocSection id="faq" title="Frequently asked">
        <Accordion title="Do I need the dashboard to use the API?">
          <p>
            No. The dashboard is one consumer of the API — you can run an entire tenant headless.
            The only thing that requires the dashboard is creating your first API key.
          </p>
        </Accordion>
        <Accordion title="Is GraphQL or REST recommended?">
          <p>
            Both are first-class and derived from one schema. Use REST for simple writes and
            webhooks; reach for GraphQL when you need to fetch a deep object graph in one round
            trip.
          </p>
        </Accordion>
      </DocSection>

      <DocSection id="next" title="Next steps">
        <NextSteps>
          <NextCard
            href="/docs/authentication"
            title="Authentication"
            icon={
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x={3} y={11} width={18} height={11} rx={2} stroke="#4f46e5" strokeWidth={2} />
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="#4f46e5" strokeWidth={2} />
              </svg>
            }
          >
            Key scopes, rotation, and how RLS isolates every request.
          </NextCard>
          <NextCard
            href="/docs/guides/webhooks"
            title="Webhooks & events"
            icon={
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx={12} cy={12} r={3} stroke="#4f46e5" strokeWidth={2} />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#4f46e5" strokeWidth={2} />
              </svg>
            }
          >
            The full event catalog and signature verification.
          </NextCard>
          <NextCard
            href="/docs/sdks/builder"
            title="Builder SDK"
            icon={
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M8 5L3 12l5 7M16 5l5 7-5 7" stroke="#4f46e5" strokeWidth={2} />
              </svg>
            }
          >
            Ship headless on Next.js, Remix, or Astro with typed data.
          </NextCard>
          <NextCard
            href="/docs/api/orders/create"
            title="API reference"
            icon={
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x={4} y={4} width={16} height={16} rx={3} stroke="#4f46e5" strokeWidth={2} />
                <path d="M9 9h6v6H9z" stroke="#4f46e5" strokeWidth={2} />
              </svg>
            }
          >
            Every endpoint, with request and response examples.
          </NextCard>
        </NextSteps>
      </DocSection>
    </DocArticle>
  );
}
