'use client';

// One color: the picker that sets it, the words that sit on it, and the proof
// they can be read.
//
// The picker is silica's own OKLCH editor — lightness, chroma and hue, which is
// how the whole token system is expressed — so the value written back is in the
// same space as every shipped look rather than a hex that has to be converted.
//
// The sample beside it is painted with real token classes inside a theme island,
// so it is not an illustration of the color: it is a `bg-primary` element wearing
// the ink the site will use, which is exactly what a button will be.

import { ColorPicker, Input } from '@wizeworks/silicaui-react';
import { parseColor } from '@wizeworks/silicaui-html';
import { formatRatio, readContrast, recommendedInk } from './contrast';
import { useThemeEdit } from './edit-context';
import { InkRow } from './ink-row';
import { ThemeChip } from './island';
import { ResetToken } from './reset-token';
import type { ColorRole } from './tokens';

export function ColorTile({ role, extra }: { role: ColorRole; extra?: React.ReactNode }) {
  const { mode, values, own, editable, setToken } = useThemeEdit();
  const value = values[role.token];
  const reading = readContrast(role.token, value, values, role.contentToken);

  return (
    <li className="border-base-300 border-b py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <ColorValue
          label={role.label}
          value={value}
          disabled={!editable}
          onChange={(next) => setToken(role.token, next, `Set ${role.label}`)}
        />
        <p className="text-base-content min-w-0 flex-1 text-base font-medium">{role.label}</p>

        <ThemeChip mode={mode} className="shrink-0">
          <span
            className={`${role.sample} rounded-field inline-flex items-center gap-2 px-2.5 py-1.5 text-sm`}
          >
            <span className="font-semibold">Aa</span>
            {reading ? <span>{formatRatio(reading.ratio)}</span> : null}
          </span>
        </ThemeChip>

        <ResetToken token={role.token} label={role.label} />
        {extra}
      </div>

      {/* On its own line, not squeezed into a middle column: the rail is 24rem and
          a sentence sharing that row with a swatch, a chip and a button wraps to
          one word per line. */}
      <p className="text-base-content mt-1 text-sm">
        {mode === 'dark' && own[role.token] === undefined
          ? 'Same as the light version.'
          : role.hint}
      </p>

      {role.contentToken ? (
        <InkRow
          contentToken={role.contentToken}
          label={role.label}
          recommended={recommendedInk(value)}
        />
      ) : null}

      {reading?.advice ? <p className="text-warning mt-1 text-sm">{reading.advice}</p> : null}
    </li>
  );
}

/**
 * The picker — or a text box, when the stored value is something no picker can
 * represent.
 *
 * A theme installed from elsewhere can hold a `color-mix()` or a `var()`. Handing
 * that to the picker would show its fallback color and then write that fallback
 * back on the first drag, quietly replacing a value the author never touched.
 */
export function ColorValue({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (value && !parseColor(value)) {
    return (
      <Input
        key={value}
        className="w-40 shrink-0"
        defaultValue={value}
        disabled={disabled}
        aria-label={label}
        onBlur={(event) => {
          const next = event.currentTarget.value.trim();
          if (next && next !== value) onChange(next);
        }}
      />
    );
  }

  return (
    <ColorPicker
      variant="swatch"
      className="shrink-0"
      value={value ?? ''}
      disabled={disabled}
      aria-label={label}
      onValueChange={(next) => onChange(next)}
    />
  );
}
