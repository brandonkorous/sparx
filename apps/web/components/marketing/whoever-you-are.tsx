import { Button } from '@sparx/ui';
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
export function WhoeverYouAre() {
  return (
    <section id="whoever" className="mkt-whoever mkt-brand">
      <VideoMontage />
      <Container style={{ position: 'relative', zIndex: 1, width: '100%' }}>
        <Reveal
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '36px',
            maxWidth: '720px',
          }}
        >
          <SectionHeader
            invert
            ledeColor="rgba(255, 255, 255, 0.92)"
            headline={
              <>
                Whoever you are,
                <br />
                it&apos;s already for you
                <Spark color="#818CF8" />
              </>
            }
            lede={
              <>
                A maker, a shop, a studio, a workshop, a wholesaler. sparx bends to the business you
                actually run, not the other way around.
              </>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="mkt-cluster" style={{ gap: '12px' }}>
              <Button asChild size="lg" variant="solid">
                <a href={signupHref('whoever')}>Start free →</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                style={{
                  backgroundColor: 'transparent',
                  color: '#ffffff',
                  borderColor: 'rgba(255, 255, 255, 0.4)',
                }}
              >
                <a href="#modules">Explore the modules</a>
              </Button>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.82)',
              }}
            >
              No card · Cancel anytime · Pay only for what you use
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
