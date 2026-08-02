import { Heading, Text } from '@wizeworks/silicaui-react';
import { SCENARIOS } from '../pricing/data';
import { Band } from '../band';
import { PartnersEarnings, type StackOption } from './earnings';

/**
 * Server shell for the earnings ledger.
 *
 * Its whole job is the join the old page never made: commission rates (docs/114
 * §B.4) against real stack prices, which live in `pricing/data.ts` — the single
 * source for every pricing surface on the site. The client component must not
 * import that module directly; it would drag its lucide icon imports into the
 * browser bundle for four numbers. So the parse happens here and crosses the
 * boundary as plain data.
 *
 * Parsing rather than re-typing the figures is the point. A hand-copied $186 in
 * this file is a number that silently goes stale the first time a module price
 * moves, and the partner page would then quote earnings against a stack that no
 * longer costs that.
 */

/** `"$186/mo"` / `"$1,002/mo"` → `186` / `1002`. */
function dollars(s: string): number {
  return Number(s.replace(/[^0-9.]/g, ''));
}

const STACKS: StackOption[] = SCENARIOS.map((s) => ({
  key: s.title,
  label: s.title,
  sub: s.sub,
  monthly: dollars(s.sparx),
  elsewhere: dollars(s.separate),
}));

export function PartnersEarningsBand() {
  return (
    <Band id="earnings" tone="page">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
            What this is actually worth
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="max-w-3xl">
            Percentages are easy to publish and impossible to act on. Set it to the work you
            actually do and the page will do the arithmetic — both halves of it, yours and your
            client&rsquo;s.
          </Text>
        </div>

        <PartnersEarnings stacks={STACKS} />
      </div>
    </Band>
  );
}
