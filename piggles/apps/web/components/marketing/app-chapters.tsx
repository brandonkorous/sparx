import { Section } from '@piggles/ui';
import { badgeClasses } from '@wizeworks/silicaui-react/server';
import type { AppChapter } from '@/content/apps';

// The parts of an app, for the apps too big to describe in six bullets.
//
// ── WHY THESE ARE NOT MORE CARDS ────────────────────────────────────────────
//
// "What {app} does" above is already a grid of cards, and the obvious way to
// render chapters is more of them. Fifty cards down one page is a wall: every
// item gets the same weight, so nothing has any, and a reader scanning for the
// one thing they came for has no shape to navigate by.
//
// So a chapter is a BAND with a real heading and a paragraph, and its claims are
// plain text in two columns. The cards above stay the summary; these read as
// prose, which is what they are. Alternating the surface separates consecutive
// chapters without a divider — Piggles has elevation and edges for that, and a
// decorative rule is banned outright (root CLAUDE.md RULE #2).
//
// Headings are `h2`, siblings of "What {app} does" rather than children of it.
// Nothing sits above them: the heading carries itself (RULE #2 again), which is
// why a chapter has no kicker, no number and no category label.

/**
 * The named services a chapter connects to, as a sentence with the names in it.
 *
 * Deliberately the same shape as the "Most software calls this…" block at the
 * top of the page: a line of prose, then the terms. A bare row of badges under a
 * one-word label is an eyebrow with components on it, and it also throws away
 * the only sentence that makes the list mean anything.
 *
 * The names are the point. A page that says "post to social" and never says
 * Instagram reads, correctly, as a product that has not built it — see the
 * accuracy rule on `connects` in content/apps/types.ts, which is stricter than
 * the one governing the prose around it.
 */
function Connects({ names }: { names: string[] }) {
  return (
    <div className="border-base-300 mt-10 flex flex-wrap items-baseline gap-x-4 gap-y-3 border-t pt-8">
      <p className="text-lg font-bold">Connects to</p>
      <ul className="flex flex-wrap gap-2">
        {names.map((name) => (
          <li key={name} className={badgeClasses({ color: 'module', variant: 'soft' })}>
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chapter({ chapter, inset }: { chapter: AppChapter; inset: boolean }) {
  return (
    // Every chapter carries a bottom edge, inset or not. The alternating surface
    // does the rhythm; the edge is what makes the LAST chapter separate from
    // whatever the page puts after it, whichever surface that lands on — so the
    // page never has to know how many chapters an app happened to have.
    <Section
      className={inset ? 'bg-base-100 border-base-300 border-y' : 'border-base-300 border-b'}
    >
      <div className="rise grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="max-w-[46ch]">
          <h2 className="text-3xl font-extrabold sm:text-4xl">{chapter.heading}</h2>
          <p className="mt-6 text-lg">{chapter.body}</p>
        </div>

        {/* Two columns of claims rather than three: these are sentences, and a
            third column takes them below a comfortable measure on a laptop. */}
        <dl className="stagger grid content-start gap-x-10 gap-y-7 sm:grid-cols-2">
          {chapter.does.map((claim) => (
            <div key={claim.title}>
              <dt className="ink-module text-lg font-bold">{claim.title}</dt>
              <dd className="mt-1 text-base">{claim.body}</dd>
            </div>
          ))}
        </dl>
      </div>

      {chapter.connects ? <Connects names={chapter.connects} /> : null}
    </Section>
  );
}

/**
 * Every chapter of one app, alternating surface so consecutive ones separate.
 *
 * Renders nothing for an app without chapters, which is most of them — six
 * bullets genuinely cover Invoices and Bookings, and giving every page chapters
 * so the pages all match would undo the reason these exist.
 *
 * The first chapter is always the PLAIN surface, because the section it follows
 * ("What {app} does") is the inset one.
 */
export function AppChapters({ chapters }: { chapters?: AppChapter[] }) {
  if (!chapters?.length) return null;

  return (
    <>
      {chapters.map((chapter, i) => (
        <Chapter key={chapter.heading} chapter={chapter} inset={i % 2 === 1} />
      ))}
    </>
  );
}
