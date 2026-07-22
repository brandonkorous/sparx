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

// The band is a `data-theme="dark"` island rather than a painted `#0A0A0A`:
// `.mkt-brand` only zeroes the radius (it sets no background), so flipping the
// whole --color-base-* ramp is safe here and gives every descendant on-brand
// surface + ink for free. The old rgba(255,255,255,.78/.5) inks are now
// `text-ink-muted` / `text-ink-subtle`, which are real ink (they mix into
// base-100, never transparent) and so satisfy the no-faded-text rule.

// Sticky header (components/marketing/site-header.tsx) is in normal flow
// (position: sticky, not fixed), so it consumes real height at the top of the
// page: 20px + 20px padding + a size="sm" button row + a 1px border ≈ 80px.
// The hero's minHeight subtracts that so hero + header together fill exactly
// one screen on load, instead of overflowing past the fold.
const HEADER_HEIGHT = '80px';

export function LandingV2Hero() {
  return (
    <section
      className="mkt-brand bg-base-100 px-page flex items-center py-[clamp(48px,8vw,96px)]"
      data-theme="dark"
      style={{
        minHeight: `calc(100dvh - ${HEADER_HEIGHT})`,
        // Decorative dot texture. Kept inline: it is an inlined SVG data URI
        // whose quotes/commas Tailwind's arbitrary-value parser cannot carry.
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='1' cy='1' r='1' fill='white' fill-opacity='0.14'/%3E%3C/svg%3E\")",
        backgroundSize: '40px 40px',
      }}
    >
      <Container className="w-full">
        <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-2">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1">
              <Display as="h1" size={132} lineHeight={116}>
                Run the business.
              </Display>
              <Display as="h1" size={132} lineHeight={116} color="var(--color-primary)">
                Not the software.
              </Display>
            </div>
            <p className="text-ink-muted m-0 max-w-[560px] text-[clamp(18px,1.9vw,23px)] leading-[1.6]">
              You started a business to make, sell, serve, teach, or finally work for yourself.
              Sparx brings your website, customers, sales, email and AI into one place that grows
              with you.
            </p>
            <div className="flex flex-wrap items-center gap-3">
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
                className={`${buttonClasses({ size: 'xl', variant: 'outline' })} border-base-content/30 text-base-content bg-transparent`}
              >
                See a day on sparx &darr;
              </a>
            </div>
            <span className="text-ink-subtle text-caption">
              No credit card &middot; Live in minutes &middot; Start with only what you need
            </span>
          </div>

          <BusinessDemoCard />
        </div>
      </Container>
    </section>
  );
}
