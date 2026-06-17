import type { Metadata } from 'next';
import {
  DocArticle,
  DocSection,
  DocSubsection,
  Callout,
  DocTable,
  DocImage,
  EndpointChip,
  InlineCode,
  DocLink,
} from '@/components/docs/prose';
import { CodeBlock } from '@/components/docs/code-block';

export const metadata: Metadata = {
  title: 'Webhooks & events',
  description:
    'Subscribe to sparx events over HTTP. Create a signed webhook subscription, verify the HMAC-SHA256 signature, and handle retries — with the full event catalog.',
  alternates: { canonical: '/docs/guides/webhooks' },
};

const CREATE_REQUEST = `curl https://api.sparx.works/v1/webhooks/subscriptions \\
  -H "Authorization: Bearer $SPARX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Content sync",
    "url": "https://example.com/hooks/sparx",
    "events": ["content.entry.published", "content.entry.updated"]
  }'`;

const CREATE_RESPONSE = `{
  "success": true,
  "data": {
    "id": "b7e3a1c2-9f4d-4a1b-8c2e-1f0a9d6b3e57",
    "name": "Content sync",
    "url": "https://example.com/hooks/sparx",
    "events": ["content.entry.published", "content.entry.updated"],
    "active": true,
    "signingSecret": "whsec_3f9a…e21",   // shown ONCE — store it now
    "createdAt": "2026-06-05T17:41:09Z"
  }
}`;

const DELIVERY = `POST /hooks/sparx HTTP/1.1
Host: example.com
Content-Type: application/json
X-sparx-Event: content.entry.published
X-sparx-Delivery: 2b9f0c14-7e6a-4d33-9b2f-5a1c8e0d44a1
X-sparx-Signature: sha256=9d1e7c…f04b

{
  "id": "2b9f0c14-7e6a-4d33-9b2f-5a1c8e0d44a1",   // the delivery id
  "type": "content.entry.published",
  "tenant_id": "a1c2d3e4-…",
  "data": { /* the event payload — shape varies by event type */ },
  "delivered_at": "2026-06-05T17:41:10Z"
}`;

const VERIFY = `import { createHmac, timingSafeEqual } from "node:crypto";

// IMPORTANT: verify against the RAW request body, before any JSON parse.
// Re-serializing the JSON changes the bytes and the signature won't match.
export function verifySparxWebhook(rawBody: string, header: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = header.replace(/^sha256=/, "");
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

// In your handler:
//   const sig = req.headers["x-sparx-signature"];
//   if (!verifySparxWebhook(rawBody, sig, process.env.SPARX_WEBHOOK_SECRET)) {
//     return new Response("bad signature", { status: 400 });
//   }`;

const PAUSE = `curl -X PATCH https://api.sparx.works/v1/webhooks/subscriptions/$ID \\
  -H "Authorization: Bearer $SPARX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "active": false }'`;

