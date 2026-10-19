'use client';

// The one time zone picker for a form: cities, searched, from the runtime that will
// read them. Built for the scheduling forms, which listed eleven raw zone names
// ("America/Denver") with no Arizona (persona issue 286).

import { useMemo } from 'react';
import { Combobox } from '@wizeworks/silicaui-react';
import { timezoneOptions, type TimezoneOption } from '../lib/timezones';

export function TimezoneSelect({
  value,
  onChange,
  follow,
  ariaLabel,
}: {
  /** The stored IANA zone, or '' for "no zone of its own" when `follow` is given. */
  value: string;
  onChange: (zone: string) => void;
  /** The words for following the business instead ('' as the value). Omit when a
   *  zone is required. */
  follow?: string;
  ariaLabel: string;
}) {
  const zones = useMemo<TimezoneOption[]>(() => {
    const list = timezoneOptions(value || null);
    return follow ? [{ value: '', label: follow, offsetMinutes: -100_000 }, ...list] : list;
  }, [value, follow]);
  const selected = zones.find((zone) => zone.value === value) ?? null;

  return (
    <Combobox
      color="module"
      items={zones}
      value={selected}
      onValueChange={(next) => {
        // Base UI hands back the ITEM; clearing gives null, which keeps the zone.
        if (next) onChange((next as TimezoneOption).value);
      }}
      placeholder="Search for your city…"
      emptyMessage="No timezone matches that city."
      aria-label={ariaLabel}
    />
  );
}
