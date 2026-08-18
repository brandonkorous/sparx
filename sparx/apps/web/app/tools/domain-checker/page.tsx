import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { DomainTool } from '@/components/marketing/tools/domain-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('domain-checker')!;

export const metadata: Metadata = toolMetadata('domain-checker');

export default function DomainCheckerPage() {
  return (
    <ToolShell tool={tool}>
      <DomainTool />
    </ToolShell>
  );
}
