import { Icon } from '@piggles/ui';
import { Badge } from '@wizeworks/silicaui-react';
import { appIcon } from '@piggles/config';
import type { Beat, Row } from './beats';

export type WindowState = 'ghost' | 'on' | 'hot';

/** A window not reached yet is a ghost outline; the current one is hot. */
export const windowState = (beat: number, i: number): WindowState =>
  beat === i + 1 ? 'hot' : beat > i ? 'on' : 'ghost';

function WindowRows({ rows }: { rows: Row[] }) {
  return (
    <div className="grid gap-2 px-3.5 pt-3 pb-4">
      {rows.map((row, i) => (
        <div key={row.label}>
          {i > 0 && <div className="bg-base-300 mb-2 h-px" />}
          <div className="flex items-center justify-between gap-2.5">
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-sm font-semibold">{row.label}</b>
              <span className="text-sm">{row.sub}</span>
            </span>
            {row.badge && (
              <Badge color={row.badge.tone} variant="soft">
                {row.badge.text}
              </Badge>
            )}
            {row.figure && (
              <span className="ink-module font-heading text-3xl font-extrabold tabular-nums">
                {row.figure}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DeskWindow({ beat, state }: { beat: Beat; state: WindowState }) {
  const glyph = appIcon(beat.lights[0]!);
  return (
    <div
      data-group={beat.group}
      className={[
        'rounded-box overflow-hidden transition-[background-color,border-color,box-shadow,opacity] duration-300',
        state === 'ghost'
          ? 'border-base-300 border-[1.5px] border-dashed bg-transparent'
          : 'bg-base-100 border-base-300 border',
        state === 'hot' && 'border-module ring-module z-40 ring-1',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={`border-base-300 flex items-center gap-2.5 border-b px-3.5 py-2.5 text-sm font-semibold transition-opacity duration-300 ${
          state === 'ghost' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="bg-module text-module-content grid size-5 place-items-center rounded-md">
          <Icon glyph={glyph} aria-hidden className="size-3" />
        </span>
        {beat.window.title}
      </div>
      <div className={`transition-opacity duration-300 ${state === 'ghost' ? 'opacity-0' : ''}`}>
        <WindowRows rows={beat.window.rows} />
      </div>
    </div>
  );
}
