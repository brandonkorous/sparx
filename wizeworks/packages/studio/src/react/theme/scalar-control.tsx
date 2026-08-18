'use client';

// One non-color token, as whatever control its own numbers describe.
//
// silica ships each token's range, step and unit, so the control is chosen from
// the data rather than from a list here: a 0–1 token that steps by 1 is a switch,
// a token with `options` is a menu, everything else is a slider. That is what
// keeps this pane covering the whole theme when silica gains a token.

import {
  Field,
  FieldDescription,
  FieldLabel,
  NativeSelect,
  Slider,
  Switch,
} from '@wizeworks/silicaui-react';
import { useThemeEdit } from './edit-context';
import { isSwitchToken, scalarNumber, scalarValue, type ScalarToken } from './scalar';
import { SCALAR_HINTS, SCALAR_LABELS } from './tokens';

export function ScalarControl({ token }: { token: ScalarToken }) {
  if (token.options) return <TokenSelect token={token} />;
  if (isSwitchToken(token)) return <TokenSwitch token={token} />;
  return <TokenSlider token={token} />;
}

function label(token: ScalarToken): string {
  return SCALAR_LABELS[token.key] ?? token.label;
}

/** Ours where we have one; silica's developer prose only for a token we have
 *  never seen, which is better than a control with nothing said about it. */
function hint(token: ScalarToken): string {
  return SCALAR_HINTS[token.key] ?? token.doc;
}

function TokenSlider({ token }: { token: ScalarToken }) {
  const { values, editable, setToken } = useThemeEdit();
  const current = scalarNumber(token, values[token.key]);

  return (
    <Field className="mb-4">
      <FieldLabel className="flex items-baseline justify-between gap-2">
        <span className="text-base">{label(token)}</span>
        <span className="text-base-content text-sm">{scalarValue(token, current)}</span>
      </FieldLabel>
      <Slider
        color="primary"
        min={token.min}
        max={token.max}
        step={token.step}
        value={current}
        disabled={!editable}
        showValue={false}
        aria-label={label(token)}
        onValueChange={(next) =>
          setToken(
            token.key,
            scalarValue(token, typeof next === 'number' ? next : (next[0] ?? current)),
            `Set ${label(token)}`
          )
        }
      />
      <FieldDescription>{hint(token)}</FieldDescription>
    </Field>
  );
}

function TokenSwitch({ token }: { token: ScalarToken }) {
  const { values, editable, setToken } = useThemeEdit();
  const on = scalarNumber(token, values[token.key]) >= 1;

  return (
    <Field className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel className="text-base">{label(token)}</FieldLabel>
        <Switch
          color="primary"
          checked={on}
          disabled={!editable}
          aria-label={label(token)}
          onCheckedChange={(next) =>
            setToken(
              token.key,
              next ? '1' : '0',
              `${next ? 'Turn on' : 'Turn off'} ${label(token)}`
            )
          }
        />
      </div>
      <FieldDescription>{hint(token)}</FieldDescription>
    </Field>
  );
}

function TokenSelect({ token }: { token: ScalarToken }) {
  const { values, editable, setToken } = useThemeEdit();
  const current = values[token.key] ?? token.default;

  return (
    <Field className="mb-4">
      <FieldLabel className="text-base">{label(token)}</FieldLabel>
      <NativeSelect
        value={current}
        disabled={!editable}
        aria-label={label(token)}
        onChange={(event) => setToken(token.key, event.currentTarget.value, `Set ${label(token)}`)}
      >
        {token.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      <FieldDescription>{hint(token)}</FieldDescription>
    </Field>
  );
}
