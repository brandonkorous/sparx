import { ArrowUpRight } from 'lucide-react';
import { getModuleColor } from '../primitives';
import { getModule } from '@/lib/modules';
import type { ToolMeta } from './registry';

/** A linked card for a single tool — used on the hub grid and the related strip. */
export function ToolCard({ tool }: { tool: ToolMeta }) {
  const color = getModuleColor(tool.module);
  const mod = getModule(tool.module);
  const Icon = tool.icon;

  return (
    <a href={`/tools/${tool.slug}`} className="tool-card">
      <span className="tool-card__top">
        <span aria-hidden className={`tool-card__icon ${color.bg} bg-soft ${color.ink}`}>
          <Icon size={22} strokeWidth={1.6} />
        </span>
        <ArrowUpRight className="tool-card__arrow" size={18} />
      </span>
      <h3 className="tool-card__name">{tool.name}</h3>
      <p className="tool-card__desc">{tool.tagline}</p>
      <span className={`tool-card__tag ${color.ink}`}>
        <span className="tool-card__dot" style={{ backgroundColor: color.color }} />
        {mod?.label ?? tool.module}
      </span>
    </a>
  );
}
