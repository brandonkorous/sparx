import { Badge } from '@wizeworks/silicaui-react';
import { HeroPanel, HeroRow, HeroRows } from './panel';

// /trust — the answers, before the reasoning.
//
// Somebody on this page has a short list of specific worries and is scanning for
// them. The page answers all of them properly, in seven pillars and six
// questions, and it opened with a paragraph promising that it would. This is the
// answer sheet: six things a careful reader wants stated, each in two words, with
// the argument for each still waiting below.
//
// ── WHAT IS DELIBERATELY NOT IN IT ──────────────────────────────────────────
//
// No certification badge and no uptime figure — the page names both as things it
// refuses to show, and a hero that quietly reintroduced them as green ticks would
// be the page contradicting itself in its own fold. Every row here is a thing the
// platform genuinely does; "Not yet" is a real answer and it is given as one.
//
// ── THE TONES ARE SEMANTIC, NOT DECORATIVE ──────────────────────────────────
//
// `success` where the answer is the reassuring one, `warning` where it is honest
// but not what somebody hoped to read. A trust page that painted every row green
// would be doing the badge thing with a different component.

const FACTS: { q: string; a: string; tone: 'success' | 'warning' }[] = [
  { q: 'Separation between businesses', a: 'At the database', tone: 'success' },
  { q: 'In transit and at rest', a: 'Encrypted', tone: 'success' },
  { q: 'Export everything you have', a: 'Any time, no asking', tone: 'success' },
  { q: 'Your data used to train AI', a: 'Never', tone: 'success' },
  { q: 'Two-step sign-in', a: 'Available today', tone: 'success' },
  { q: 'Certifications', a: 'None yet', tone: 'warning' },
];

export function TrustFigure() {
  return (
    <HeroPanel>
      <div className="border-base-300 border-b px-5 py-3.5">
        <b className="text-base font-bold">The short answers</b>
      </div>

      <HeroRows>
        {FACTS.map((fact) => (
          <HeroRow
            key={fact.q}
            label={fact.q}
            right={
              <Badge color={fact.tone} variant="soft" size="lg">
                {fact.a}
              </Badge>
            }
          />
        ))}
      </HeroRows>

      <p className="px-5 py-4 text-base font-semibold">
        The last row is why there is no badge on this page.
      </p>
    </HeroPanel>
  );
}
