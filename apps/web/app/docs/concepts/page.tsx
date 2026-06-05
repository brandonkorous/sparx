import type { Metadata } from 'next';
import {
  DocArticle,
  DocSection,
  Callout,
  DocTable,
  DocImage,
  InlineCode,
  DocLink,
} from '@/components/docs/prose';
import { CodeBlock } from '@/components/docs/code-block';

export const metadata: Metadata = {
  title: 'Core concepts',
  description:
    'The handful of ideas that shape every Sparx API: multi-tenancy with Row-Level Security, feature-flagged modules, an API-first surface, event-driven side effects, and a single shared data layer.',
  alternates: { canonical: '/docs/concepts' },
};

const ENVELOPE = `// Success
{ "success": true, "data": { /* the resource */ } }

// Success with pagination
{ "success": true, "data": [ /* … */ ], "meta": { "next_cursor": "…", "total": 128 } }

// Error
{ "success": false, "error": { "code": "module_disabled", "message": "…" } }`;

export default function ConceptsPage() {
  return (
    <DocArticle
      breadcrumb={[
        { label: 'Docs', href: '/docs' },
        { label: 'Guides' },
        { label: 'Core concepts' },
      ]}
      title="Core concepts"
      lede="Sparx is a modular content and commerce operating system. Five ideas shape every endpoint in these docs — understand them once and the rest of the API follows."
      meta={
        <>
          <span>Updated 2026-06-05</span>
          <span>8 min read</span>
        </>
      }
      toc={[
        { id: 'tenancy', label: 'Tenants & isolation' },
        { id: 'modules', label: 'Modules' },
        { id: 'api-first', label: 'API-first' },
        { id: 'events', label: 'Events' },
        { id: 'data', label: 'One data layer' },
        { id: 'surfaces', label: 'The surfaces' },
      ]}
      editPath="apps/web/app/docs/concepts/page.tsx"
      updated="2026-06-05"
      prev={{ title: 'Quickstart', href: '/docs/quickstart' }}
      next={{ title: 'Authentication', href: '/docs/authentication' }}
    >
      <DocSection id="tenancy" title="Tenants & isolation">
        <p>
          Every account on Sparx is a <strong>tenant</strong>. A tenant owns all of its data —
          sites, products, customers, content, emails — and is completely isolated from every other
          tenant. Authentication is handled by self-hosted{' '}
          <DocLink href="https://www.better-auth.com">Better Auth</DocLink>, whose organizations map
          one-to-one to Sparx tenants.
        </p>
        <p>
          Isolation is not an application convenience you have to remember to apply — it’s enforced
          at the database. Every tenant-scoped table carries a <InlineCode>tenant_id</InlineCode>,
          and PostgreSQL <strong>Row-Level Security</strong> policies are the backstop: even a buggy
          query can only ever see the current tenant’s rows. Your API key carries a tenant context,
          and the database refuses to return anything outside it.
        </p>
        <Callout type="tip" title="What this means for you">
          You never pass a <InlineCode>tenant_id</InlineCode> in API calls and you can’t reach
          another tenant’s data by guessing ids. The key <em>is</em> the tenant scope.
        </Callout>
      </DocSection>

      <DocSection id="modules" title="Modules">
        <p>
          Sparx is one platform made of independently-activated <strong>modules</strong>. A tenant
          turns on only what it uses and pays only for that — a CMS-only publisher, a CRM-only team,
          and a full B2B distributor are all equally first-class. Selling is one capability, never
          the assumption.
        </p>
        <DocTable>
          <thead>
            <tr>
              <th style={{ width: '24%' }}>Module</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>builder</code>
              </td>
              <td>
                The visual site builder — pages, layouts, and reusable components as node trees.
              </td>
            </tr>
            <tr>
              <td>
                <code>commerce</code>
              </td>
              <td>Catalog, variants, cart, checkout, and the storefront.</td>
            </tr>
            <tr>
              <td>
                <code>cms</code>
              </td>
              <td>Content types, entries, revisions, and publishing.</td>
            </tr>
            <tr>
              <td>
                <code>crm</code>
              </td>
              <td>Customers, B2B accounts, deals, quotes, and orders.</td>
            </tr>
            <tr>
              <td>
                <code>email</code>
              </td>
              <td>Broadcasts, automations, and transactional sends.</td>
            </tr>
            <tr>
              <td>
                <code>b2b</code>
              </td>
              <td>Wholesale accounts, payment terms, price lists, and quoting.</td>
            </tr>
            <tr>
              <td>
                <code>dropship</code>
              </td>
              <td>Supplier integration and dropship fulfillment.</td>
            </tr>
            <tr>
              <td>
                <code>ai</code>
              </td>
              <td>The MCP server — AI agents reading and writing live tenant data.</td>
            </tr>
          </tbody>
        </DocTable>
        <p>
          Modules are <strong>feature-flagged, not separately deployed</strong>. A disabled module
          stores no rows, runs no workers, and its endpoints return a clear error rather than
          partial behavior:
        </p>
        <CodeBlock
          tabs={[
            {
              label: '403',
              code: `{ "success": false, "error": { "code": "module_disabled", "message": "The commerce module is not active for this tenant." } }`,
            },
          ]}
        />
        <DocImage
          src="/docs/dash-modules.png"
          alt="The Settings → Modules screen — each module (Builder, Commerce, CMS, CRM, Email active; B2B, Dropship, AI inactive) with an Activate or Deactivate button."
          caption="Settings → Modules — activate only what you use. Disabled modules return 404, run no consumers, and store no rows."
        />
      </DocSection>

      <DocSection id="api-first" title="API-first">
        <p>
          Every feature exists as an API endpoint <em>before</em> it exists as a screen. The
          dashboard at <InlineCode>app.sparx.works</InlineCode> is just one consumer of the same
          surface your code calls — anything the UI can do, you can do. The API is exposed two ways
          from one schema:
        </p>
        <ul>
          <li>
            <strong>REST</strong> at <InlineCode>api.sparx.works/v1</InlineCode> —
            resource-oriented, the default for most integrations and webhooks.
          </li>
          <li>
            <strong>GraphQL</strong> — the same data, for fetching a deep object graph in one round
            trip.
          </li>
          <li>
            <strong>MCP</strong> at <InlineCode>mcp.sparx.works</InlineCode> — the API as tools an
            AI agent can call directly.
          </li>
        </ul>
        <p>
          Every REST response shares one envelope, so success, pagination, and errors are uniform:
        </p>
        <CodeBlock tabs={[{ label: 'envelope', code: ENVELOPE }]} />
        <p>
          Successful responses are <InlineCode>{`{ success: true, data }`}</InlineCode> (with an
          optional <InlineCode>meta</InlineCode> for pagination); failures are{' '}
          <InlineCode>{`{ success: false, error }`}</InlineCode> with a machine-readable{' '}
          <InlineCode>error.code</InlineCode>.
        </p>
      </DocSection>

      <DocSection id="events" title="Events">
        <p>
          Sparx never inlines side effects in a request handler. When something happens — an order
          is paid, a content entry is published — the handler writes its data and{' '}
          <strong>publishes an event</strong>. Workers consume those events asynchronously:
          rendering and sending email, reindexing search, revalidating caches.
        </p>
        <p>
          This keeps writes fast and the system loosely coupled — and it’s the same stream you can
          subscribe to. See <DocLink href="/docs/guides/webhooks">Webhooks &amp; events</DocLink>{' '}
          for the catalog, the signed delivery model, and how to receive events in your own app.
        </p>
        <Callout type="note">
          Practically: don’t poll for changes. Subscribe to the event you care about and let Sparx
          push it to you with retries.
        </Callout>
      </DocSection>

      <DocSection id="data" title="One data layer">
        <p>
          Modules share a single database, not a constellation of disconnected services. A customer
          created in the CRM is the same customer Commerce attaches an order to and Email sends a
          broadcast to — there are no parallel records to reconcile. The{' '}
          <strong>CRM owns the customer spine</strong> (<InlineCode>customers</InlineCode> and{' '}
          <InlineCode>b2b_accounts</InlineCode>); other modules reference it.
        </p>
        <p>
          The flip side of one shared layer is that isolation has to be ironclad — which is exactly
          why <DocLink href="#tenancy">Row-Level Security</DocLink> sits underneath everything. Your
          data is yours: it’s never blended with another tenant’s, and it’s exportable.
        </p>
      </DocSection>

      <DocSection id="surfaces" title="The surfaces">
        <p>Where everything lives:</p>
        <DocTable>
          <thead>
            <tr>
              <th style={{ width: '34%' }}>Host</th>
              <th>What it serves</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>api.sparx.works</code>
              </td>
              <td>The REST &amp; GraphQL API.</td>
            </tr>
            <tr>
              <td>
                <code>mcp.sparx.works</code>
              </td>
              <td>The MCP server for AI agents.</td>
            </tr>
            <tr>
              <td>
                <code>app.sparx.works</code>
              </td>
              <td>The tenant dashboard.</td>
            </tr>
            <tr>
              <td>
                <code>&lt;tenant&gt;.sparx.zone</code>
              </td>
              <td>Tenant storefronts (and custom domains).</td>
            </tr>
            <tr>
              <td>
                <code>sparx.works</code>
              </td>
              <td>The marketing site and these docs.</td>
            </tr>
          </tbody>
        </DocTable>
        <p>
          Next, get a key and make your first authenticated call —{' '}
          <DocLink href="/docs/authentication">Authentication</DocLink>.
        </p>
      </DocSection>
    </DocArticle>
  );
}
