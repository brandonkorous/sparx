'use client';

// The two field shapes this surface repeats: a labelled text input, and the
// time zone picker.

import {
  Combobox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Text,
} from '@wizeworks/silicaui-react';

import { thisComputersTimezone } from '../lib/business-timezone';
import type { TimezoneOption } from '../lib/timezones';

/** A labelled text field. The whole surface is this shape, so it's one helper
 *  rather than fifteen near-identical Field blocks. */
export function TextField({
  label,
  value,
  onChange,
  description,
  placeholder,
  type = 'text',
  error,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  placeholder?: string;
  type?: string;
  error?: string | null;
  onBlur?: () => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <Input
            color={error ? 'error' : 'module'}
            type={type}
            value={value}
            placeholder={placeholder}
            onBlur={onBlur}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        }
      />
      {/* The error replaces the description rather than stacking under it —
          two lines of guidance under one input is where people stop reading. */}
      {error ? (
        <FieldStatus status="error">{error}</FieldStatus>
      ) : description ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
    </Field>
  );
}

/** How a zone reads to a person: the picker's own label where it has one, the
 *  IANA name otherwise. "Los Angeles — Pacific Time" beats "America/Los_Angeles"
 *  for somebody deciding whether it is right. */
function zoneLabel(zone: string, zones: TimezoneOption[]): string {
  return zones.find((option) => option.value === zone)?.label ?? zone;
}

/**
 * The clock the business runs on.
 *
 * This field used to say it was "used for dates on documents you send", which
 * sold it far short and is how it came to be left blank: it is the zone every
 * new person's working hours are read in, and with nothing saved the console
 * quietly falls back to whatever clock the CURRENT COMPUTER is set to. Halo &
 * Hem's staff came out on Pacific time because the laptop was, not because
 * anyone had recorded that the salon is in Sacramento — set it up from a hotel
 * abroad and the answer would have differed, silently (issue 151).
 *
 * So the fallback is now stated rather than hidden. Nothing is written on the
 * owner's behalf: the field stays empty, and the sentence under it says what is
 * being used in the meantime and why that is not the same as choosing.
 */
export function TimezoneField({
  value,
  zones,
  onChange,
}: {
  value: string;
  zones: TimezoneOption[];
  onChange: (value: string) => void;
}) {
  const selected = zones.find((zone) => zone.value === value) ?? null;
  return (
    <Field>
      <FieldLabel>Time zone</FieldLabel>
      <Combobox
        color="module"
        items={zones}
        value={selected}
        onValueChange={(next) => {
          // Base UI carries the ITEM, not its value. Clearing yields null; the
          // form models "unset" as an empty string, which `toPayload` turns back
          // to null at the boundary.
          onChange(next ? (next as TimezoneOption).value : '');
        }}
        placeholder="Search for your city…"
        emptyMessage="No time zone matches that city."
        aria-label="Time zone"
      />
      <FieldDescription>
        The clock your business runs on. Working hours, bookings and the dates on documents you send
        are all read in it.
      </FieldDescription>
      {value === '' ? (
        <Text className="text-warning text-sm">
          Nothing set, so times are being read as {zoneLabel(thisComputersTimezone(), zones)} —
          whatever clock the computer you are on is set to. Choose it here and it stops depending on
          the device.
        </Text>
      ) : null}
    </Field>
  );
}
