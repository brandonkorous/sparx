'use client';

import * as React from 'react';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Text } from '../primitives';
import { SparkMascot, type SparkExpression } from '../spark-mascot';

// The mascot section of the brand guide — sparky in the flesh, animated, plus a
// live expression picker so anyone can exercise every face. Doubles as the test
// bed for the SparkMascot component: if a face looks wrong, it shows here first.

const EXPRESSIONS: { id: SparkExpression; label: string }[] = [
  { id: 'happy', label: 'Happy' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'content', label: 'Content' },
  { id: 'wink', label: 'Wink' },
  { id: 'excited', label: 'Excited' },
  { id: 'surprised', label: 'Surprised' },
  { id: 'sad', label: 'Sad' },
  { id: 'asleep', label: 'Asleep' },
];

// The order sparky cycles through when nothing is pinned — a friendly loop.
const CYCLE: SparkExpression[] = ['happy', 'wink', 'excited', 'content', 'surprised', 'happy'];

export function MascotSection() {
  // null → auto-cycle; a value → pin that face so it can be inspected.
  const [pinned, setPinned] = React.useState<SparkExpression | null>(null);

  return (
    <Section id="mascot" surface="page" padding="lg">
      <div className="flex flex-col gap-12">
        <SectionHeader
          accent="var(--color-primary)"
          headline="Meet sparky"
          lede="The mascot is the wordmark’s “x”, mutated into a spark and given a face. He carries a beat of personality where the product wants one — an empty state, a 404, a win — without ever competing with the work. One character, one Ember body, a handful of expressions."
        />

        {/* Stage + picker */}
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <Card className="bg-primary bg-soft">
            <CardBody className="flex min-h-[320px] items-center justify-center">
              <SparkMascot
                key={pinned ?? 'cycle'}
                expression={pinned ?? 'happy'}
                cycle={pinned ? undefined : CYCLE}
                size={220}
                tone="light"
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Text as="h3" size={15} weight={500}>
                  Try his faces
                </Text>
                <Text size={13.5}>
                  Pick an expression to pin it, or let him cycle. He blinks and bobs on his own —
                  motion honours reduced-motion.
                </Text>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Chip active={pinned === null} onClick={() => setPinned(null)}>
                  ▶ Auto-cycle
                </Chip>
                {EXPRESSIONS.map((e) => (
                  <Chip key={e.id} active={pinned === e.id} onClick={() => setPinned(e.id)}>
                    {e.label}
                  </Chip>
                ))}
              </div>

              <div className="mt-auto flex flex-col gap-2.5">
                <Text as="span" mono size={11} className="tracking-[0.02em]">
                  Two tones — the face flips so it stays legible.
                </Text>
                <div className="flex flex-wrap items-center gap-3">
                  <TonePlate label="On light" bg="var(--color-base-200)" tone="light" border />
                  <TonePlate label="On dark" bg="var(--color-secondary)" tone="dark" />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </Section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // A silica Button toggle: the active face wears the primary soft treatment,
  // the rest are neutral outlines.
  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      color={active ? 'primary' : 'neutral'}
      variant={active ? 'soft' : 'outline'}
      active={active}
    >
      {children}
    </Button>
  );
}

function TonePlate({
  label,
  bg,
  tone,
  border,
}: {
  label: string;
  bg: string;
  tone: 'light' | 'dark';
  border?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex size-[84px] items-center justify-center rounded-lg ${
          border ? 'border-base-300 border' : ''
        }`}
        // SPECIMEN — `bg` is the surface this mascot tone is being demonstrated
        // AGAINST, so the literal value is the subject of the plate.
        style={{ background: bg }}
      >
        <SparkMascot expression="happy" size={56} tone={tone} bob={false} />
      </div>
      <Text as="span" size={12}>
        {label}
      </Text>
    </div>
  );
}
