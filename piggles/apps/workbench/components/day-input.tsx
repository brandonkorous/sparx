'use client';

// THE calendar-day field. Anywhere a person types a date, this is what they
// type into.
//
// A native date box is three cells — day, month, year — and it reports a value
// only when ALL THREE hold something. Half fill it in and `value` is the empty
// string while the box on screen still shows the digits that were typed. Every
// form in both consoles read that empty string as "they left it blank": an
// optional date was dropped without a word, and a required one left Save
// disabled with nothing on screen saying why.
//
// Measured on 2026-09-19 by typing a date into the wholesale price pane and
// asking the box what it thought: `value: ""`, `validity.badInput: true`. There
// were 82 `<Input type="date">` call sites across the two consoles and not one
// of them asked. Measured again on 2026-09-22 on the invoice due date, where
// Save stays disabled while the footer says "Saved just now". Issue 741.
// [[feedback_the_empty_control_is_the_untested_one]]
//
// THE WARNING LIVES HERE, NOT AT THE CALL SITE. The box is the only thing that
// knows it is half typed, and there are eighty of them. Eighty copies of one
// `useState` and one sentence is eighty places the wording can drift and eighty
// places the next person forgets — a call-site patch is a deferred fix.
// [[feedback_silicaui_single_point_of_change]] So the sentence is rendered from
// here and every box gets it by being this component.
//
// It ALSO reports both halves to the caller: `onValueChange(value, incomplete)`.
// A caller that ignores the second argument still shows the warning, because
// this draws it; a caller that reads it can additionally refuse to save, which
// is what a form with its own required-date rule wants so the person is not
// told two things at once. [[feedback_one_outcome_two_causes]]

import { FieldStatus, Input } from '@wizeworks/silicaui-react';
import { useState, type ComponentProps } from 'react';
import { HALF_A_DAY, storedDayText } from '../lib/today';

type InputProps = ComponentProps<typeof Input>;

export interface DayInputProps extends Omit<InputProps, 'type' | 'value' | 'onChange'> {
  /** `YYYY-MM-DD`, or the empty string. A full timestamp is shown as its day. */
  value: string;
  /**
   * The day, and whether the box is half typed.
   *
   * `incomplete` is true exactly when the control is holding digits it refuses
   * to turn into a date, which is the one state its `value` cannot express.
   */
  onValueChange: (value: string, incomplete: boolean) => void;
  /**
   * Set false where the surface draws `HALF_A_DAY` itself and two copies would
   * appear. The box still reports `incomplete`, so the surface is saying the
   * same thing in its own slot rather than saying nothing.
   */
  sayWhenUnfinished?: boolean;
}

export function DayInput({
  value,
  onValueChange,
  sayWhenUnfinished = true,
  color,
  onBlur,
  ...rest
}: DayInputProps) {
  const [unfinished, setUnfinished] = useState(false);

  // A form handed a stored timestamp showed its saved day as empty, and the
  // next save sent the empty box back over it (issue 911). Reading the day
  // HERE covers every form at once. See `storedDayText`.
  const shown = storedDayText(value);

  const report = (target: HTMLInputElement) => {
    const incomplete = target.validity.badInput;
    setUnfinished(incomplete);
    onValueChange(target.value, incomplete);
  };

  return (
    <div className="flex min-w-0 flex-col">
      <Input
        {...rest}
        type="date"
        value={shown}
        color={unfinished ? 'error' : color}
        onChange={(event) => {
          report(event.target);
        }}
        onBlur={(event) => {
          // Leaving a half-typed box does not clear it, so the state has to
          // survive the blur too — otherwise a person tabs away and the warning
          // they were shown disappears while the digits stay on screen.
          report(event.target);
          onBlur?.(event);
        }}
      />
      {unfinished && sayWhenUnfinished ? (
        <FieldStatus status="error" attached={false}>
          {HALF_A_DAY}
        </FieldStatus>
      ) : null}
    </div>
  );
}
