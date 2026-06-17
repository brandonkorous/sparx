import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { InvoiceTool } from '@/components/marketing/tools/invoice-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('invoice')!;

export const metadata: Metadata = toolMetadata('invoice');

export default function InvoicePage() {
  return (
    <ToolShell tool={tool}>
      <InvoiceTool />
    </ToolShell>
  );
}
