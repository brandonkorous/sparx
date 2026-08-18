import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { StructuredDataTool } from '@/components/marketing/tools/structured-data-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('structured-data')!;

export const metadata: Metadata = toolMetadata('structured-data');

export default function StructuredDataPage() {
  return (
    <ToolShell tool={tool}>
      <StructuredDataTool />
    </ToolShell>
  );
}
