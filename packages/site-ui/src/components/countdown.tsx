// Countdown — displays a time snapshot as labelled digit groups (docs/46 §5.2).
// SERVER component, structural (presentational): a live ticking timer is a client
// concern layered on top; this renders whatever unit values it's given, zero-padded
// with tabular figures. Only the units you pass are shown.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface CountdownProps {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  /** Show the unit captions. Defaults to true. */
  showLabels?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const pad = (n: number): string => String(Math.max(0, Math.floor(n))).padStart(2, '0');

export function Countdown({
  days,
  hours,
  minutes,
  seconds,
  showLabels = true,
  className,
  style,
  id,
}: CountdownProps): React.ReactElement {
  const units: { value: number; label: string }[] = [];
  if (days != null) units.push({ value: days, label: 'days' });
  if (hours != null) units.push({ value: hours, label: 'hours' });
  if (minutes != null) units.push({ value: minutes, label: 'min' });
  if (seconds != null) units.push({ value: seconds, label: 'sec' });

  return (
    <div className={cx('sf-countdown', className)} style={style} id={id}>
      {units.map((u) => (
        <div className="sf-countdown__unit" key={u.label}>
          <span className="sf-countdown__num">{pad(u.value)}</span>
          {showLabels ? <span className="sf-countdown__label">{u.label}</span> : null}
        </div>
      ))}
    </div>
  );
}
Countdown.displayName = 'Countdown';
