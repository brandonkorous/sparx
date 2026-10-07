import type { Beat } from './beats';

export function BeatCopy({ beat }: { beat: Beat }) {
  return (
    <div data-group={beat.group}>
      <span className="bg-module text-module-content inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums">
        {beat.when}
      </span>
      <h2 className="mt-4 text-[clamp(1.55rem,6.4vw,2.1rem)] leading-[1.07] font-extrabold lg:text-[clamp(1.75rem,2.7vw,2.625rem)]">
        {beat.heading}
      </h2>
      <p className="mt-3.5 text-lg">{beat.body}</p>
    </div>
  );
}
