import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { QrTool } from '@/components/marketing/tools/qr-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('qr-code')!;

export const metadata: Metadata = toolMetadata('qr-code');

export default function QrCodePage() {
  return (
    <ToolShell tool={tool}>
      <QrTool />
    </ToolShell>
  );
}
