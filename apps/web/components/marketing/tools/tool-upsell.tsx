import { ArrowRight } from 'lucide-react';
import { Button } from '@sparx/ui';
import { Section, SectionHeader, getModuleColor } from '../primitives';
import { getModule } from '@/lib/modules';
import type { ToolMeta } from './registry';

/**
 * Per-tool upsell — sits between the ladder CTA and the "more tools" strip. The
 * ladder is the hook ("your whole site, not just its favicon"); this is the
 * proof. It pulls three real capabilities from the module's own feature list
 * (lib/modules.ts), so the copy never drifts from what actually ships, then
 * frames the module inside the wider platform.
 */
export function ToolUpsell({ tool }: { tool: ToolMeta }) {
  const mod = getModule(tool.module);
  if (!mod) return null;
  const color = getModuleColor(tool.module);
  const shortLabel = mod.label.split('·')[0]!.trim();
  const features = mod.features.slice(0, 3);

  return (
    <Section surface="page" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
        <SectionHeader
          headline={`What you get with sparx ${shortLabel}`}
          lede={mod.lede}
          accent={color.color}
          headlineSize={32}
        />

        <div className="mkt-grid-3-2-1">
          {features.map((feature) => (
            <div
              key={feature.number}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '22px',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: color.text,
                }}
              >
                {feature.number}
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '16px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text-primary)',
                  margin: 0,
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  lineHeight: '22px',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                }}
              >
                {feature.body}
              </p>
            </div>
          ))}
        </div>

        <div
          className="mkt-cluster"
          style={{ justifyContent: 'space-between', gap: '20px', rowGap: '16px' }}
        >
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              lineHeight: '24px',
              color: 'var(--color-text-secondary)',
              maxWidth: '560px',
              margin: 0,
            }}
          >
            {shortLabel} is one module on the sparx platform — activate it alongside storefront,
            CRM, CMS, email, and B2B on one data layer and one bill. Only pay for what you run.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button asChild color={tool.module} variant="solid" size="md">
              <a href="/platform">
                Explore the platform
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild color="neutral" variant="outline" size="md">
              <a href="/pricing">See pricing</a>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
