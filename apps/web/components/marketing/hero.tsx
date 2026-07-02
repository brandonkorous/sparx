import { Button } from '@sparx/ui';
import { Container, Display, Spark } from './primitives';
import { RotatingWord } from './rotating-word';
import { SparkMascot } from './spark-mascot';
import { MODULES } from './modules-catalog';
import { ModuleStrip } from './module-strip';

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
// the primary color (the eyebrow dot, the "ignited." spark) are re-cast to white
// so they stay visible. The module strip uses the SAME Lucide glyphs as the
// dashboard sidebar (MODULE_ICON): each chip wears its module hue with a white
// glyph + a faint white border, so even the builder chip (indigo, == the hero
// field) stays delineated. To revert the purple hero, restore from git.
const ON = '#FFFFFF';
const ON_STRONG = 'rgba(255, 255, 255, 0.82)';
const ON_MUTED = 'rgba(255, 255, 255, 0.62)';
const ON_BORDER = 'rgba(255, 255, 255, 0.18)';
const ON_RING = 'rgba(255, 255, 255, 0.45)';
const ON_CTA_TEXT = '#4F46E5'; // indigo-600 — AA on the white primary button

const METRICS = [
  { value: '5 min', subtitle: 'to a live site' },
  { value: '$10', valueSuffix: '/mo', subtitle: 'starting price' },
  { value: '1', valueSuffix: ' bill', subtitle: 'replaces 4–6 tools' },
  { value: 'MCP', valueSpark: true, subtitle: 'native AI access' },
] as const;

export function Hero() {
  return (
    <section
      className="mkt-brand"
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

        <HeroStatBar />
      </Container>
    </section>
  );
}

// The trust/breadth footer under the hero: the module strip (count + the same
// Lucide glyphs as the dashboard sidebar) on the left, headline metrics on the
// right. Wraps to its own row on narrower viewports via .mkt-cluster.
function HeroStatBar() {
  return (
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
      <div className="mkt-cluster" style={{ gap: '20px' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: ON_MUTED }}>
          {MODULES.length} modules
        </span>
        <ModuleStrip />
      </div>
      <div
        className="mkt-cluster"
        style={{ gap: '40px', rowGap: '20px', justifyContent: 'flex-end' }}
      >
        {METRICS.map((m) => (
          <div key={m.subtitle} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: ON_MUTED }}>
              {m.subtitle}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
