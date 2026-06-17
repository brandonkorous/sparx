import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { OgTool } from '@/components/marketing/tools/og-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('og-image')!;

export const metadata: Metadata = toolMetadata('og-image');

export default function OgImagePage() {
  return (
    <ToolShell tool={tool}>
      <OgTool />
    </ToolShell>
  );
}
