import { ArrowUpRight } from 'lucide-react';
import { badgeClasses, clickableCardClasses, cx } from '@wizeworks/silicaui-react/server';
import { getModuleColor } from '../primitives';
import { getModule } from '@/lib/modules';
import type { ToolMeta } from './registry';

/**
 * A linked card for a single tool — used on the hub grid and the related strip.
 *
 * The surface is silica's clickable `Card` via `clickableCardClasses()` — the
 * server-safe class helper, not `<ClickableCard render={<a/>}>`, because this
 * renders from a Server Component where `render` would drop the anchor's props
 * crossing the "use client" boundary. The module tag is a real `Badge` in that
 * module's hue, so the card carries module identity the same way every other
 * module signal on the platform does (and without the uppercase kicker the
 * hand-rolled tag used to be).
 */
export function ToolCard({
  tool,
  headingLevel: Heading = 'h3',
}: {
  tool: ToolMeta;
  /**
   * Heading tag for the tool name. The card appears in two places at different
   * outline depths: straight under the hub's `h1` (where `h3` skips a level and
   * trips a11y checks) and inside the related-tools strip, which has its own
   * `h2`. The caller owns the level because only the caller knows the depth.
   */
  headingLevel?: 'h2' | 'h3';
}) {
  const color = getModuleColor(tool.module);
  const mod = getModule(tool.module);
  const Icon = tool.icon;

  return (
    <a href={`/tools/${tool.slug}`} className={cx(clickableCardClasses(), 'tool-card')}>
      <span className="card-body tool-card__body">
        <span className="tool-card__top">
          <span
            aria-hidden
            className={cx('tool-card__icon rounded-lg', color.bg, 'bg-soft', color.ink)}
          >
            <Icon size={22} strokeWidth={1.6} />
          </span>
          <ArrowUpRight className="tool-card__arrow" size={18} />
        </span>
        <Heading className="text-md m-0 font-medium tracking-tight">{tool.name}</Heading>
        <p className="text-md tool-card__desc m-0">{tool.tagline}</p>
        <span
          className={cx(
            badgeClasses({ color: `module-${tool.module}`, variant: 'soft', size: 'sm' }),
            'tool-card__tag'
          )}
        >
          {mod?.label ?? tool.module}
        </span>
      </span>
    </a>
  );
}
