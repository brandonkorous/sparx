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
 */
export function ToolLadder({ tool }: { tool: ToolMeta }) {
  const color = getModuleColor(tool.module);
  const mod = getModule(tool.module);
  const href = `/${tool.module}`;

  return (
    <Section surface="page" padding="md">
      <div
        className={`mkt-stack-on-tablet ${color.bg} bg-soft`}
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '28px',
          padding: '36px',
          borderRadius: 'var(--radius-xl)',
          border: `1px solid ${color.color}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '620px' }}>
          <span
            className={color.ink}
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '12px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {mod?.label ?? tool.module}
          </span>
          <Display as="h2" size={28} color="var(--color-base-content)">
            {tool.ladder.headline}
          </Display>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '15.5px',
              lineHeight: '25px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              margin: 0,
            }}
          >
            {tool.ladder.body}
          </p>
        </div>
        <a
          href={href}
          aria-label={tool.ladder.cta}
          className={buttonClasses({ color: tool.module, variant: 'solid', size: 'lg' })}
          style={{ flexShrink: 0 }}
        >
          {tool.ladder.cta}
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </Section>
  );
}
