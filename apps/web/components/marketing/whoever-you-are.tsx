import { Button } from '@wizeworks/silicaui-react';
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
        <section id="whoever" className="mkt-whoever mkt-brand">
            <VideoMontage />
            <Container style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                <Reveal
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '36px',
                        maxWidth: headlineSize ? '860px' : '720px',
                    }}
                >
                    <SectionHeader
                        invert
                        ledeColor="rgba(255, 255, 255, 0.92)"
                        headlineSize={headlineSize}
                        headlineLineHeight={headlineLineHeight}
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
                            <Button
                                size="lg"
                                color="primary"
                                variant="solid"
                                render={<a href={signupHref('whoever')} aria-label="Start free" />}
                            >
                                Start free →
                            </Button>
                            {/* <Button
                                size="lg"
                                color="secondary"
                                variant="outline"
                                render={<a href="#modules" aria-label="Explore the modules" />}
                            >
                                Explore the modules
                            </Button> */}
                        </div>
                        <span className="text-base-content"
                        >
                            No card · Cancel anytime · Pay only for what you use
                        </span>
                    </div>
                </Reveal>
            </Container>
        </section>
    );
}
