import type { Metadata } from 'next';
import './docs.css';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { DocsSidebar, DocsMobileNav } from '@/components/docs/sidebar';

export const metadata: Metadata = {
  title: { default: 'Documentation', template: '%s — Sparx Docs' },
  description:
    'Developer documentation for Sparx — guides, REST & GraphQL API reference, SDKs, and the MCP server. Build on the modular content and commerce OS.',
};

/**
 * Docs section layout. Reuses the site's real <Nav> and <Footer> so docs live
 * inside the normal site chrome (per product direction), and adds the docs
 * sidebar between them. The mobile drawer (<DocsMobileNav>) keeps the nav tree
 * reachable on small screens where the desktop sidebar is hidden.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <DocsMobileNav />
      <div className="docs-shell">
        <DocsSidebar />
        {children}
      </div>
      <Footer />
    </>
  );
}
