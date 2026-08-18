import { Badge } from '@wizeworks/silicaui-react';
import { HeroPanel } from './panel';

// /status — the glance.
//
// A status page is read in two modes and they want different things. Somebody
// whose till has stopped wants one answer in one second; somebody checking before
// signing up wants to know what is being checked and how. The list below on the
// page serves the second and served the first badly, because three rows have to
// be read and compared before the answer arrives.
//
// So the fold is the tally and the list stays the detail. It is a genuine
// summary of the same check — the counts come from the same results array the
// rows are built from, not from a second source that could disagree with them.
//
// ── IT SAYS WHAT IT CHECKED, NOT THAT EVERYTHING WORKS ──────────────────────
//
// "Answering" is the word the page uses throughout, and the figure keeps it. A
// green tile saying "Operational" would be the page's most confidently wrong
// element during a partial outage — these are liveness checks, and the caption
// says so where the number is, rather than in a note further down.

export function StatusFigure({
  answering,
  total,
  checkedAt,
}: {
  answering: number;
  total: number;
  checkedAt: Date;
}) {
  const allWell = answering === total;

  return (
    <HeroPanel>
      {/* The fill IS the answer — a colored surface reads before a word of it
          does, which is the whole job of this figure. `success` and `danger` are
          the semantic roles the rest of the platform resolves status with. */}
      <div
        className={
          allWell
            ? 'bg-success text-success-content px-6 py-8'
            : 'bg-danger text-danger-content px-6 py-8'
        }
      >
        <p className="text-6xl leading-none font-black tabular-nums">
          {answering}
          <span className="text-3xl font-bold"> of {total}</span>
        </p>
        <p className="mt-3 text-xl font-bold">
          {allWell ? 'answering right now' : 'answering — something is down'}
        </p>
      </div>

      <div className="grid gap-2 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="info" variant="soft" size="lg">
            Live check
          </Badge>
          <span className="text-base font-semibold">Nothing on this page is cached.</span>
        </div>
        <p className="text-base">
          Checked at {checkedAt.toUTCString()}. A surface that is answering has replied to a request
          just now — it is not a promise that every feature inside it works.
        </p>
      </div>
    </HeroPanel>
  );
}
