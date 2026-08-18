import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { SignatureTool } from '@/components/marketing/tools/signature-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('email-signature')!;

export const metadata: Metadata = toolMetadata('email-signature');

export default function EmailSignaturePage() {
  return (
    <ToolShell tool={tool}>
      <SignatureTool />
    </ToolShell>
  );
}
