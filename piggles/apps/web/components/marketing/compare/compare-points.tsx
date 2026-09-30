import { Section } from '@piggles/ui';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import type { ComparePage, ComparePoint } from '@/content/compare';

// Their strengths first, then the sentence that turns the page, then ours.
// Leading with where they win is the whole credibility of the page: a reader
// who already uses them knows those strengths, and a page that hides them has
// told that reader it cannot be trusted on anything else.

function Points({ points }: { points: ComparePoint[] }) {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      {points.map((p) => (
        <Card key={p.title}>
          <CardBody>
            <h3 className="text-xl font-bold">{p.title}</h3>
            <p className="mt-2 text-base">{p.body}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export function ComparePoints({ page }: { page: ComparePage }) {
  return (
    <>
      <Section>
        <h2 className="max-w-[26ch] text-3xl font-extrabold sm:text-4xl">
          Where {page.name} is the better choice
        </h2>
        <p className="mt-4 max-w-[60ch] text-lg">
          {page.name} is {page.isA}. These are the things it does better than Piggles, said plainly,
          because the right answer for your business matters more than this page.
        </p>
        <Points points={page.theyWin} />
      </Section>
      {/* The turn is the one band in the brand color, as on the trade pages. */}
      <Section variant="panel" className="bg-primary text-primary-content">
        <p className="max-w-[30ch] text-3xl font-extrabold sm:text-4xl lg:text-5xl">{page.turn}</p>
      </Section>
      <Section>
        <h2 className="max-w-[26ch] text-3xl font-extrabold sm:text-4xl">
          Where Piggles fits better
        </h2>
        <Points points={page.weWin} />
      </Section>
    </>
  );
}
