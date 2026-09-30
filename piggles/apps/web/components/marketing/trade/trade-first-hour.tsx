import { Section } from '@piggles/ui';
import type { TradeProblem } from '@/content/trades/types';

// Getting started: how you move over from what you use now, and how small the
// first hour is. Together they answer "how much work is switching?".

export function TradeFirstHour({
  switching,
  steps,
}: {
  switching: TradeProblem[];
  steps: string[];
}) {
  return (
    <Section className="bg-base-100 border-base-300 border-y">
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">Moving over</h2>
          <div className="mt-8 grid gap-6">
            {switching.map((s) => (
              <div key={s.title}>
                <h3 className="text-xl font-bold">{s.title}</h3>
                <p className="mt-1 text-lg">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">Your first hour</h2>
          <ol className="marker:text-primary mt-8 grid list-decimal gap-4 pl-6 marker:font-bold">
            {steps.map((s) => (
              <li key={s} className="pl-2 text-lg">
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}
