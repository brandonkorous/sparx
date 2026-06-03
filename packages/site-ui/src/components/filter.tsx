// Filter — a single-select chip group with a reset option (docs/46 §5.2). SERVER
// component, color-bearing (the checked chip reads the role var `--c-bg`). Backed by
// radios so it submits in a form and works without JS; the reset chip clears the
// selection (empty value).

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey } from './_recipes/variants';

export interface FilterOption {
  label: React.ReactNode;
  value: string;
}

export interface FilterProps {
  /** Radio group name. */
  name: string;
  options: FilterOption[];
  /** Currently selected value (empty/undefined → reset). */
  value?: string;
  /** Checked-chip color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Label for the reset chip. Defaults to `All`. */
  resetLabel?: React.ReactNode;
  /** Accessible group label. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function Filter({
  name,
  options,
  value,
  color = 'primary',
  resetLabel = 'All',
  label,
  className,
  style,
  id,
}: FilterProps): React.ReactElement {
  const hasValue = value != null && value !== '';
  return (
    <div
      role="radiogroup"
      aria-label={label ?? 'Filter'}
      className={cx('sf-filter', colorClass(color), className)}
      style={style}
      id={id}
    >
      <label className="sf-filter__chip">
        <input
          type="radio"
          name={name}
          value=""
          defaultChecked={!hasValue}
          className="sf-filter__input"
        />
        <span className="sf-filter__chip-label">{resetLabel}</span>
      </label>
      {options.map((opt) => (
        <label className="sf-filter__chip" key={opt.value}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            defaultChecked={value === opt.value}
            className="sf-filter__input"
          />
          <span className="sf-filter__chip-label">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
Filter.displayName = 'Filter';
