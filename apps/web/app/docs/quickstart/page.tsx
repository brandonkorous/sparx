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
    'Go from zero to a live sparx integration in about ten minutes — create an API key, place your first order over the REST API, read the response, and react to events.',
  alternates: { canonical: '/docs/quickstart' },
};

const REQUEST_TABS = [
  {
    label: 'cURL',
    code: `curl https://api.sparx.works/v1/crm/orders \\
  -H "Authorization: Bearer $SPARX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerId": "8a1f0b2c-9d3e-4a5b-8c6d-1e2f3a4b5c6d",
    "currency": "USD",
    "items": [
      { "sku": "INJ-6.7-CR", "name": "6.7L Common-Rail Injector", "quantity": 8, "unitPrice": 289.50 }
    ]
  }'`,
  },
  {
    label: 'Node',
    code: `const res = await fetch("https://api.sparx.works/v1/crm/orders", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.SPARX_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    customerId: "8a1f0b2c-9d3e-4a5b-8c6d-1e2f3a4b5c6d",
    currency: "USD",
    items: [
      { sku: "INJ-6.7-CR", name: "6.7L Common-Rail Injector", quantity: 8, unitPrice: 289.5 },
    ],
  }),
});
const { data: order } = await res.json();`,
  },
  {
    label: 'Python',
    code: `import os, requests

res = requests.post(
  "https://api.sparx.works/v1/crm/orders",
  headers={"Authorization": f"Bearer {os.environ['SPARX_KEY']}"},
  json={
    "customerId": "8a1f0b2c-9d3e-4a5b-8c6d-1e2f3a4b5c6d",
    "currency": "USD",
    "items": [
      {"sku": "INJ-6.7-CR", "name": "6.7L Common-Rail Injector", "quantity": 8, "unitPrice": 289.50}
    ],
  },
)
order = res.json()["data"]`,
  },
];

const RESPONSE_CODE = `{
  "success": true,
  "data": {
    "id": "0c7b1a2d-4e5f-4a6b-9c8d-2e1f0a9b8c7d",
    "orderNumber": "1042",
    "status": "placed",
    "paymentStatus": "unpaid",
    "customerId": "8a1f0b2c-9d3e-4a5b-8c6d-1e2f3a4b5c6d",
    "currency": "USD",
    "subtotal": 2316.00,
    "total": 2316.00,
    "items": [
      { "sku": "INJ-6.7-CR", "name": "6.7L Common-Rail Injector", "quantity": 8, "unitPrice": 289.50 }
    ],
    "createdAt": "2026-06-05T17:41:09Z"
  }
}`;

