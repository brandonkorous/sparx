// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Container, Display } from '../primitives';
import { signupHref } from '../cta';
import { BusinessDemoCard } from './hero-device';

// The v2 story-landing hero. A near-black band (the same "ink" register the
// site already uses for FinalCta / the day timeline) rather than the
// homepage's purple brand band — this variant leads with a product-in-use
// vignette, not the module strip, so it wants its own visual identity.
// `mkt-brand` is used only for its radius:0 escape hatch (flush to the
// header); the color itself is set inline, the same trick Hero.tsx uses for
// the purple homepage band.

const INK = '#0A0A0A';
const ON_STRONG = 'rgba(255, 255, 255, 0.78)';
const ON_MUTED = 'rgba(255, 255, 255, 0.5)';

// Sticky header (packages/web-chrome/src/site-header.tsx) is in normal flow
// (position: sticky, not fixed), so it consumes real height at the top of the
// page: 20px + 20px padding + a size="sm" button row + a 1px border ≈ 80px.
// The hero's minHeight subtracts that so hero + header together fill exactly
// one screen on load, instead of overflowing past the fold.
const HEADER_HEIGHT = '80px';

export function LandingV2Hero() {
  return (
    <section
      className="mkt-brand"
      style={{
        minHeight: `calc(100dvh - ${HEADER_HEIGHT})`,
        display: 'flex',
        alignItems: 'center',
        paddingTop: 'clamp(48px, 8vw, 96px)',
        paddingBottom: 'clamp(48px, 8vw, 96px)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: INK,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='1' cy='1' r='1' fill='white' fill-opacity='0.14'/%3E%3C/svg%3E\")",
        backgroundSize: '40px 40px',
      }}
    >
      <Container className="w-full">
        <div className="mkt-grid-2-1" style={{ gap: '64px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Display as="h1" size={132} lineHeight={116} color="#FFFFFF">
                Run the business.
              </Display>
              <Display as="h1" size={132} lineHeight={116} color="var(--color-primary)">
                Not the software.
              </Display>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(18px, 1.9vw, 23px)',
                lineHeight: 1.6,
                color: ON_STRONG,
                maxWidth: '560px',
                margin: 0,
              }}
            >
              You started a business to make, sell, serve, teach, or finally work for yourself.
              Sparx brings your website, customers, sales, email and AI into one place that grows
              with you.
            </p>
            <div className="mkt-cluster" style={{ gap: '12px' }}>
              <a
                href={signupHref('landing-v2-hero')}
                aria-label="Launch your site"
                className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
              >
                Launch your site
              </a>
              <a
                href="#day"
                aria-label="See a day on sparx"
                className={buttonClasses({ size: 'xl', variant: 'outline' })}
                style={{
                  backgroundColor: 'transparent',
                  color: '#FFFFFF',
                  borderColor: 'rgba(255, 255, 255, 0.28)',
                }}
              >
                See a day on sparx &darr;
              </a>
            </div>
            <span style={{ fontSize: '13px', color: ON_MUTED }}>
              No credit card &middot; Live in minutes &middot; Start with only what you need
            </span>
          </div>

          <BusinessDemoCard />
        </div>
      </Container>
    </section>
  );
}
