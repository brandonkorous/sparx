import { Heading, Text } from '@wizeworks/silicaui-react';
import { Container } from '../primitives';
import { DashboardFrame } from '../dashboard-showcase';
import { SECTION_DISPLAY_STYLE } from './heading-style';

// "One pane of glass" — the product-proof beat. A bold Ember full-bleed
// backdrop (the same brand hue as the video band earlier on the page) so the
// light dashboard mockup floats off it like a real screenshot, rather than
// blending into a plain gray "stage" tier the way the homepage renders it.
// The interactive mockup (DashboardFrame) is a faithful recreation of the
// real app, not editorial marketing type, so it's reused byte-for-byte from
// the homepage; only this shell (backdrop/headline/lede) is redesigned.

export function LandingV2DashboardSection() {
  return (
    <section className="mkt-brand bg-primary px-page py-section-lg">
      <Container className="flex flex-col gap-16">
        <div className="max-w-3xl">
          <Heading
            level={2}
            size="display"
            style={SECTION_DISPLAY_STYLE}
            className="text-primary-content"
          >
            One pane of glass.
          </Heading>
          {/* Full ink on the brand band — `--color-primary-content` is the
              paired token, replacing a faded rgba(255,255,255,.82). */}
          <Text variant="lead" className="text-primary-content mt-5 max-w-xl">
            sparx is one URL, one login, one sidebar. Each active module gets a colored nav item and
            a module-tinted card — you always know where you are.
          </Text>
        </div>
        {/* `bleed` is correct HERE and only here: this section pads by
            `--gutter-page`, which is exactly what the pull cancels against. */}
        <DashboardFrame bleed />
      </Container>
    </section>
  );
}