const WEBHOOK_CODE = `// Receive webhook deliveries — see the Webhooks guide for the full setup.
import { verifySparxWebhook } from "./verify";

export async function POST(req: Request) {
  const raw = await req.text();                       // the RAW body, for signing
  const sig = req.headers.get("x-sparx-signature") ?? "";
  if (!verifySparxWebhook(raw, sig, process.env.SPARX_WEBHOOK_SECRET)) {
    return new Response("bad signature", { status: 400 });
  }
  const event = JSON.parse(raw);                      // { id, type, tenant_id, data, … }
  if (event.type === "content.entry.published") {
    await reindex(event.data);                        // your code
  }
  return new Response("ok");                           // 2xx acknowledges delivery
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
      lede="Go from zero to a live integration in about ten minutes. You'll create an API key, place an order over the REST API, read the response, and see how to react to events — the same surface the dashboard uses, because every sparx feature is an API endpoint first."
      meta={
        <>
          <span>Updated 2026-06-05</span>
          <span>10 min read</span>
        </>
      }
      toc={[
        { id: 'overview', label: 'Overview' },
        { id: 'build', label: 'Build the integration' },
        { id: 'advanced', label: 'Conventions' },
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
        You need a sparx tenant with the <strong>CRM</strong> module active, and an existing
        customer to attach the order to. No tenant yet?{' '}
        <DocLink href="/pricing">Create one free</DocLink> — live in under five minutes, no card
        required.
      </Callout>

      <DocSection id="overview" title="Overview">
        <p>
          sparx is API-first: the dashboard, the storefront, and AI agents over MCP are all
          consumers of the same REST and GraphQL surface. An integration touches three things — an
          authenticated <strong>client</strong> (your API key), a <strong>resource</strong> you read
          or write, and the <strong>events</strong> sparx emits in response.
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
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
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
        <p>Four steps, each independently runnable against your tenant.</p>
        <Steps>
          <Step n={1} title="Create an API key" done>
            <p>
              In your dashboard, open <InlineCode>Settings → AI integrations</InlineCode> and create
              a key. The secret (<InlineCode>sk_live_…</InlineCode>) is shown once — store it as{' '}
              <InlineCode>SPARX_KEY</InlineCode>. Full details in{' '}
              <DocLink href="/docs/authentication">Authentication</DocLink>.
            </p>
            <Callout type="warn">
              Keys inherit Row-Level Security — a key can never read another tenant&rsquo;s data,
              even on a malformed request. Keep it server-side and treat it like a password.
            </Callout>
          </Step>

          <Step n={2} title="Place your first order">
            <p>
              Orders live in the CRM, which owns the customer and order spine. POST a customer id
              and one or more line items; sparx computes the totals. Here it is in three languages —
              no SDK required, just HTTP:
            </p>
            <EndpointChip method="POST" path="/v1/crm/orders" />
            <CodeBlock tabs={REQUEST_TABS} status="201 Created" />
          </Step>

          <Step n={3} title="Read the response">
            <p>
              Every response shares one envelope:{' '}
              <InlineCode>{`{ success: true, data }`}</InlineCode>. A created order comes back with
              a server-assigned id, an <InlineCode>orderNumber</InlineCode>, computed totals, and
              its lifecycle status:
            </p>
            <CodeBlock tabs={[{ label: '201 Created', code: RESPONSE_CODE }]} status="201" />
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
                  <td>The order&rsquo;s unique id (UUID).</td>
                </tr>
                <tr>
                  <td>
                    <code>orderNumber</code>
                  </td>
                  <td>
                    <TypeTag>string</TypeTag>
                  </td>
                  <td>Human-facing sequence number, auto-generated.</td>
                </tr>
                <tr>
                  <td>
                    <code>status</code>
                  </td>
                  <td>
                    <TypeTag>enum</TypeTag>
                  </td>
                  <td>
                    <code>placed</code> · <code>fulfilled</code> · <code>delivered</code> ·{' '}
                    <code>cancelled</code> · <code>refunded</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>paymentStatus</code>
                  </td>
                  <td>
                    <TypeTag>enum</TypeTag>
                  </td>
                  <td>
                    <code>unpaid</code> · <code>partially_paid</code> · <code>paid</code> ·{' '}
                    <code>refunded</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>total</code>
                  </td>
                  <td>
                    <TypeTag>number</TypeTag>
                  </td>
                  <td>
                    Computed from the line items, in <code>currency</code> units (e.g.{' '}
                    <code>2316.00</code>).
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

          <Step n={4} title="React to events">
            <p>
              Creating that order emitted an <InlineCode>order.created</InlineCode> event on the
              internal bus. To receive events in your own app, register a webhook and verify each
              signed delivery. Today the subscribable events are content, media, and redirect events
              — the full model is in{' '}
              <DocLink href="/docs/guides/webhooks">Webhooks &amp; events</DocLink>:
            </p>
            <CodeBlock tabs={[{ label: 'webhook.ts', code: WEBHOOK_CODE }]} />
            <Callout type="tip" title="The same event stream powers AI.">
              An MCP agent reads and writes live data directly — no exports, no CSVs. Webhooks are
              for notifying external systems; <DocLink href="/docs/mcp">MCP</DocLink> is for agents.
            </Callout>
          </Step>
        </Steps>
      </DocSection>

      <DocSection id="advanced" title="Conventions">
        <p>
          A couple of patterns that apply across every endpoint — worth knowing before you go
          further.
        </p>
        <Accordion title="The response envelope">
          <p>
            Success is <InlineCode>{`{ "success": true, "data": … }`}</InlineCode>. List endpoints
            add a <InlineCode>meta</InlineCode> object with pagination (
            <InlineCode>total</InlineCode>, <InlineCode>per_page</InlineCode>,{' '}
            <InlineCode>next_cursor</InlineCode>). Failures are{' '}
            <InlineCode>{`{ "success": false, "error": { "code", "message" } }`}</InlineCode> with a
            machine-readable <InlineCode>error.code</InlineCode>.
          </p>
        </Accordion>
        <Accordion title="Pagination">
          <p>
            List endpoints accept <InlineCode>take</InlineCode> (page size, default 50) and{' '}
            <InlineCode>skip</InlineCode> (offset), and return <InlineCode>meta.total</InlineCode>{' '}
            and <InlineCode>meta.next_cursor</InlineCode> so you can page through large result sets.
          </p>
        </Accordion>
        <Accordion title="Modules must be active">
          <p>
            An endpoint whose module isn&rsquo;t enabled for your tenant returns{' '}
            <InlineCode>403 module_disabled</InlineCode> rather than partial behavior. Placing an
            order requires the <InlineCode>crm</InlineCode> module; see{' '}
            <DocLink href="/docs/concepts#modules">Core concepts</DocLink>.
          </p>
        </Accordion>
      </DocSection>

      <DocSection id="errors" title="Errors & status codes">
        <p>
          sparx uses conventional HTTP status codes and returns a machine-readable{' '}
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
                <Badge tone="post">201</Badge>
              </td>
              <td>
                <code>ok</code>
              </td>
              <td>The order was created.</td>
            </tr>
            <tr>
              <td>
                <Badge tone="gray">401</Badge>
              </td>
              <td>
                <code>unauthorized</code>
              </td>
              <td>Missing, malformed, revoked, or expired API key.</td>
            </tr>
            <tr>
              <td>
                <Badge tone="gray">403</Badge>
              </td>
              <td>
                <code>module_disabled</code>
              </td>
              <td>The key&rsquo;s tenant hasn&rsquo;t activated that module.</td>
            </tr>
            <tr>
              <td>
                <Badge tone="del">429</Badge>
              </td>
              <td>
                <code>rate_limited</code>
              </td>
              <td>Too many requests — back off and retry.</td>
            </tr>
          </tbody>
        </DocTable>
        <DocQuote cite="— sparx API design principle">
          &ldquo;AI builds it, sparx keeps it.&rdquo; Every endpoint you call today is versioned and
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
            Key creation, the <code>sk_live_</code> format, scopes, and rotation.
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
            The event catalog, signed delivery, and signature verification.
          </NextCard>
          <NextCard
            href="/docs/concepts"
            title="Core concepts"
            icon={
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="#4f46e5" strokeWidth={2} />
              </svg>
            }
          >
            Tenancy & RLS, modules, the API surface, and the data layer.
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
            Create an order — every parameter, with request and response examples.
          </NextCard>
        </NextSteps>
      </DocSection>
    </DocArticle>
  );
}
