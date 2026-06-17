import { ArrowRight } from 'lucide-react';
import { Button } from '@sparx/ui';
import { Nav } from '../nav';
import { Footer } from '../footer';
import { Section, Display, Spark, getModuleColor } from '../primitives';
import { TOOLS } from './registry';
import { ToolCard } from './tool-card';
import { TrustRow } from './trust-row';
import { ToolsValue } from './tools-value';

/** The /tools hub — a grid of every free tool, plus the platform hand-off. */
export function ToolsIndex() {
  return (
    <>
      <Nav />
      <main>
        <Section surface="page" padding="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '760px' }}>
            <Display as="h1" size={60}>
              Free tools for people who build things
              <Spark color={getModuleColor('builder').color} />
            </Display>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '19px',
                lineHeight: '31px',
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}
            >
              Quick, genuinely good utilities for founders, makers, and small teams — favicons, QR
              codes, campaign links, social cards, email signatures, invoices. Every one runs
              entirely in your browser. Nothing to upload, nothing to install, no account.
            </p>
            <TrustRow />
          </div>
        </Section>

        <Section surface="surface" padding="lg">
          <div className="mkt-grid-3-2-1">
            {TOOLS.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </Section>

        <ToolsValue />

        <Section surface="page" padding="lg">
          <div
            className="mkt-stack-on-tablet"
            style={{
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '28px',
              padding: '40px',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '640px' }}
            >
              <Display as="h2" size={30}>
                These run on the same platform you can build your business on
              </Display>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '16px',
                  lineHeight: '26px',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                }}
              >
                sparx is the modular content and commerce OS — storefront, CRM, CMS, email, B2B, and
                AI, activated independently on one data layer and one bill. The tools are a taste;
                the platform is the meal.
              </p>
            </div>
            <Button asChild color="primary" variant="solid" size="lg" style={{ flexShrink: 0 }}>
              <a href="/platform">
                Explore the platform
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
