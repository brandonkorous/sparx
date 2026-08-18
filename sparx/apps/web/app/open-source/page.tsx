import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/coming-soon';

export const metadata: Metadata = {
  title: 'Open source — sparx',
  description:
    'sparx open-source: Builder SDK, MCP server reference, theme starter kits. Repos on github.com/wizeworks.',
  alternates: { canonical: '/open-source' },
  robots: { index: false },
};

export default function OpenSourcePage() {
  return (
    <ComingSoon
      eyebrow="Developers"
      title="Open source"
      description="The sparx Builder SDK, the MCP server reference implementation, theme starter kits, and a handful of internal tools. All on github.com/wizeworks under permissive licenses."
      contact="oss@sparx.works"
    />
  );
}
