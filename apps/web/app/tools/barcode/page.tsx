import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { BarcodeTool } from '@/components/marketing/tools/barcode-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('barcode')!;

export const metadata: Metadata = toolMetadata('barcode');

export default function BarcodePage() {
  return (
    <ToolShell tool={tool}>
      <BarcodeTool />
    </ToolShell>
  );
}
