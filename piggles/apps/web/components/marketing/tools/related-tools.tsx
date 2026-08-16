import Link from 'next/link';
import { relatedTools, toolGroup } from './registry';

/**
 * The other tools, at the foot of one.
 *
 * ── A LIST OF NAMES, NOT SIX MORE CARDS ─────────────────────────────────────
 *
 * This was a grid of six bordered boxes with icon chips, directly above the
 * closing band — so every tool page ended with two heavy blocks stacked on each
 * other and the last thing anybody saw was a wall of identical furniture.
 *
 * It is a "you might also want" list. It should be light. So it is names, laid
 * out to wrap, each one carrying ITS OWN group colour on hover — which is the
 * one place on a tool page where several of the six hues appear at once, and
 * therefore the place the colour system is legible as a system rather than as
 * this page's paint.
 *
 * Same-group tools come first (see `relatedTools`), so the nearest neighbours
 * are the ones under the pointer first.
 */
export function RelatedTools({ currentSlug }: { currentSlug: string }) {
  const tools = relatedTools(currentSlug, 8);
  if (tools.length === 0) return null;

  return (
    <section className="px-6 pb-4">
      <div className="mx-auto max-w-7xl">
        <div className="border-base-300 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t pt-10">
          <h2 className="text-xl font-extrabold">While you are here</h2>
          <Link href="/tools" className="text-base font-semibold underline underline-offset-4">
            Every free tool
          </Link>
        </div>

        <ul className="mt-6 flex flex-wrap gap-2">
          {tools.map((tool) => (
            <li key={tool.slug} data-group={toolGroup(tool)}>
              <Link
                href={`/tools/${tool.slug}`}
                className="border-base-300 hover:border-module hover:bg-module hover:text-module-content focus-visible:border-module focus-visible:bg-module focus-visible:text-module-content rounded-selector inline-block border px-4 py-2.5 text-base font-semibold transition-colors duration-200 outline-none motion-reduce:transition-none"
              >
                {tool.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
