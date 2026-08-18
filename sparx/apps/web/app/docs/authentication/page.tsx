import type { Metadata } from 'next';
import {
  DocArticle,
  DocSection,
  Callout,
  DocTable,
  DocImage,
  EndpointChip,
  InlineCode,
  DocLink,
} from '@/components/docs/prose';
import { CodeBlock } from '@/components/docs/code-block';

export const metadata: Metadata = {
  title: 'Authentication',
  description:
    'Authenticate to the sparx API with a Bearer API key. How to create a key, the sk_live_ format, tenant scoping and RLS isolation, roles and scopes, revocation, and the 401/403 errors.',
  alternates: { canonical: '/docs/authentication' },
};

const HEADER = `Authorization: Bearer sk_live_a1b2c3d4_9f8e7d6c5b4a39281706f5e4d3c2b1a0`;

const TEST_REQUEST = `curl https://api.sparx.works/v1/me \\
  -H "Authorization: Bearer $SPARX_KEY"

# 200 → the key is valid and resolves to your tenant
# 401 → missing, malformed, revoked, or expired key`;

const FORMAT = `sk_live_a1b2c3d4_9f8e7d6c5b4a39281706f5e4d3c2b1a0
└──┬──┘ └──┬───┘ └──────────────┬───────────────┘
 prefix   key id              secret
                    (stored only as a SHA-256 hash)`;

