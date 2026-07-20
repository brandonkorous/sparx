import { Badge } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Text } from '../primitives';

const NOTS: { not: string; because: string }[] = [
  { not: 'Not corporate blue', because: 'We left that on the table deliberately.' },
  { not: 'Not startup teal', because: 'Overused, and we’re past that era.' },
  { not: 'Not “AI purple”', because: 'The 2023–24 default that means nothing anymore.' },
  { not: 'Not rounded and bubbly', because: 'We’re precise, not friendly.' },
  { not: 'Not gradient-heavy', because: 'Flat is the point.' },
  { not: 'Not dark-mode-only', because: 'Both modes are first-class.' },
];

export function NotSection() {
  return (
    <Section id="not" surface="surface" padding="lg">
      <div className="flex flex-col gap-12">
        <SectionHeader
          accent="var(--color-module-ai)"
          headline="What sparx is not"
          lede="The brand is defined as much by what it refuses. sparx is the tool a senior developer wishes existed — technical enough to be trusted, simple enough for anyone to use."
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {NOTS.map((n) => (
            <div key={n.not} className="border-base-300 flex items-start gap-4 border-t py-[22px]">
              {/* Same Badge, same variant as the Misuse markers — one treatment
                  for "this is the wrong thing", not two hand-rolled circles. */}
              <Badge
                aria-hidden
                color="danger"
                variant="soft"
                size="sm"
                className="mt-0.5 shrink-0"
              >
                ✕
              </Badge>
              <div className="flex flex-col gap-1">
                <Text as="span" weight={500} tone="default">
                  {n.not}
                </Text>
                <Text as="span" size={14} tone="muted">
                  {n.because}
                </Text>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
