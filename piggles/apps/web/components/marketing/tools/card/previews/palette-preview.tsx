import { harmony, parseHex, ramp, RAMP_STEPS, toHex } from '../../lib/color';

/** Real output: a triadic set off the brand pink, and one colour's full ramp. */
const BASE = parseHex('#FF6F86')!;
const SWATCHES = harmony(BASE, 'triadic').map(toHex);
const RAMP = RAMP_STEPS.map((step) => ramp(BASE)[step]);

/** Colours computed by the tool have no token — the inline paint is the artefact
 * itself, exactly as in the palette maker. */
export function PalettePreview() {
  return (
    // `w-full` is load-bearing: the well centres its child, so without a width
    // the flex-1 swatches collapse to nothing.
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex gap-1.5">
        {SWATCHES.map((hex) => (
          <span key={hex} className="rounded-field h-14 flex-1" style={{ backgroundColor: hex }} />
        ))}
      </div>
      <div className="rounded-field flex overflow-hidden">
        {RAMP.map((hex) => (
          <span key={hex} className="h-4 flex-1" style={{ backgroundColor: hex }} />
        ))}
      </div>
    </div>
  );
}