export default function AuthenticationPage() {
  return (
    <DocArticle
      breadcrumb={[
        { label: 'Docs', href: '/docs' },
        { label: 'Guides' },
        { label: 'Authentication' },
      ]}
      title="Authentication"
      lede="Every sparx API request is authenticated with a Bearer token. For server-to-server integrations that token is an API key — a tenant-scoped secret you create once in the dashboard and send on every call."
      meta={
        <>
          <span>Updated 2026-06-05</span>
          <span>7 min read</span>
        </>
      }
      toc={[
        { id: 'overview', label: 'Overview' },
        { id: 'create', label: 'Create an API key' },
        { id: 'use', label: 'Authenticate a request' },
        { id: 'format', label: 'Key format & storage' },
        { id: 'scope', label: 'Tenant scope, roles & scopes' },
        { id: 'lifecycle', label: 'Rotation & revocation' },
        { id: 'errors', label: 'Auth errors' },
      ]}
      editPath="sparx/apps/web/app/docs/authentication/page.tsx"
      updated="2026-06-05"
      prev={{ title: 'Quickstart', href: '/docs/quickstart' }}
      next={{ title: 'Webhooks & events', href: '/docs/guides/webhooks' }}
    >
      <DocSection id="overview" title="Overview">
        <p>
          sparx authenticates every request from the <InlineCode>Authorization: Bearer</InlineCode>{' '}
          header. There are two kinds of bearer token:
        </p>
        <ul>
          <li>
            <strong>API keys</strong> (<InlineCode>sk_live_…</InlineCode>) — long-lived secrets you
            create for an integration. This is what your code uses.
          </li>
          <li>
            <strong>Dashboard tokens</strong> — short-lived JWTs the dashboard issues for a
            signed-in staff user. You won’t handle these directly.
          </li>
        </ul>
        <p>
          A request with no <InlineCode>Authorization</InlineCode> header is treated as anonymous —
          endpoints that require auth reject it with <InlineCode>401</InlineCode>.
        </p>
      </DocSection>

      <DocSection id="create" title="Create an API key">
        <p>
          In your dashboard, open <InlineCode>Settings → AI integrations</InlineCode> and create a
          key. The full secret is shown <strong>exactly once</strong> at creation — copy it then and
          store it as <InlineCode>SPARX_KEY</InlineCode> in your environment. sparx keeps only a
          hash, so it can never show you the secret again.
        </p>
        <DocImage
          src="/docs/dash-ai-integrations.png"
          alt="The Settings → AI integrations screen — an ‘Issue a new key’ form with a label field, optional expiry, and scope checkboxes (read:crm, write:crm, write:crm_bulk), above the active-keys list."
          caption="Settings → AI integrations — issue a scoped key. The secret is shown once at creation."
        />
        <Callout type="warn" title="Copy the secret immediately">
          Only the key’s short prefix is stored in readable form; the secret half is hashed with
          SHA-256 and never recoverable. If you lose it, revoke the key and create a new one.
        </Callout>
        <Callout type="danger" title="Keep keys server-side">
          An <InlineCode>sk_live_</InlineCode> key can read and write your tenant’s data — never
          ship it in a browser bundle, mobile app, or public repo. For client-side or AI-agent
          access, use the <DocLink href="/docs/mcp">MCP server</DocLink> or a scoped key behind your
          own backend.
        </Callout>
      </DocSection>

      <DocSection id="use" title="Authenticate a request">
        <p>Send the key as a bearer token on every call:</p>
        <CodeBlock tabs={[{ label: 'header', code: HEADER }]} />
        <p>
          A quick way to confirm a key works is to call <InlineCode>/v1/me</InlineCode>, which
          returns the authenticated actor and tenant:
        </p>
        <EndpointChip method="GET" path="/v1/me" />
        <CodeBlock tabs={[{ label: 'cURL', code: TEST_REQUEST }]} />
      </DocSection>

      <DocSection id="format" title="Key format & storage">
        <p>An API key has three parts:</p>
        <CodeBlock tabs={[{ label: 'sk_live_…', code: FORMAT }]} />
        <ul>
          <li>
            <InlineCode>sk_live_</InlineCode> — a fixed public prefix that identifies the token as a
            live API key.
          </li>
          <li>
            <strong>key id</strong> — a short public identifier sparx stores in the clear and uses
            to look the key up.
          </li>
          <li>
            <strong>secret</strong> — the half that proves you hold the key. sparx stores only its
            SHA-256 hash and compares in constant time, so a database leak never exposes a usable
            key.
          </li>
        </ul>
      </DocSection>

      <DocSection id="scope" title="Tenant scope, roles & scopes">
        <p>
          A key belongs to exactly one tenant. That tenant context travels with every request the
          key makes — you never pass a <InlineCode>tenant_id</InlineCode>, and a key physically
          cannot reach another tenant’s data: isolation is enforced underneath the API by PostgreSQL
          Row-Level Security (see <DocLink href="/docs/concepts#tenancy">Core concepts</DocLink>).
        </p>
        <p>
          Within its tenant, an API key acts with the <strong>editor</strong> role — it can read and
          write business data, but not perform owner/admin-only operations (like managing other
          staff or, for example, creating webhook subscriptions, which require admin). Keys also
          carry <strong>scopes</strong> that narrow what a given key may do; scope enforcement
          happens at the endpoint, so a key without a capability is refused even within its role.
        </p>
        <Callout type="note">
          Role hierarchy, lowest to highest: <InlineCode>viewer</InlineCode> →{' '}
          <InlineCode>editor</InlineCode> → <InlineCode>admin</InlineCode> →{' '}
          <InlineCode>owner</InlineCode>. API keys are <InlineCode>editor</InlineCode>; staff users
          in the dashboard hold one of the four.
        </Callout>
      </DocSection>

      <DocSection id="lifecycle" title="Rotation & revocation">
        <p>
          Keys are long-lived but revocable. From{' '}
          <InlineCode>Settings → AI integrations</InlineCode> you can revoke a key immediately — the
          next request it makes fails with <InlineCode>401</InlineCode>. A key may also carry an
          expiry, after which it stops working automatically. To rotate, create a new key, deploy
          it, then revoke the old one. sparx tracks each key’s last-used time so you can spot stale
          keys before retiring them.
        </p>
      </DocSection>

      <DocSection id="errors" title="Auth errors">
        <p>Two status codes cover authentication and authorization:</p>
        <DocTable>
          <thead>
            <tr>
              <th className="w-[18%]">Status</th>
              <th className="w-[26%]">Code</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>401</code>
              </td>
              <td>
                <code>unauthorized</code>
              </td>
              <td>
                No <code>Authorization</code> header, or the key is malformed, revoked, or expired.
                The caller is not authenticated.
              </td>
            </tr>
            <tr>
              <td>
                <code>403</code>
              </td>
              <td>
                <code>forbidden</code>
              </td>
              <td>The key is valid but lacks the required role or scope for this operation.</td>
            </tr>
          </tbody>
        </DocTable>
        <p>
          Both come back in the standard error envelope —{' '}
          <InlineCode>{`{ "success": false, "error": { "code", "message" } }`}</InlineCode>. With
          your key in hand, head to the <DocLink href="/docs/quickstart">Quickstart</DocLink> to
          make your first write, or wire up <DocLink href="/docs/guides/webhooks">Webhooks</DocLink>
          .
        </p>
      </DocSection>
    </DocArticle>
  );
}
