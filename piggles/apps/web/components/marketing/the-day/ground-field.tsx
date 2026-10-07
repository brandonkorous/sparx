import { Icon } from '@piggles/ui';
import { appIcon, APPS } from '@piggles/config';

/** Offsets and sizes for the ground field, cycled by index. Five and three
 *  against the app count, so no two neighbors share a hue AND an offset. */
const JITTER = [
  'translate-x-1/3',
  '-translate-x-2 translate-y-4 rotate-6',
  'translate-x-8 -translate-y-3 -rotate-3',
  '-translate-x-6 translate-y-1 rotate-12',
  'translate-x-2 translate-y-6 -rotate-6',
];
const GLYPH = ['size-8', 'size-10', 'size-7'];

// The mat's texture: the app glyphs in their own hues, stating the claim before a
// word is read. Never inside the desk, which depicts the software. Absolute, so
// its extent IS the band's.
export function GroundField() {
  return (
    <div
      aria-hidden
      // 0.2: tuned for the lifted dark hues on a near-black ground.
      className="pointer-events-none absolute inset-0 hidden overflow-hidden opacity-[0.2] lg:block"
    >
      {/* `h-full` + `auto-rows-fr`: the count decides DENSITY and the container
          decides EXTENT, so the field fills a tall mat instead of running out. */}
      <div className="grid h-full auto-rows-fr grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]">
        {Array.from({ length: 120 }, (_, i) => {
          const app = APPS[i % APPS.length]!;
          const glyph = appIcon(app.id);
          return (
            <span
              key={i}
              data-group={app.group}
              // Cycled, not random: scattered yet stable across resizes. Literal
              // class strings, because Tailwind cannot see a template.
              className={`text-module grid place-items-center ${JITTER[i % JITTER.length]}`}
            >
              <Icon glyph={glyph} aria-hidden className={GLYPH[i % GLYPH.length]} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
