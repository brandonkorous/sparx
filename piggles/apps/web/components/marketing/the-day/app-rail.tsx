import { Icon } from '@piggles/ui';
import { appIcon, APPS } from '@piggles/config';
import type { Beat } from './beats';
import { litBy } from './clock';

/** The window's app rail: lit apps take a soft tint, the beat's own app is solid. */
export function AppRail({ beat, active }: { beat: number; active: Beat | null }) {
  const lit = litBy(beat);
  return (
    <nav
      aria-label="Apps"
      // An EXPLICIT cell on both rail and desk: auto-placement once swapped them
      // and rendered the hero into the 70px rail column.
      className="bg-base-100 border-base-300 col-start-1 row-start-3 grid grid-cols-8 justify-items-center gap-1 border-t px-2.5 py-2 lg:col-start-1 lg:row-start-2 lg:flex lg:flex-col lg:items-center lg:gap-0.5 lg:border-t-0 lg:border-r lg:px-0 lg:py-3"
    >
      {APPS.map((app) => {
        const glyph = appIcon(app.id);
        const isLit = lit.has(app.id);
        const isHot = active?.lights[0] === app.id;
        return (
          <span
            key={app.id}
            data-group={app.group}
            title={app.label}
            className={[
              'rounded-field grid size-8 place-items-center transition-colors duration-300 lg:size-10',
              isHot
                ? 'bg-module text-module-content scale-105'
                : isLit
                  ? 'bg-module bg-soft text-module'
                  : 'text-base-content/45',
            ].join(' ')}
          >
            <Icon glyph={glyph} aria-hidden className="size-4 lg:size-5" />
          </span>
        );
      })}
    </nav>
  );
}
