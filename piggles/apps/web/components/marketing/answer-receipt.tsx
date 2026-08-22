import type { PigglesGroup } from '@piggles/brand';
import { appsInGroup, APPS } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { GROUP_COPY } from './groups';

// The panel is LIVE; the total is not. Name and lines redraw on every keystroke
// and tick, so the answer never looks stale. The figure below the rule only
// moves when the button says so — and it always arrives at the same number.

/** Spelled, not numeral: a numeral here would read as a second figure. */
const WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
];

const count = (n: number) => WORDS[n] ?? String(n);
const Count = (n: number) => {
  const w = count(n);
  return w[0]!.toUpperCase() + w.slice(1);
};

/** The joke only exists if the page notices you are testing it. */
function verdict(runs: number) {
  if (runs <= 1) return 'Whatever you ticked, that is the price.';
  if (runs === 2) return `Different answer. Same ${PRICE_LABEL}.`;
  if (runs === 3) return `Still ${PRICE_LABEL}. It is going to keep saying that.`;
  return `Answer number ${runs}. Still ${PRICE_LABEL}.`;
}

const ROW = 'border-base-content/25 flex items-baseline justify-between gap-4 border-b py-3';

function Row({ label, note, group }: { label: string; note: string; group?: PigglesGroup }) {
  return (
    <li data-group={group} className={ROW}>
      <span className="text-lg font-bold">
        {label}
        <span className="ml-2 text-base font-normal">{note}</span>
      </span>
      <span className="text-lg font-bold">Included</span>
    </li>
  );
}

export function AnswerReceipt({
  name,
  picked,
  runs,
  total,
}: {
  name: string;
  picked: PigglesGroup[];
  runs: number;
  total: number;
}) {
  // Home is always on the rail, so it is never one of the others waiting.
  const onRail = picked.reduce((n, g) => n + appsInGroup(g).length, 0) + appsInGroup('home').length;
  const others = APPS.length - onRail;

  return (
    // aria-live on the region, not the figure: a reader needs the lines and the
    // number, and announcing the price alone is the one reading that means nothing.
    // `grow` so the panel fills its column and its CTA lands level with the
    // button in the column beside it.
    // A theme ISLAND, not `bg-secondary`. That utility is a navy panel only
    // because `--color-secondary` is dark in the LIGHT theme; it is #d7dbe3 in
    // the dark one, so once the site carries a theme toggle this panel went pale
    // and the `text-primary` verdict line went with it.
    <div
      aria-live="polite"
      data-theme="dark"
      className="bg-base-200 rounded-box flex grow flex-col p-6 sm:p-8"
    >
      <p className="font-heading text-3xl font-black sm:text-4xl">
        {name.trim() || 'Your business'}
        {runs > 0 ? ' is set up.' : ''}
      </p>

      <ul className="mt-7">
        {picked.map((g) => (
          <Row
            key={g}
            group={g}
            label={GROUP_COPY[g].title}
            note={`${count(appsInGroup(g).length)} apps`}
          />
        ))}

        {/* Hidden only when every group is ticked, where it would read
            "no, waiting". With none ticked it says all fifteen. */}
        {others > 0 ? (
          <Row
            label={picked.length ? 'The other apps' : 'All fifteen apps'}
            note={picked.length ? `${count(others)}, waiting` : 'nothing switched off'}
          />
        ) : null}
      </ul>

      {runs === 0 ? (
        <p className="mt-7 text-lg">
          Press <b>Add it up</b> and this works out what that answer costs.
        </p>
      ) : (
        <>
          <p className="mt-7 flex items-baseline justify-between gap-4">
            <span className="text-xl font-bold">Every month</span>
            {/* tabular-nums is load-bearing: without it the row jitters
                sideways on every frame of the count. */}
            <b className="font-heading text-5xl font-black tabular-nums sm:text-6xl">${total}</b>
          </p>

          <p className="text-primary mt-4 text-lg font-bold">{verdict(runs)}</p>

          <p className="mt-auto pt-6 text-base">
            {onRail === APPS.length
              ? 'Every app on the rail from the first morning.'
              : `${Count(onRail)} apps on your rail on the first morning. The rest are one click away, on the same bill.`}
          </p>
        </>
      )}
    </div>
  );
}
