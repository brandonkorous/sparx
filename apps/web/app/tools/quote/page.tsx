import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { QuoteTool } from '@/components/marketing/tools/quote-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('quote')!;

export const metadata: Metadata = toolMetadata('quote');

export default function QuotePage() {
  return (
    <ToolShell tool={tool}>
      <QuoteTool />
    </ToolShell>
  );
}
