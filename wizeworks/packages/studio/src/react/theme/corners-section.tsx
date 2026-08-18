'use client';

// Corners, chosen by shape.
//
// `0.5rem` tells the person paying for the site nothing, so the control is the
// shape itself: each swatch IS the corner it sets, with no button chrome around it
// — a box drawn around a box is one box too many. Nothing else either: a slider
// beside it was a second control for one decision, and the row prints the value
// for anyone who wants the number.
//
// The chip on the right is not an illustration of the value: it carries
// `rounded-box` / `rounded-field` / `rounded-selector`, the very utilities every
// card and button read, so it is the same corner they will get.

import { Tooltip } from '@wizeworks/silicaui-react';
import { useThemeEdit } from './edit-context';
import { ThemeChip } from './island';
import { RailSection } from './rail-section';
import { scalarsIn, type ScalarToken } from './scalar';
import { CORNER_STEPS, RADIUS_SAMPLES, SCALAR_HINTS, SCALAR_LABELS } from './tokens';

export function CornersSection() {
  return (
    <RailSection
      icon="box"
      title="Corners"
      hint="How round everything is — square and formal, or soft and friendly."
    >
      {scalarsIn('radius').map((token) => (
        <CornerRow key={token.key} token={token} />
      ))}
    </RailSection>
  );
}

function CornerRow({ token }: { token: ScalarToken }) {
  const { mode, values, editable, setToken } = useThemeEdit();
  const current = values[token.key] ?? token.default;
  const name = SCALAR_LABELS[token.key] ?? token.label;
  const shape = RADIUS_SAMPLES[token.key] ?? 'rounded-field';

  return (
    <div className="border-base-300 mb-4 border-b pb-4 last:mb-0 last:border-b-0 last:pb-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-base-content text-base font-medium">{name}</span>
        <span className="text-base-content text-sm">{current}</span>
      </div>
      <p className="text-base-content mb-2 text-sm">{SCALAR_HINTS[token.key]}</p>

      <div className="flex items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {CORNER_STEPS.map((step) => (
            <Tooltip key={step.value} content={step.label}>
              <button
                type="button"
                disabled={!editable}
                aria-label={`${name}: ${step.label}`}
                aria-pressed={current === step.value}
                className="focus-visible:outline-primary rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => setToken(token.key, step.value, `Set ${name}`)}
              >
                {/* The shape IS the control — no button chrome around it. A hairline
                    in the theme's ink so the corner is legible against the surface it
                    sits on, and the fill carries selection, which is what a filled
                    shape is for. `block` is load-bearing: `size-7` is width and
                    height, which an inline element ignores. */}
                <span
                  className={`${step.shape} border-base-content block size-7 border ${
                    current === step.value ? 'bg-primary' : 'bg-base-300'
                  }`}
                  aria-hidden
                />
              </button>
            </Tooltip>
          ))}
        </div>

        {/* The live shape, drawn by the same token the ladder writes. */}
        <ThemeChip mode={mode} className="ml-auto">
          <span className={`${shape} bg-primary block size-8`} aria-hidden />
        </ThemeChip>
      </div>
    </div>
  );
}
