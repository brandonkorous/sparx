import * as React from 'react';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Text } from '../primitives';

/**
 * Logo misuse grid. Each tile renders a deliberately WRONG treatment of the
 * wordmark with a danger marker and a one-line caption — the fastest way to
 * communicate the rules from the wordmark section as "don't do this".
 *
 * The demos use a lightweight inline wordmark (not the official artwork) so the
 * violation — recolor, distort, rotate — is easy to stage.
 */

function Faux({
  xColor = 'var(--color-primary)',
  inkColor = 'var(--color-base-content)',
  style,
}: {
  xColor?: string;
  inkColor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="text-[34px] leading-none font-bold tracking-[-0.03em]"
      // SPECIMEN — the wordmark face, its ink, and the deliberately-WRONG
      // treatments passed in via `style` (recolor / glow / stretch / rotate /
      // low-contrast fill) are the SUBJECT of this section, not styling. They
      // stay literal so a theme change can never repaint the counter-example.
      style={{
        fontFamily: "var(--font-wordmark, 'Inter', system-ui, sans-serif)",
        color: inkColor,
        ...style,
      }}
    >
      spar<span style={{ color: xColor }}>x</span>
    </span>
  );
}

const DONTS: { caption: string; demo: React.ReactNode }[] = [
  {
    caption: 'Don’t recolor the “x”. It is always sparx Ember.',
    demo: <Faux xColor="#10B981" />,
  },
  {
    caption:
      'Don’t let the “x” vanish into the letters. Keep it Ember — or, in one-color use, dimmed.',
    demo: <Faux xColor="var(--color-base-content)" />,
  },
  {
    caption: 'Don’t add shadows, glows, or gradients.',
    demo: <Faux style={{ filter: 'drop-shadow(0 4px 6px rgba(224,70,49,0.55))' }} />,
  },
  {
    caption: 'Don’t stretch, condense, or distort.',
    demo: <Faux style={{ transform: 'scaleX(1.7)', transformOrigin: 'center' }} />,
  },
  {
    caption: 'Don’t rotate or set on an angle.',
    demo: <Faux style={{ transform: 'rotate(-9deg)' }} />,
  },
  {
    caption: 'Don’t place on a low-contrast or clashing fill.',
    demo: <Faux inkColor="#efa79b" xColor="#f6c7bf" style={{ padding: '0 4px' }} />,
    // staged on the ember tile below for the clash
  },
];

export function MisuseSection() {
  return (
    <Section id="misuse" surface="page" padding="lg">
      <div className="flex flex-col gap-12">
        <SectionHeader
          accent="var(--color-danger)"
          headline={
            <>
              What not to do <span>with the mark</span>
            </>
          }
          lede="The wordmark earns its clarity from restraint. These are the treatments that break it — each one undoes the single detail the brand is built on."
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DONTS.map((d, i) => (
            <Card key={d.caption} className="overflow-hidden">
              <CardBody className="flex flex-col p-0">
                <div
                  className={`border-base-300 relative flex min-h-[128px] items-center justify-center overflow-hidden border-b px-6 py-10 ${
                    // Tile 6 stages the clash demo on a full Ember fill.
                    i === 5 ? 'bg-primary' : 'bg-base-200'
                  }`}
                >
                  {d.demo}
                  {/* A real Badge in its natural shape — silica has no circle
                      badge, so forcing one (fixed w/h + rounded-full + font
                      overrides) was fighting the component. Position only. */}
                  <Badge
                    aria-hidden
                    color="danger"
                    variant="soft"
                    size="sm"
                    className="absolute top-3 right-3"
                  >
                    ✕
                  </Badge>
                </div>
                <Text as="figcaption" size={13.5} className="px-5 py-4">
                  {d.caption}
                </Text>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}
