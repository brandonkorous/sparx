import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { FaviconTool } from '@/components/marketing/tools/favicon-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('favicon')!;

export const metadata: Metadata = toolMetadata('favicon');

export default function FaviconPage() {
  return (
    <ToolShell tool={tool}>
      <FaviconTool />
    </ToolShell>
  );
}
