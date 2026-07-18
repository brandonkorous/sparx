import { Plus } from 'lucide-react';
import { Section, SectionHeader, getModuleColor } from '../primitives';
import { getToolContent } from './tool-content';
import { getToolSeo } from './tool-seo';
import type { ToolMeta } from './registry';

/**
 * Per-tool "good to know" section — the visible counterpart to the structured
 * data in ToolJsonLd. Leads with a crisp, quotable answer (featured-snippet /
 * AI-overview food), then explainers, a visible numbered how-to, and an FAQ.
 * Google requires HowTo/FAQ content to be visible on the page; this provides it.
 */
export function ToolLearn({ tool }: { tool: ToolMeta }) {
  const content = getToolContent(tool.slug);
  const seo = getToolSeo(tool.slug);
  if (!content) return null;
  const color = getModuleColor(tool.module);

  return (
    <Section surface="page" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <SectionHeader
          headline={content.heading ?? 'Good to know'}
          lede={seo?.answer}
          accent={color.color}
          headlineSize={32}
        />

        <div className="mkt-grid-2-1">
          {content.points.map((point) => (
            <div
              key={point.title}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '22px',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--color-base-100)',
                border: '1px solid var(--color-base-300)',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '16px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-base-content)',
                  margin: 0,
                }}
              >
                {point.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14.5px',
                  lineHeight: '23px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  margin: 0,
                }}
              >
                {point.body}
              </p>
            </div>
          ))}
        </div>

        {seo?.howTo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '18px',
                letterSpacing: '-0.01em',
                color: 'var(--color-base-content)',
                margin: 0,
              }}
            >
              {seo.howTo.name}
            </h3>
            <ol
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                margin: 0,
                padding: 0,
                listStyle: 'none',
              }}
            >
              {seo.howTo.steps.map((step, i) => (
                <li
                  key={step.name}
                  style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}
                >
                  <span
                    aria-hidden
                    className={`${color.bg} bg-soft ${color.ink}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '26px',
                      height: '26px',
                      flexShrink: 0,
                      borderRadius: '9999px',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    {i + 1}
                  </span>
                  <p
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14.5px',
                      lineHeight: '24px',
                      color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                      margin: 0,
                    }}
                  >
                    <strong style={{ color: 'var(--color-base-content)', fontWeight: 500 }}>
                      {step.name}.
                    </strong>{' '}
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '18px',
              letterSpacing: '-0.01em',
              color: 'var(--color-base-content)',
              margin: '0 0 8px',
            }}
          >
            Frequently asked
          </h3>
          {content.faq.map((item) => (
            <details
              key={item.q}
              className="mkt-faq-item"
              style={{ borderBottom: '1px solid var(--color-base-300)' }}
            >
              <summary
                className="mkt-summary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '18px 4px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '15.5px',
                    color: 'var(--color-base-content)',
                  }}
                >
                  {item.q}
                </span>
                <Plus className={`mkt-faq-icon ${color.ink}`} size={18} />
              </summary>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14.5px',
                  lineHeight: '23px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  margin: '0 4px 18px',
                  maxWidth: '720px',
                }}
              >
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