export default function WebhooksPage() {
  return (
    <DocArticle
      breadcrumb={[
        { label: 'Docs', href: '/docs' },
        { label: 'Guides' },
        { label: 'Webhooks & events' },
      ]}
      title="Webhooks & events"
      lede="sparx publishes a business event for everything that happens — an order is paid, a content entry is published, a customer is created. Subscribe a URL to the events you care about and sparx delivers each one as a signed HTTP POST, with retries."
      meta={
        <>
          <span>Updated 2026-06-05</span>
          <span>9 min read</span>
        </>
      }
      toc={[
        { id: 'overview', label: 'Overview' },
        { id: 'subscribe', label: 'Create a subscription' },
        { id: 'events', label: 'Subscribable events' },
        { id: 'payload', label: 'The delivery payload' },
        { id: 'verify', label: 'Verify the signature' },
        { id: 'retries', label: 'Retries & failure' },
        { id: 'manage', label: 'Manage subscriptions' },
        { id: 'catalog', label: 'Full event catalog' },
      ]}
      editPath="apps/web/app/docs/guides/webhooks/page.tsx"
      updated="2026-06-05"
      prev={{ title: 'Building a template', href: '/docs/guides/building-a-template' }}
      next={{ title: 'Authentication', href: '/docs/authentication' }}
    >
      <DocSection id="overview" title="Overview">
        <p>
          Internally, every sparx event is published to a per-topic Google Pub/Sub stream and
          consumed by platform workers (the email worker, the search indexer, cache revalidation,
          and more). Webhooks expose that same stream to <strong>you</strong>: register an HTTPS
          endpoint, list the events you want, and sparx POSTs each matching event to your URL.
        </p>
        <ul>
          <li>
            <strong>Signed.</strong> Every delivery carries an{' '}
            <InlineCode>X-sparx-Signature</InlineCode> HMAC so you can prove it came from sparx.
          </li>
          <li>
            <strong>At-least-once.</strong> A non-2xx response is retried with exponential backoff
            for up to ~7.5 hours — design your handler to be idempotent.
          </li>
          <li>
            <strong>Tenant-scoped.</strong> A subscription only ever receives its own tenant’s
            events; isolation is enforced at the database layer by Row-Level Security.
          </li>
        </ul>
        <Callout type="note" title="Webhooks are one consumer; MCP is another">
          The event stream also powers the <DocLink href="/docs/mcp">MCP server</DocLink>, which
          lets AI agents react to live data directly. Webhooks are the right tool when an external
          system needs to be notified; reach for MCP when an agent needs to read and write.
        </Callout>
      </DocSection>

      <DocSection id="subscribe" title="Create a subscription">
        <p>
          Subscriptions are created via the API today — a tenant admin posts a name, a URL, and the
          events to listen for. (A dashboard editor is on the roadmap; until it ships, the dashboard
          points you here.) Creating one returns a <strong>signing secret exactly once</strong>;
          store it immediately, because every later read shows only a redacted preview.
        </p>
        <DocImage
          src="/docs/dash-webhooks.png"
          alt="The CMS → Webhooks screen, marked ‘coming soon’ — it explains that backend wiring is live and directs you to configure subscriptions via POST /v1/webhooks/subscriptions, and lists the subscribable content events."
          caption="The dashboard webhook editor is on the roadmap; today you create subscriptions through the API."
        />
        <EndpointChip method="POST" path="/v1/webhooks/subscriptions" />
        <CodeBlock tabs={[{ label: 'cURL', code: CREATE_REQUEST }]} />
        <p>
          The response returns the created subscription, including the full secret this one time:
        </p>
        <CodeBlock tabs={[{ label: '201 Created', code: CREATE_RESPONSE }]} status="201" />
        <Callout type="warn" title="Store the signing secret now">
          The full <InlineCode>signingSecret</InlineCode> (<InlineCode>whsec_…</InlineCode>) is only
          ever returned in this create response. <InlineCode>GET</InlineCode> and{' '}
          <InlineCode>PATCH</InlineCode> return a redacted preview (first 8 characters). If you lose
          it, rotate by deleting and recreating the subscription.
        </Callout>
      </DocSection>

      <DocSection id="events" title="Subscribable events">
        <p>
          A subscription names one or more event types in its <InlineCode>events</InlineCode> array.
          Today the following events are available for webhook delivery:
        </p>
        <DocTable>
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Event</th>
              <th>Fires when</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>content.entry.created</code>
              </td>
              <td>A content entry (page, blog post, …) is created.</td>
            </tr>
            <tr>
              <td>
                <code>content.entry.updated</code>
              </td>
              <td>An entry’s fields change.</td>
            </tr>
            <tr>
              <td>
                <code>content.entry.published</code>
              </td>
              <td>An entry goes live.</td>
            </tr>
            <tr>
              <td>
                <code>content.entry.scheduled</code>
              </td>
              <td>An entry is scheduled to publish later.</td>
            </tr>
            <tr>
              <td>
                <code>content.entry.unpublished</code>
              </td>
              <td>A live entry is taken down.</td>
            </tr>
            <tr>
              <td>
                <code>content.entry.deleted</code>
              </td>
              <td>An entry is deleted.</td>
            </tr>
            <tr>
              <td>
                <code>media.uploaded</code>
              </td>
              <td>A media asset is uploaded.</td>
            </tr>
            <tr>
              <td>
                <code>media.processed</code>
              </td>
              <td>Derivatives/transforms for an asset finish processing.</td>
            </tr>
            <tr>
              <td>
                <code>redirect.added</code>
              </td>
              <td>A URL redirect is created.</td>
            </tr>
            <tr>
              <td>
                <code>redirect.removed</code>
              </td>
              <td>A URL redirect is removed.</td>
            </tr>
          </tbody>
        </DocTable>
        <Callout type="note">
          The full platform <DocLink href="#catalog">event catalog</DocLink> is much larger (orders,
          carts, inventory, email, and more). Those events flow on the internal Pub/Sub bus today;
          additional event families are being opened up for webhook subscription over time. If you
          need one that isn’t listed above yet, it’s on the roadmap — not missing by design.
        </Callout>
      </DocSection>

      <DocSection id="payload" title="The delivery payload">
        <p>
          Each delivery is an HTTP <InlineCode>POST</InlineCode> to your URL with a JSON body and
          three sparx headers:
        </p>
        <DocTable>
          <thead>
            <tr>
              <th style={{ width: '34%' }}>Header</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>X-sparx-Event</code>
              </td>
              <td>
                The event type, e.g. <code>content.entry.published</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>X-sparx-Delivery</code>
              </td>
              <td>A unique id for this delivery attempt — use it to dedupe.</td>
            </tr>
            <tr>
              <td>
                <code>X-sparx-Signature</code>
              </td>
              <td>
                <code>sha256=&lt;hex&gt;</code> — the HMAC of the raw body (see below).
              </td>
            </tr>
          </tbody>
        </DocTable>
        <CodeBlock tabs={[{ label: 'delivery', code: DELIVERY }]} />
        <p>
          The body is stable across event types: <InlineCode>id</InlineCode> (the delivery id),{' '}
          <InlineCode>type</InlineCode>, <InlineCode>tenant_id</InlineCode>,{' '}
          <InlineCode>delivered_at</InlineCode>, and <InlineCode>data</InlineCode> — the event
          payload, whose shape depends on the event type.
        </p>
      </DocSection>

      <DocSection id="verify" title="Verify the signature">
        <p>
          Every request is signed with HMAC-SHA256 using your subscription’s signing secret. Compute
          the same HMAC over the raw request body and compare it to the{' '}
          <InlineCode>X-sparx-Signature</InlineCode> header. Reject anything that doesn’t match.
        </p>
        <CodeBlock tabs={[{ label: 'verify.ts', code: VERIFY }]} />
        <Callout type="danger" title="Always sign the raw body">
          Verify the bytes you received, not a re-serialized object. If your framework parses JSON
          before you can read the raw body, capture the raw payload first (e.g. a raw-body parser) —
          otherwise the signature will never match. Use a constant-time compare (
          <InlineCode>timingSafeEqual</InlineCode>), never <InlineCode>===</InlineCode>.
        </Callout>
      </DocSection>

      <DocSection id="retries" title="Retries & failure">
        <p>
          Respond <InlineCode>2xx</InlineCode> quickly to acknowledge a delivery — do the real work
          afterward, off the request path. Any non-2xx response, a timeout (10s), or a network error
          schedules a retry with exponential backoff:
        </p>
        <DocTable>
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Attempt</th>
              <th>Wait before retry</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1 → 2</td>
              <td>~1 minute</td>
            </tr>
            <tr>
              <td>2 → 3</td>
              <td>~5 minutes</td>
            </tr>
            <tr>
              <td>3 → 4</td>
              <td>~15 minutes</td>
            </tr>
            <tr>
              <td>4 → 5</td>
              <td>~30 minutes</td>
            </tr>
            <tr>
              <td>5 → 6</td>
              <td>~1 hour</td>
            </tr>
            <tr>
              <td>6 → 7</td>
              <td>~2 hours</td>
            </tr>
            <tr>
              <td>7 → 8</td>
              <td>~4 hours</td>
            </tr>
          </tbody>
        </DocTable>
        <p>
          After <strong>8 attempts</strong> (≈ 7.5 hours total) a delivery is marked{' '}
          <InlineCode>failed</InlineCode> and no longer retried. Because deliveries are retried, the
          same event may arrive more than once — <strong>make your handler idempotent</strong> by
          deduping on <InlineCode>X-sparx-Delivery</InlineCode>.
        </p>
      </DocSection>

      <DocSection id="manage" title="Manage subscriptions">
        <p>List your subscriptions (secrets come back redacted):</p>
        <EndpointChip method="GET" path="/v1/webhooks/subscriptions" />
        <p>
          Update a subscription’s name, URL, or event list — or pause it without deleting by setting{' '}
          <InlineCode>active: false</InlineCode>:
        </p>
        <EndpointChip method="PATCH" path="/v1/webhooks/subscriptions/:id" />
        <CodeBlock tabs={[{ label: 'pause', code: PAUSE }]} />
        <p>Delete a subscription permanently:</p>
        <EndpointChip method="DELETE" path="/v1/webhooks/subscriptions/:id" />
        <p>
          All changes are recorded in the tenant audit log. Creating, updating, and deleting require
          an <strong>admin</strong> role; listing requires <strong>viewer</strong>.
        </p>
      </DocSection>

      <DocSection id="catalog" title="Full event catalog">
        <p>
          For reference, here is the platform’s event taxonomy (defined in{' '}
          <InlineCode>@sparx/events</InlineCode>), grouped by domain. The subset available for{' '}
          <DocLink href="#events">webhook subscription</DocLink> is called out above; the rest are
          consumed internally — by platform workers and MCP — as modules adopt the shared bus.
        </p>

        <DocSubsection id="catalog-platform" title="Platform & content">
          <ul>
            <li>
              <strong>Tenant:</strong> <InlineCode>tenant.created</InlineCode>
            </li>
            <li>
              <strong>Templates:</strong> <InlineCode>template.install</InlineCode> ·{' '}
              <InlineCode>template.installed</InlineCode> ·{' '}
              <InlineCode>template.install_failed</InlineCode>
            </li>
            <li>
              <strong>Content:</strong> <InlineCode>content.entry.created</InlineCode> ·{' '}
              <InlineCode>content.entry.updated</InlineCode> ·{' '}
              <InlineCode>content.entry.published</InlineCode> ·{' '}
              <InlineCode>content.entry.scheduled</InlineCode> ·{' '}
              <InlineCode>content.entry.unpublished</InlineCode> ·{' '}
              <InlineCode>content.entry.deleted</InlineCode> ·{' '}
              <InlineCode>content.revision.created</InlineCode> ·{' '}
              <InlineCode>content_type.upserted</InlineCode>
            </li>
            <li>
              <strong>Media:</strong> <InlineCode>media.uploaded</InlineCode> ·{' '}
              <InlineCode>media.processed</InlineCode> · <InlineCode>media.deleted</InlineCode>
            </li>
            <li>
              <strong>SEO:</strong> <InlineCode>redirect.added</InlineCode> ·{' '}
              <InlineCode>redirect.removed</InlineCode>
            </li>
            <li>
              <strong>Search:</strong> <InlineCode>search.entity.changed</InlineCode>
            </li>
          </ul>
        </DocSubsection>

        <DocSubsection id="catalog-commerce" title="Commerce">
          <ul>
            <li>
              <strong>Catalog:</strong> <InlineCode>product.created</InlineCode> ·{' '}
              <InlineCode>product.updated</InlineCode> · <InlineCode>product.deleted</InlineCode> ·{' '}
              <InlineCode>variant.created</InlineCode> · <InlineCode>variant.updated</InlineCode> ·{' '}
              <InlineCode>variant.deleted</InlineCode>
            </li>
            <li>
              <strong>Inventory:</strong> <InlineCode>inventory.adjusted</InlineCode> ·{' '}
              <InlineCode>inventory.low</InlineCode> · <InlineCode>inventory.depleted</InlineCode>
            </li>
            <li>
              <strong>Cart & checkout:</strong> <InlineCode>cart.created</InlineCode> ·{' '}
              <InlineCode>cart.updated</InlineCode> · <InlineCode>cart.abandoned</InlineCode> ·{' '}
              <InlineCode>cart.recovered</InlineCode> · <InlineCode>checkout.started</InlineCode> ·{' '}
              <InlineCode>checkout.completed</InlineCode> ·{' '}
              <InlineCode>checkout.expired</InlineCode>
            </li>
            <li>
              <strong>Orders:</strong> <InlineCode>order.placed</InlineCode> ·{' '}
              <InlineCode>order.paid</InlineCode> · <InlineCode>order.fulfilled</InlineCode> ·{' '}
              <InlineCode>order.delivered</InlineCode> · <InlineCode>order.cancelled</InlineCode> ·{' '}
              <InlineCode>order.refunded</InlineCode> ·{' '}
              <InlineCode>order.payment_failed</InlineCode>
            </li>
            <li>
              <strong>Subscriptions:</strong> <InlineCode>subscription.created</InlineCode> ·{' '}
              <InlineCode>subscription.renewed</InlineCode> ·{' '}
              <InlineCode>subscription.payment_failed</InlineCode> ·{' '}
              <InlineCode>subscription.paused</InlineCode> ·{' '}
              <InlineCode>subscription.resumed</InlineCode> ·{' '}
              <InlineCode>subscription.cancelled</InlineCode>
            </li>
            <li>
              <strong>Returns:</strong> <InlineCode>return.requested</InlineCode> ·{' '}
              <InlineCode>return.approved</InlineCode> · <InlineCode>return.received</InlineCode> ·{' '}
              <InlineCode>return.refunded</InlineCode>
            </li>
            <li>
              <strong>Reviews:</strong> <InlineCode>review.submitted</InlineCode> ·{' '}
              <InlineCode>review.published</InlineCode> · <InlineCode>review.flagged</InlineCode>
            </li>
            <li>
              <strong>Providers:</strong> <InlineCode>provider.installed</InlineCode> ·{' '}
              <InlineCode>provider.uninstalled</InlineCode> ·{' '}
              <InlineCode>provider.health_changed</InlineCode>
            </li>
            <li>
              <strong>Gift cards & credit:</strong> <InlineCode>giftcard.issued</InlineCode> ·{' '}
              <InlineCode>giftcard.redeemed</InlineCode> ·{' '}
              <InlineCode>accountcredit.granted</InlineCode> ·{' '}
              <InlineCode>accountcredit.spent</InlineCode>
            </li>
            <li>
              <strong>Configurator:</strong> <InlineCode>configuration.requested</InlineCode> ·{' '}
              <InlineCode>configuration.quoted</InlineCode> ·{' '}
              <InlineCode>configuration.accepted</InlineCode>
            </li>
          </ul>
        </DocSubsection>

        <DocSubsection id="catalog-email" title="Email">
          <ul>
            <li>
              <strong>Sending:</strong> <InlineCode>email.send</InlineCode> ·{' '}
              <InlineCode>email.domain.verified</InlineCode>
            </li>
          </ul>
          <p>
            Email engagement and delivery events (opens, clicks, bounces, broadcast lifecycle) are
            tracked within the Email module rather than the cross-module bus — see the Email module
            docs for those.
          </p>
        </DocSubsection>
      </DocSection>
    </DocArticle>
  );
}
