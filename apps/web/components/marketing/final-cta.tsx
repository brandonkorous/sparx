// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Container, Display, Spark } from './primitives';
import { Reveal } from './reveal';
import { EARLY_HREF, SALES_HREF, signupHref } from './cta';

// The closing beat. A near-black band that ends the page on the offer, not on a
// metric row — the earlier Permanence band carries the proof numbers, so
// repeating a four-stat row here just reads as the same slide a third time.
// Primary action is self-serve signup; "book a call" routes to the enterprise
// page; a quiet third line keeps the early-access waitlist reachable for anyone
// not ready to open an account yet.
export function FinalCta() {
  return (
    // A real `data-theme="dark"` island. Inside it the whole `--color-base-*`
    // ramp flips, so the paneled system's own content-tier rule
    // (`background-color: var(--color-base-100) !important`) paints this band
    // dark, and every ink resolves from `base-content` with no inverse-tier
    // class. `bg-base-100` is the standalone fallback for the same section
    // rendered outside `.mkt-paneled`.
    <section
      data-theme="dark"
      className="mkt-inverse bg-base-100 text-base-content px-page py-section-xl"
    >
      <Container>
        <Reveal className="flex flex-col items-start justify-between gap-12 lg:flex-row lg:items-end">
          <div className="flex max-w-[920px] flex-col gap-8">
            <Display size={96} lineHeight={92}>
              Light the spark
              <Spark />
            </Display>
            <p className="text-base-content m-0 max-w-[620px] text-[20px] leading-8">
              Sign up free. Switch on the modules you need. Be live before the kettle boils — then
              keep the site, the data, and the control for years. No card, no contract, no upgrade
              lock-in.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3.5 lg:items-end">
            <a
              href={signupHref('final')}
              aria-label="Start your site"
              className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
            >
              Start your site →
            </a>
            <a
              href={SALES_HREF}
              aria-label="Book a 20-min call"
              className={buttonClasses({ size: 'xl', variant: 'outline' })}
            >
              Book a 20-min call
            </a>
            <span className="text-base-content text-mini pt-2 font-mono">
              $0 to start · cancel any time ·{' '}
              <a href={EARLY_HREF} className="text-primary no-underline">
                not ready? join early access →
              </a>
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
