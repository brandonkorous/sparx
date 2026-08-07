import type { Metadata } from 'next';
import { DocArticle, DocSection, NextSteps, NextCard, DocLink } from '@/components/docs/prose';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Start here. Guides, REST & GraphQL API reference, SDKs, and the MCP server for building on sparx — the modular content and commerce OS.',
  alternates: { canonical: '/docs' },
};

function Icon({ d }: { d: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={d} stroke="#4f46e5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DocsIndexPage() {
  return (
    <DocArticle
      title="Documentation"
      lede="Everything you need to build on sparx — the modular content and commerce OS. sparx is API-first: every feature is an endpoint before it's a screen, and a native MCP server lets AI agents read and write live business data."
    >
      <DocSection id="start" title="Start here">
        <p>
          New to sparx? The <DocLink href="/docs/quickstart">Quickstart</DocLink> takes you from
          zero to a live API call in about ten minutes. Then explore by area:
        </p>
        <NextSteps>
          <NextCard
            href="/docs/quickstart"
            title="Quickstart"
            icon={<Icon d="M13 2L3 14h7l-1 8 10-12h-7l1-6z" />}
          >
            Create a key, make your first request, and subscribe to an event.
          </NextCard>
          <NextCard
            href="/docs/api/orders/create"
            title="API reference"
            icon={<Icon d="M8 5L3 12l5 7M16 5l5 7-5 7" />}
          >
            Every REST and GraphQL endpoint, with request and response examples.
          </NextCard>
          <NextCard
            href="/docs/sdks/builder"
            title="SDKs"
            icon={<Icon d="M4 7h16M4 12h16M4 17h10" />}
          >
            Typed clients for TypeScript, plus the headless Builder SDK.
          </NextCard>
          <NextCard
            href="/docs/mcp"
            title="MCP server"
            icon={<Icon d="M4 4h16v16H4zM9 9h6v6H9z" />}
          >
            Give AI agents direct, governed access to your tenant’s data.
          </NextCard>
        </NextSteps>
      </DocSection>

      <DocSection id="principles" title="How sparx is built">
        <p>A few platform commitments shape every page in these docs:</p>
        <ul>
          <li>
            <strong>API-first.</strong> The dashboard, the live site, and AI agents are all
            consumers of the same REST + GraphQL surface. Anything the UI can do, your code can do.
          </li>
          <li>
            <strong>Modular and feature-flagged.</strong> A tenant activates only the modules it
            uses — content, commerce, CRM, CMS, email, B2B, dropship, AI. Disabled modules return a
            clear error and store no data.
          </li>
          <li>
            <strong>Event-driven.</strong> Writes emit events (
            <DocLink href="/docs/guides/webhooks">webhooks</DocLink> and Pub/Sub); side effects run
            in workers, never inline.
          </li>
          <li>
            <strong>Multi-tenant by default.</strong> Every API key is tenant-scoped and isolated by
            PostgreSQL Row-Level Security — a key can never reach another tenant’s data.
          </li>
        </ul>
      </DocSection>
    </DocArticle>
  );
}
