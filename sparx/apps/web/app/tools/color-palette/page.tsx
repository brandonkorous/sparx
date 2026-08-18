import type { Metadata } from 'next';
import { ToolShell } from '@/components/marketing/tools/tool-shell';
import { PaletteTool } from '@/components/marketing/tools/palette-tool';
import { getTool } from '@/components/marketing/tools/registry';
import { toolMetadata } from '@/components/marketing/tools/tool-metadata';

const tool = getTool('color-palette')!;

export const metadata: Metadata = toolMetadata('color-palette');

export default function ColorPalettePage() {
  return (
    <ToolShell tool={tool}>
      <PaletteTool />
    </ToolShell>
  );
}
