import { ArrowRight } from 'lucide-react';
import { Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { badgeClasses, buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '../band';
import { getModule } from '@/lib/modules';
import type { ToolMeta } from './registry';

/**
 * The "ladder" — connects a free tool up to the paid sparx module it belongs to.
 * This is what turns the tools hub from a utility drawer into a funnel: every
 * tool ends with a tasteful hand-off to the module that does the real version.
 *
 * Three things were wrong with how it looked.
 *
 * The module name sat ABOVE the headline as a small colored label. A previous
 * pass had already de-uppercased it, which treated the styling and missed the
 * problem: RULE #2 bans the SLOT, not the letterspacing — anything introducing a
 * heading from above is an eyebrow. It is a badge beside the CTA now, which is
 * where a reader looks for "which module is this" anyway.
 *
 * The panel was `${color.bg} bg-soft` with `style={{ borderColor: color.color }}`
 * — a soft wash plus a literal inline style, which is the one thing feature code
 * may never do. The panel is neutral now; the module hue rides the badge and the
 * solid CTA, both of which are fills and therefore legible.
 *
 * And that label measured 2.43:1 — `text-module-*` on a 15% tint of the same
 * hue. Module colors are FILLS.
 */
export function ToolLadder({ tool }: { tool: ToolMeta }) {
  const mod = getModule(tool.module);
  const href = `/${tool.module}`;

  return (
    <Band tone="page">
      <div className="border-base-300 bg-base-100 flex flex-col items-start justify-between gap-8 rounded-4xl border p-8 sm:p-10 lg:flex-row lg:items-center">
        <div className="flex max-w-2xl flex-col gap-4">
          <Heading level={2} size={3} className="tracking-tight">
            {tool.ladder.headline}
            {/* `text-primary`, not the module ink: these headings sit on a
                LIGHT band, where a module hue is a ~2.4:1 fill pretending to
                be ink. The module hue belongs on the dark hero and on fills. */}
            <span className="text-primary">.</span>
          </Heading>
          <Text className="text-lg">{tool.ladder.body}</Text>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3">
          <a
            href={href}
            aria-label={tool.ladder.cta}
            className={buttonClasses({ color: tool.module, variant: 'solid', size: 'lg' })}
          >
            {tool.ladder.cta}
            <ArrowRight className="h-4 w-4" />
          </a>
          <span
            className={badgeClasses({
              color: `module-${tool.module}`,
              variant: 'solid',
              size: 'sm',
            })}
          >
            {`Part of ${mod?.label ?? tool.module}`}
          </span>
        </div>
      </div>
    </Band>
  );
}
