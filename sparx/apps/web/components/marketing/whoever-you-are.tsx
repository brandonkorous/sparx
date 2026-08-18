// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Container, SectionHeader, Spark } from './primitives';
import { Reveal } from './reveal';
import { VideoMontage } from './video-montage';
import { signupHref } from './cta';

/**
 * "Whoever you are" — the multi-vertical beat, staged as a full-bleed video.
 * A montage cycles through different KINDS of business (seller, maker, tailor,
 * salon, studio, workshop, dropship, retailer) behind a charcoal scrim, with
 * the headline + CTAs sitting over the footage — it says "this is for you,
 * whatever you run" faster than a feature list. It runs as the second beat
 * right after the hero, answering "is this for me?" with vivid breadth before
 * the feature tour. See ./video-montage for the playlist, overlay, and
 * lazy/poster behaviour.
 */
export function WhoeverYouAre({
  headlineSize,
  headlineLineHeight,
}: {
  /** Override the headline's Display size (defaults to SectionHeader's own
   *  56px). The homepage passes a larger value so this section's type
   *  matches the rest of its bigger-type narrative page. */
  headlineSize?: number;
  headlineLineHeight?: number;
} = {}) {
  return (
    // The copy sits over footage behind a charcoal scrim, so the whole band is a
    // themed dark island: `--color-base-content` (and the ink tones) resolve light
    // on their own. That replaces the old rgba(255,255,255,.92) lede override AND
    // fixes the trailing `text-base-content` line, which previously went dark on
    // the video whenever the visitor browsed in light mode. The island lives on
    // the <section> because <Container> deliberately takes no arbitrary DOM props.
    <section id="whoever" className="mkt-whoever mkt-brand" data-theme="dark">
      <VideoMontage />
      <Container className="relative z-1 w-full">
        <Reveal
          className={`flex flex-col gap-9 ${headlineSize ? 'max-w-[860px]' : 'max-w-[720px]'}`}
        >
          <SectionHeader
            headlineSize={headlineSize}
            headlineLineHeight={headlineLineHeight}
            headline={
              <>
                Whoever you are,
                <br />
                it&apos;s already for you
                <Spark />
              </>
            }
            lede={
              <>
                A maker, a shop, a studio, a workshop, a wholesaler. sparx bends to the business you
                actually run, not the other way around.
              </>
            }
          />
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={signupHref('whoever')}
                aria-label="Start free"
                className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
              >
                Start free →
              </a>
              {/* <a
                                href="#modules"
                                aria-label="Explore the modules"
                                className={buttonClasses({ size: 'lg', color: 'secondary', variant: 'outline' })}
                            >
                                Explore the modules
                            </a> */}
            </div>
            <span className="text-base-content">
              No card · Cancel anytime · Pay only for what you use
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
