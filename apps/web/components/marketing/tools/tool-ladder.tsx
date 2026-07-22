import { ArrowRight } from 'lucide-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Section, Display, getModuleColor } from '../primitives';
import { getModule } from '@/lib/modules';
import type { ToolMeta } from './registry';

/**
 * The "ladder" — connects a free tool up to the paid sparx module it belongs to.
 * This is what turns the tools hub from a utility drawer into a funnel: every
 * tool ends with a tasteful hand-off to the module that does the real version.
 *
 * The module name above the headline used to be an uppercase mono kicker; it is
 * now sentence case in the module's own ink, carrying hierarchy with weight +
 * color instead of letterspaced caps.
 */
export function ToolLadder({ tool }: { tool: ToolMeta }) {
  const color = getModuleColor(tool.module);
  const mod = getModule(tool.module);
  const href = `/${tool.module}`;

  return (
    <Section surface="page" padding="md">
      <div
        className={`flex flex-col items-center justify-between gap-7 rounded-xl border p-9 lg:flex-row ${color.bg} bg-soft`}
        // The panel hairline is this tool's module hue — a per-module value, so
        // it cannot be a static utility class (Tailwind can't see an
        // interpolated `border-module-${key}`).
        style={{ borderColor: color.color }}
      >
        <div className="flex max-w-[620px] flex-col gap-3">
          <span className={`text-small font-sans font-medium ${color.ink}`}>
            {mod?.label ?? tool.module}
          </span>
          <Display as="h2" size={28} color="var(--color-base-content)">
            {tool.ladder.headline}
          </Display>
          <p className="text-body-lg text-ink-muted m-0 font-sans">{tool.ladder.body}</p>
        </div>
        <a
          href={href}
          aria-label={tool.ladder.cta}
          className={`${buttonClasses({ color: tool.module, variant: 'solid', size: 'lg' })} shrink-0`}
        >
          {tool.ladder.cta}
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </Section>
  );
}
