import * as React from 'react';
import { ModuleProvider } from '@sparx/ui';
import { Nav } from '../nav';
import { Footer } from '../footer';
import { Section, Display, Spark, getModuleColor } from '../primitives';
import type { ToolMeta } from './registry';
import { ToolLadder } from './tool-ladder';
import { ToolUpsell } from './tool-upsell';
import { ToolLearn } from './tool-learn';
import { ToolJsonLd } from './tool-jsonld';
import { RelatedTools } from './related-tools';
import { TrustRow } from './trust-row';

/**
 * Shared page frame for every tool. Server-rendered chrome (Nav, hero, ladder
 * CTA, related strip, Footer) wraps the interactive client tool passed as
 * `children`. The tool area is wrapped in <ModuleProvider> so @sparx/ui controls
 * (and the FileUpload/ColorPicker active states) adopt this tool's module color.
 */
export function ToolShell({ tool, children }: { tool: ToolMeta; children: React.ReactNode }) {
  const color = getModuleColor(tool.module);
  const Icon = tool.icon;

  return (
    <>
      <ToolJsonLd tool={tool} />
      <Nav />
      <main>
        <Section surface="page" padding="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <nav
              aria-label="Breadcrumb"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <a href="/tools" className="mkt-navlink" style={{ fontSize: '13px' }}>
                Free tools
              </a>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>/</span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {tool.name}
              </span>
            </nav>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  flexShrink: 0,
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: color.tint,
                  color: color.text,
                  boxShadow: 'inset 0 0 0 1px rgba(9, 9, 11, 0.06)',
                }}
              >
                <Icon size={26} strokeWidth={1.6} />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
                <Display as="h1" size={46}>
                  {tool.name}
                  <Spark color={color.color} />
                </Display>
                <p
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '18px',
                    lineHeight: '29px',
                    color: 'var(--color-text-secondary)',
                    maxWidth: '660px',
                    margin: 0,
                  }}
                >
                  {tool.tagline}
                </p>
                <TrustRow />
              </div>
            </div>
          </div>
        </Section>

        <Section surface="surface" padding="lg">
          <ModuleProvider module={tool.module}>{children}</ModuleProvider>
        </Section>

        <ToolLearn tool={tool} />
        <ToolLadder tool={tool} />
        <ToolUpsell tool={tool} />
        <RelatedTools currentSlug={tool.slug} />
      </main>
      <Footer />
    </>
  );
}
