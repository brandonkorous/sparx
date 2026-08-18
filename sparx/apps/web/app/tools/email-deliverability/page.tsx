import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { DeliverabilityTool } from '@/components/marketing/tools/deliverability-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('email-deliverability')!;

export const metadata: Metadata = toolMetadata('email-deliverability');

export default function EmailDeliverabilityPage() {
  return (
    <ToolShell tool={tool}>
      <DeliverabilityTool />
    </ToolShell>
  );
}
