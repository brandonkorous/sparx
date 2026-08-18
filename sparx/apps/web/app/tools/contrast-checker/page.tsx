import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { ContrastTool } from '@/components/marketing/tools/contrast-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('contrast-checker')!;

export const metadata: Metadata = toolMetadata('contrast-checker');

export default function ContrastCheckerPage() {
  return (
    <ToolShell tool={tool}>
      <ContrastTool />
    </ToolShell>
  );
}
