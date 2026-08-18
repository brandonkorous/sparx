import type { Metadata } from 'next';
import './docs.css';
import { DocsSidebar, DocsMobileNav } from '@/components/docs/sidebar';

export const metadata: Metadata = {
  title: { default: 'Documentation', template: '%s — sparx Docs' },
  description:
    'Developer documentation for sparx — guides, REST & GraphQL API reference, SDKs, and the MCP server. Build on the modular content and commerce OS.',
};

/**
 * Docs section layout. The root layout supplies <Nav> and <Footer>, so this
 * layout only adds the docs sidebar between them. The mobile drawer
 * (<DocsMobileNav>) keeps the nav tree reachable on small screens where the
 * desktop sidebar is hidden.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DocsMobileNav />
      <div className="docs-shell">
        <DocsSidebar />
        {children}
      </div>
    </>
  );
}
