import { renderModuleOgImage, OG_SIZE, type ModuleOgMeta } from '@/lib/og-module';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';

// /agentic is the SECOND document for the one `ai` module, not a module of its
// own — so it has no entry in lib/modules.ts MODULES (that map is keyed by
// ModulePageSlug). The card data is declared here instead of faking a module
// record. It wears the `ai` module hue, because it IS the AI module: this is
// its inward-facing half (/ai is the customer-facing concierge).
const AGENTIC_OG: ModuleOgMeta = {
  slug: 'agentic',
  module: 'ai',
  label: 'Agentic',
  headlinePrimary: 'Your own AI,',
  headlineSecondary: 'your live data',
  description:
    'A first-class MCP server for your business. Point Claude, ChatGPT, or Copilot at live orders, customers, and content — scoped, audited, revocable. Your key, never ours.',
  pricing: { price: '$49', period: '/mo', modifier: '+' },
};

export const alt = 'sparx Agentic — point your own AI at your live business data over MCP.';

export default function Image() {
  return renderModuleOgImage(AGENTIC_OG);
}
