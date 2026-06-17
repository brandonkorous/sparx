import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { DigitalCardTool } from '@/components/marketing/tools/digital-card-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('digital-card')!;

export const metadata: Metadata = toolMetadata('digital-card');

export default function DigitalCardPage() {
  return (
    <ToolShell tool={tool}>
      <DigitalCardTool />
    </ToolShell>
  );
}
