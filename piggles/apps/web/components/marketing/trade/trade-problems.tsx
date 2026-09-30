import { Section } from '@piggles/ui';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import type { TradeProblem } from '@/content/trades/types';

// Recognition first: what goes wrong today, in the owner's words, then the
// one sentence that turns the page toward the answer.

export function TradeProblems({ problems, turn }: { problems: TradeProblem[]; turn: string }) {
  return (
    <>
      <Section>
        <h2 className="max-w-[24ch] text-3xl font-extrabold sm:text-4xl">
          If this sounds like your week
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {problems.map((p) => (
            <Card key={p.title}>
              <CardBody>
                <h3 className="text-xl font-bold">{p.title}</h3>
                <p className="mt-2 text-base">{p.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>
      {/* The turn is the one band in the brand color: it is the pivot of the story. */}
      <Section variant="panel" className="bg-primary text-primary-content">
        <p className="max-w-[30ch] text-3xl font-extrabold sm:text-4xl lg:text-5xl">{turn}</p>
      </Section>
    </>
  );
}
