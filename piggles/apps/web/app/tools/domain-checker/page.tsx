import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTool } from '@/components/marketing/tools/registry';
import { searchTitleFor, toolMetadata } from '@/components/marketing/tools/tool-metadata';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { DomainTool } from '@/components/marketing/tools/domain-tool';

const SLUG = 'domain-checker';

export function generateMetadata(): Metadata {
  const tool = getTool(SLUG);
  if (!tool) return {};
  return toolMetadata(tool, searchTitleFor(tool));
}

export default function Page() {
  const tool = getTool(SLUG);
  // The registry is the source of truth for which tools exist. A route whose
  // slug is not in it would render a page with no heading and no metadata, so it
  // 404s instead — which is the honest answer and is also what stops a renamed
  // tool leaving a ghost page behind.
  if (!tool) notFound();

  return (
    <ToolShell tool={tool}>
      <DomainTool />
    </ToolShell>
  );
}
