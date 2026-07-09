import { ArrowRight } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
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
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                margin: 0,
              }}
            >
              Favicons, QR codes, campaign links, social cards, email signatures, invoices, and a
              dozen more — the small jobs that eat an afternoon. Built for founders, makers, and
              small teams who&rsquo;d rather get it done and move on. Open one and start; your work
              stays on your machine, and nothing here costs a thing.
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
              backgroundColor: 'var(--color-base-100)',
              border: '1px solid var(--color-base-300)',
            }}
          >
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '640px' }}
            >
              <Display as="h2" size={30}>
                Same platform. From a free favicon to your whole business
              </Display>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '16px',
                  lineHeight: '26px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  margin: 0,
                }}
              >
                sparx is the modular content and commerce OS — your website, CMS, CRM, email,
                commerce, B2B, and AI, each switched on when you need it, all on one data layer and
                one bill. These tools handle a single job for free. sparx handles the rest, for
                years.
              </p>
            </div>
            <Button
              color="primary"
              variant="solid"
              size="lg"
              style={{ flexShrink: 0 }}
              render={<a href="/platform" />}
            >
              Explore the platform
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
