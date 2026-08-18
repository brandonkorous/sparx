import { HeroPanel, HeroRow, HeroRows } from './panel';

// /how-it-works — the whole thing on a clock.
//
// The page already shows the signup form in full a screen down ("This is the
// entire form"), so the hero must not show it again — a shorter copy of the
// depiction below it is the homepage mistake this site's own notes describe,
// where one screen got drawn twice and the page ended up arguing with itself.
//
// What is missing instead is the SHAPE: four things happen, and the surprising
// part is how little time the first two take. So the figure is the sequence with
// its timings, which is also the page's table of contents.
//
// ── TIMINGS, NOT STEP NUMBERS ───────────────────────────────────────────────
//
// A `01 / 02 / 03` rail is banned (root RULE #2), and rightly — a step number is
// an eyebrow that has learned to stand to the left. The right-hand column here
// is information a reader actually wants and cannot get anywhere else on the
// page, and the sequence is carried by the words. Nothing is numbered.
//
// Every line is something the account app genuinely does today, held to the same
// standard as the rest of this page: if a step changes there, this is wrong until
// it is edited.

const STEPS = [
  {
    what: 'You answer two questions',
    detail: 'What the business is called, and what you want to start with',
    when: '30 seconds',
  },
  {
    what: 'Your workspace opens, already set up',
    detail: 'Tax, postage, invoice numbering and a pipeline, filled in for where you are',
    when: 'Straight away',
  },
  {
    what: 'Your website is live',
    detail: 'A real site with your name on it, on a Piggles address, with pages you can edit',
    when: 'Day one',
  },
  {
    what: 'You decide whether to carry on',
    detail: 'Everything you built during the trial stays yours either way',
    when: 'Day fourteen',
  },
];

export function StepsFigure() {
  return (
    <HeroPanel>
      <div className="border-base-300 border-b px-5 py-3.5">
        <b className="text-base font-bold">Getting started, end to end</b>
      </div>

      <HeroRows>
        {STEPS.map((step) => (
          <HeroRow
            key={step.what}
            label={step.what}
            sub={step.detail}
            right={<span className="text-base font-bold whitespace-nowrap">{step.when}</span>}
          />
        ))}
      </HeroRows>

      <p className="px-5 py-4 text-base font-semibold">
        No card at any point, and nobody rings you.
      </p>
    </HeroPanel>
  );
}
