import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { MetaTool } from '@/components/marketing/tools/meta-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('meta-tags')!;

export const metadata: Metadata = toolMetadata('meta-tags');

export default function MetaTagsPage() {
  return (
    <ToolShell tool={tool}>
      <MetaTool />
    </ToolShell>
  );
}
