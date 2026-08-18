import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { UtmTool } from '@/components/marketing/tools/utm-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('utm-builder')!;

export const metadata: Metadata = toolMetadata('utm-builder');

export default function UtmBuilderPage() {
  return (
    <ToolShell tool={tool}>
      <UtmTool />
    </ToolShell>
  );
}
