import type { Metadata } from 'next';
import { AgenticPage } from '@/components/marketing/agentic-page';

// /agentic is a standalone deep page, NOT a module page — it is the second of
// two documents for the ONE `ai` module. /ai is the module page (and stays in
// MODULE_ORDER); this is where the MCP + agentic story lives in full. So the
// metadata is hand-written rather than coming from makeMetadata('<slug>'),
// which is keyed to ModulePageSlug.
export const metadata: Metadata = {
  title: 'Agentic access — your AI works your business | sparx',
  description:
    'A first-class MCP server for your business data. Point Claude, ChatGPT, or Copilot at live orders, customers, and content — scoped, audited, and revocable. Your AI, your key, never ours.',
  alternates: { canonical: 'https://sparx.works/agentic' },
  openGraph: {
    title: 'Agentic access — your AI works your business',
    description: 'A first-class MCP server for your business data. Your AI, your key, never ours.',
    url: 'https://sparx.works/agentic',
    type: 'website',
  },
};

export default function Agentic() {
  return <AgenticPage />;
}
