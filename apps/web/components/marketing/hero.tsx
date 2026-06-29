import { Button } from '@sparx/ui';
import { Container, Display, Spark } from './primitives';
import { RotatingWord } from './rotating-word';
import { SparkMascot } from './spark-mascot';

// The hero tagline rotates its leading noun through every offering, so the
// one-liner speaks for the whole platform — not just commerce. "ignited."
// stays fixed beneath it. See ./rotating-word.
const ROTATING_WORDS = [
  'Commerce',
  'Content',
  'Customers',
  'Email',
  'Wholesale',
  'AI',
  'Everything',
] as const;

// --- Hero theme -----------------------------------------------------------
// The hero runs on our primary indigo, so content is inverted to "on-color":
// white at varying opacity reads cleaner on saturated indigo than the gray
// invert scale used on the near-black sections. Elements that are normally
// the primary color (the eyebrow dot, the "ignited." spark, the builder
// module dot) are re-cast to white / ringed so they stay visible. To revert
// the purple hero, restore this file from git.
const ON = '#FFFFFF';
const ON_STRONG = 'rgba(255, 255, 255, 0.82)';
const ON_MUTED = 'rgba(255, 255, 255, 0.62)';
const ON_BORDER = 'rgba(255, 255, 255, 0.18)';
const ON_RING = 'rgba(255, 255, 255, 0.45)';
const ON_CTA_TEXT = '#4F46E5'; // indigo-600 — AA on the white primary button

const MODULE_DOTS = [
  '#6366F1',
  '#F97316',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
  '#475569',
  '#EC4899',
  '#10B981',
] as const;

const METRICS = [
  { value: '5 min', subtitle: 'to a live site' },
  { value: '$10', valueSuffix: '/mo', subtitle: 'starting price' },
  { value: '1', valueSuffix: ' bill', subtitle: 'replaces 4–6 tools' },
  { value: 'MCP', valueSpark: true, subtitle: 'native AI access' },
] as const;

export function Hero() {
  return (
    <section
      style={{
        paddingTop: 'clamp(64px, 11vw, 120px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--sparx-primary)',
        // Faint dot-grid texture for depth — a tiled SVG pattern, NOT a gradient
        // (gradients are banned brand-wide as an AI-slop tell).
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='1' cy='1' r='1' fill='white' fill-opacity='0.16'/%3E%3C/svg%3E\")",
        backgroundSize: '40px 40px',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {/* Two-column hero: copy left; the mascot sits directly above the CTAs on
            the right (centred) so it presents the action instead of floating in
            the corner. Stacks on tablet down. */}
        <div className="mkt-hero-grid" style={{ maxWidth: '1280px' }}>
          <div className="mkt-hero-copy">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Display as="h1" size={120} lineHeight={104} color={ON}>
                <RotatingWord words={ROTATING_WORDS} />,
              </Display>
              <Display as="h1" size={120} lineHeight={104} color={ON}>
                ignited
                <Spark color={ON} />
              </Display>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                fontSize: 'clamp(16px, 1.6vw, 20px)',
                lineHeight: 1.55,
                color: ON_STRONG,
                maxWidth: '560px',
                margin: 0,
              }}
            >
              A modular content and commerce OS. Builder, CRM, CMS, email, B2B, and AI — one
              platform, one bill, one data layer. Pay only for what you use. Live in five minutes.
            </p>
          </div>

          <div className="mkt-hero-figure">
            {/* bob off: a still body keeps focus on the rotating headline; the
                face still blinks and cycles expressions. */}
            <SparkMascot
              cycle={['neutral', 'happy', 'wink', 'excited']}
              size={232}
              tone="white"
              bob={false}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                alignItems: 'center',
              }}
            >
              <div className="mkt-cluster" style={{ gap: '12px', justifyContent: 'center' }}>
                <Button size="lg" style={{ backgroundColor: ON, color: ON_CTA_TEXT }}>
                  Launch your site
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  style={{ backgroundColor: 'transparent', color: ON, borderColor: ON_RING }}
                >
                  See the platform
                </Button>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: ON_MUTED }}>
                No credit card · Cancel anytime
              </span>
            </div>
          </div>
        </div>

        <div
          className="mkt-cluster"
          style={{
            justifyContent: 'space-between',
            paddingTop: '32px',
            marginTop: '32px',
            borderTop: `1px solid ${ON_BORDER}`,
            gap: '32px',
            rowGap: '24px',
          }}
        >
          <div className="mkt-cluster" style={{ gap: '24px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: ON_MUTED }}>
              8 modules
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {MODULE_DOTS.map((c) => (
                // A white ring keeps every dot legible on the indigo field —
                // including the builder dot, which is the primary itself.
                <span
                  key={c}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 9999,
                    backgroundColor: c,
                    boxShadow: `0 0 0 1px ${ON_RING}`,
                  }}
                />
              ))}
            </div>
          </div>
          <div
            className="mkt-cluster"
            style={{ gap: '40px', rowGap: '20px', justifyContent: 'flex-end' }}
          >
            {METRICS.map((m) => (
              <div
                key={m.subtitle}
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '24px',
                    letterSpacing: '-0.02em',
                    color: ON,
                  }}
                >
                  {m.value}
                  {'valueSuffix' in m && m.valueSuffix ? (
                    <span style={{ color: ON_MUTED }}>{m.valueSuffix}</span>
                  ) : null}
                  {'valueSpark' in m && m.valueSpark ? <Spark color="#F9A8D4" /> : null}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    color: ON_MUTED,
                  }}
                >
                  {m.subtitle}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
