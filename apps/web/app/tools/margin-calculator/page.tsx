import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { MarginTool } from '@/components/marketing/tools/margin-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('margin-calculator')!;

export const metadata: Metadata = toolMetadata('margin-calculator');

export default function MarginCalculatorPage() {
  return (
    <ToolShell tool={tool}>
      <MarginTool />
    </ToolShell>
  );
}
