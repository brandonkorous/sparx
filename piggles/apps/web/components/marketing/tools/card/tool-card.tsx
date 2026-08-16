import Link from 'next/link';
import type { PigglesTool } from '../registry';
import { toolGroup } from '../registry';
import { ToolPreview } from './tool-preview';

/** A tool as what it makes. The preview is real output — a genuine encode, a
 * genuine palette — so the grid reads as a gallery rather than a list of
 * labels. */
export function ToolCard({ tool }: { tool: PigglesTool }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      data-group={toolGroup(tool)}
      // Neutral fill, hue on the edge only. Colouring the card itself would make
      // a grid of them read as a paint chart and stop the tint distinguishing
      // anything.
      className="bg-base-100 border-module rounded-box group flex flex-col gap-5 border p-5 transition-colors duration-200 outline-none motion-reduce:transition-none"
    >
      {/* The artefact sits on its own quiet ground so a white QR or barcode has
 an edge to sit against. */}
      <div className="bg-base-200 rounded-field grid min-h-[9.5rem] place-items-center p-4">
        <ToolPreview slug={tool.slug} />
      </div>

      <div>
        <h3 className="text-xl leading-tight font-extrabold text-balance transition-colors motion-reduce:transition-none">
          {tool.name}
        </h3>
        <p className="mt-2 text-base">{tool.tagline}</p>
      </div>
    </Link>
  );
}
