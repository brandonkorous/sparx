import { Badge, Heading, Table, Text } from '@wizeworks/silicaui-react';
import { Band } from '../band';
import { MODULES } from '../modules-catalog';
import { money, verticalStack } from './stack';
import type { Vertical } from './registry';

/**
 * The flagship device on every industry page: the actual bill, itemized.
 *
 * Someone who runs a salon does not arrive wanting to understand a module
 * architecture. They arrive wanting to know what this costs THEM — and the
 * honest answer is different for a salon than for a restaurant, because they
 * turn on different things. Every other pricing surface on the site answers
 * "what do the modules cost"; this one answers "what does MY stack cost",
 * which is the question that was actually asked.
 *
 * It also does the comparison the reader would otherwise have to do themselves,
 * line by line: this module, instead of that named product, at that published
 * price. A total with no working shown is a claim; a total you can audit row by
 * row is an argument.
 *
 * Every figure is computed (see ./stack.ts) from the same LEDGER that prices
 * /pricing. Nothing is typed twice, so nothing can disagree.
 *
 * ## Why the totals are not module-colored
 *
 * The three figures wear the semantic palette — neutral for what it costs
 * elsewhere, Ember for the sparx price, green for what the business keeps —
 * because that is what those numbers MEAN. The page's module hue rides the
 * badges in the left column, where it identifies which module each line is.
 * Two color axes doing two different jobs, per DESIGN.md §5.
 *
 * Module hues appear only as fills (a solid badge). Several measure under
 * 2.5:1 as text on a light surface, so they identify a row and never set ink.
 */
export function StackLedger({ vertical }: { vertical: Vertical }) {
  const stack = verticalStack(vertical);

  return (
    <Band id="cost" tone="page">
      <div className="flex flex-col gap-12">
        <div className="flex max-w-3xl flex-col gap-5">
          <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
            {`What ${vertical.subject} pays`}
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="text-xl">
            {`Not a starting price with the useful parts sold separately — this is the whole bill for ` +
              `${vertical.plural}, every month, with the tools it replaces priced beside it.`}
          </Text>
        </div>

        {/* The three numbers, before the working. Someone who reads nothing else
            on this page should still leave with these. */}
        <div className="border-base-300 grid grid-cols-1 gap-8 border-y py-10 sm:grid-cols-3">
          <Figure
            value={`${money(stack.elsewhere)}/mo`}
            label={`What ${vertical.plural} typically pay across separate subscriptions.`}
          />
          <Figure
            value={`${money(stack.monthly)}/mo`}
            label="The same capabilities on sparx, on one invoice."
            tone="text-primary"
          />
          <Figure
            value={`${money(stack.savedYearly)}/yr`}
            label="Stays in the business instead."
            tone="text-success"
          />
        </div>

        <Table size="lg" className="min-w-[42rem]">
          <thead>
            <tr>
              <th scope="col">What you turn on</th>
              <th scope="col">Instead of</th>
              <th scope="col" className="text-right">
                Elsewhere
              </th>
              <th scope="col" className="text-right">
                On sparx
              </th>
            </tr>
          </thead>
          <tbody>
            {stack.lines.map((line) => (
              <tr key={line.module}>
                <td>
                  {/* `solid`, never `soft`. A soft badge paints its label in the
                      raw accent over a 15% tint of the same accent — measured
                      1.7–2.4:1 on these hues (docs/silicaui/02-core-asks.md §2). */}
                  <Badge color={`module-${line.module}`} variant="solid" size="md">
                    {line.label}
                  </Badge>
                </td>
                <td className="text-md">{line.replaces}</td>
                <td className="text-md text-right tabular-nums">{money(line.elsewhere)}</td>
                <td className="text-md text-right font-medium tabular-nums">
                  {line.bundledBy ? (
                    // A solid badge, not `text-success` on the cell. Measured,
                    // success ink on this band is 3.79:1 — fine for the 48px
                    // savings figure above (large text clears at 3.0) and under
                    // the 4.5 bar at 16px. Filling a shape and writing in the
                    // paired `-content` is how you show a semantic hue at body
                    // size, and "free because you already pay for Commerce" is
                    // genuinely state on a row, which is what Badge is for.
                    <Badge color="success" variant="solid" size="md">
                      {`Free with ${line.bundledBy}`}
                    </Badge>
                  ) : (
                    money(line.price)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2} className="text-left">
                Every month
              </th>
              <td className="text-right tabular-nums">{money(stack.elsewhere)}</td>
              {/* `text-2xl`, not `text-xl`. Ember on white measures 4.13:1 —
                  under the 4.5 bar for normal text, over the 3.0 bar for large.
                  24px is where this figure clears it, and it is the number the
                  whole table exists to produce, so the size is right anyway. */}
              <td className="text-primary text-right text-2xl font-semibold tabular-nums">
                {money(stack.monthly)}
              </td>
            </tr>
          </tfoot>
        </Table>

        <div className="flex max-w-3xl flex-col gap-4">
          <Text className="text-lg">
            {`Every module is billed on its own and can be switched off at the end of any month. ` +
              `There is no per-person charge, so the whole team can have an account, and sparx takes ` +
              `no percentage of what you sell — your card processor's normal fee is the only other cost.`}
          </Text>
          {/* Deliberately prose below the table rather than a row inside it. An
              add-on nobody in this trade needs would inflate the headline total,
              and the headline total is the promise the page is making. */}
          {vertical.alsoConsider?.length ? (
            <Text className="text-lg">
              {vertical.alsoConsider.map((extra, i) => {
                const entry = MODULES.find((m) => m.id === extra.module);
                return (
                  <span key={extra.module}>
                    {i === 0 ? 'Some add ' : ' Others add '}
                    <strong>{`${entry?.label ?? extra.module} (${money(entry?.price ?? 0)}/mo)`}</strong>
                    {` because ${extra.because}.`}
                  </span>
                );
              })}
            </Text>
          ) : null}
          <Text className="text-md">
            {`Comparison prices are the published 2026 monthly rates for the growth-tier plan of each ` +
              `named product. Those rise with seats, contacts and usage; the sparx price does not.`}
          </Text>
        </div>
      </div>
    </Band>
  );
}

/** One headline number and what it means. The label sits BELOW the figure — a
 *  label above a heading is the eyebrow this house does not build (RULE #2). */
function Figure({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className={`text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl ${tone ?? ''}`}
      >
        {value}
      </span>
      <Text className="text-md max-w-xs">{label}</Text>
    </div>
  );
}
