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
 * crossing the "use client" boundary.
 *
 * Two things changed. The icon chip was `bg-<module> bg-soft text-<module>` — the
 * hue as ink over a 15% tint of itself, which measures 1.9–2.4:1 across these
 * modules (filed as §2 in docs/silicaui/02-core-asks.md); it is a solid fill with
 * its paired `-content` now, which is both legible and the only way a hue reads
 * at size. The module badge went `soft` → `solid` for the same reason. Between
 * the hub and the related strip that was thirty-six low-contrast fills.
 *
 * The seven `.tool-card__*` classes in app/marketing.css are gone with it —
 * every one was a line or two of flexbox, a fixed 44px box, or a line-clamp,
 * which utilities already express. What is left there is genuinely stateful
 * (the arrow's hover nudge), and it stays in CSS because a `:hover` on a
 * DESCENDANT of the hovered element has no utility form.
 */
export function ToolCard({
  tool,
  headingLevel: Heading = 'h3',
}: {
  tool: ToolMeta;
  /**
   * Heading tag for the tool name. The card appears in two places at different
   * outline depths: under the hub's group `h2`, and inside the related-tools
   * strip, which has its own `h2`. The caller owns the level because only the
   * caller knows the depth.
   */
  headingLevel?: 'h2' | 'h3';
}) {
  const color = getModuleColor(tool.module);
  const mod = getModule(tool.module);
  const Icon = tool.icon;

  return (
    <a href={`/tools/${tool.slug}`} className={cx(clickableCardClasses(), 'tool-card h-full')}>
      <span className="card-body flex h-full flex-col gap-3">
        <span className="flex items-center justify-between">
          <span
            aria-hidden
            className={cx(
              'inline-flex h-11 w-11 items-center justify-center rounded-xl',
              color.bg,
              color.content
            )}
          >
            <Icon size={22} strokeWidth={1.6} />
          </span>
          <ArrowUpRight className="tool-card__arrow" size={18} />
        </span>
        <Heading className="m-0 text-lg font-medium tracking-tight">{tool.name}</Heading>
        {/* Three-line clamp so one long tagline cannot stretch a whole grid row.
            `line-clamp-3` is the utility for exactly this. */}
        <p className="text-md m-0 line-clamp-3">{tool.tagline}</p>
        <span
          className={cx(
            badgeClasses({ color: `module-${tool.module}`, variant: 'solid', size: 'sm' }),
            'mt-auto self-start'
          )}
        >
          {mod?.label ?? tool.module}
        </span>
      </span>
    </a>
  );
}
