import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { PrivacyTool } from '@/components/marketing/tools/privacy-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('privacy-policy')!;

export const metadata: Metadata = toolMetadata('privacy-policy');

export default function PrivacyPolicyPage() {
  return (
    <ToolShell tool={tool}>
      <PrivacyTool />
    </ToolShell>
  );
}
