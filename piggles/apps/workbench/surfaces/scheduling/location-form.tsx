'use client';

// What a place is called, what clock it runs on, and whether it is still in use.
//
// The time zone field is the reason this is worth reading. It used to be a
// picker sitting on `UTC` under a sentence saying "The zone this place is in" —
// an assertion nobody had made, on a screen most people never open. Once a
// booking started following its place (issue 108) that unmade decision set the
// hour of every appointment (issue 178). So the first option is now "same as
// your business", it is the default, and when the business has no zone either
// the field says so and names the screen that fixes it.

import {
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { thisComputersTimezone } from '../../lib/business-timezone';
import { zoneCity, type TimezoneOption } from '../../lib/timezones';
import { followLabel, type Draft } from './location-draft';
import type { BusinessLocation } from './setup-data';

type SetField = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

/** Both ends of the chain are empty, so times here are read off whatever
 *  computer is open. The remedy is on another screen, so it gets named. */
function NoZoneAnywhere() {
  return (
    <Text className="text-warning text-sm">
      Your business has no time zone set either, so times here are being read as{' '}
      {zoneCity(thisComputersTimezone())}: whatever clock the computer you are on is set to. Set it
      once in Settings &rsaquo; Business details and this place follows it.
    </Text>
  );
}

function TimezoneField({
  draft,
  set,
  zones,
  businessZone,
}: {
  draft: Draft;
  set: SetField;
  zones: TimezoneOption[];
  businessZone: string | null | undefined;
}) {
  return (
    <Field>
      <FieldLabel>Time zone</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            value={draft.timezone}
            onChange={(event) => {
              set('timezone', event.target.value);
            }}
          >
            {/* First, and the default, because for most businesses it is the
                true answer: one shop, one clock, set in one place. */}
            <option value="">{followLabel(businessZone)}</option>
            {zones.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </NativeSelect>
        }
      />
      <FieldDescription>
        The zone this place is in. Each person&rsquo;s working hours are read in their own zone, so
        this is what a customer is shown. Set one here only if this place is somewhere other than
        your business.
      </FieldDescription>
      {draft.timezone === '' && businessZone === null ? <NoZoneAnywhere /> : null}
    </Field>
  );
}

export function LocationNameSection({
  draft,
  set,
  zones,
  businessZone,
  isNew,
}: {
  draft: Draft;
  set: SetField;
  zones: TimezoneOption[];
  businessZone: string | null | undefined;
  isNew: boolean;
}) {
  return (
    <FormSection
      title={isNew ? 'The new place' : 'What it is called'}
      description={
        isNew
          ? 'Name the premises you serve customers from. Your people, services and bookings are each filed against one.'
          : undefined
      }
    >
      <Field>
        <FieldLabel>Name</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.name}
              placeholder="High Street shop"
              onChange={(event) => {
                set('name', event.target.value);
              }}
            />
          }
        />
        {draft.name.trim() !== '' ? (
          <FieldDescription>What your team calls it.</FieldDescription>
        ) : (
          <FieldStatus status="error">Give the place a name.</FieldStatus>
        )}
      </Field>

      <TimezoneField draft={draft} set={set} zones={zones} businessZone={businessZone} />
    </FormSection>
  );
}

/** Removal is refused outright while bookings point here, so the reason is said
 *  BEFORE the button is reached for rather than after it is pressed. */
function RemoveRow({
  bookings,
  removing,
  onRemove,
}: {
  bookings: number;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Text className="text-sm">
        {bookings > 0
          ? `This place is on ${String(bookings)} booking${bookings === 1 ? '' : 's'}, so it cannot be removed — switch it off above instead.`
          : 'Removing takes this place off your list for good.'}
      </Text>
      <Button
        color="danger"
        variant="soft"
        size="sm"
        disabled={bookings > 0 || removing}
        loading={removing}
        onClick={onRemove}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
        Remove
      </Button>
    </div>
  );
}

/**
 * Retiring a place, and removing one.
 *
 * Two different things kept together because they are the same decision at two
 * strengths, and because the one that is reversible has to be visible at the
 * moment somebody reaches for the one that is not.
 */
export function LocationRetireSection({
  draft,
  set,
  existing,
  removing,
  onRemove,
}: {
  draft: Draft;
  set: SetField;
  existing: BusinessLocation | null;
  removing: boolean;
  onRemove: () => void;
}) {
  const bookings = existing?.counts.bookings ?? 0;
  return (
    <div className="border-base-300 flex flex-col gap-4 border-t pt-4">
      <label className="flex items-start gap-3">
        <Checkbox
          color="module"
          checked={draft.isActive}
          aria-label="This place is in use"
          onChange={(event) => {
            set('isActive', event.target.checked);
          }}
        />
        <span className="flex flex-col gap-0.5">
          <Text as="span" className="font-medium">
            This place is in use
          </Text>
          <Text as="span" className="text-sm">
            Switch it off to retire a place you no longer serve from. Everything already booked
            there keeps its history.
          </Text>
        </span>
      </label>

      {existing ? <RemoveRow bookings={bookings} removing={removing} onRemove={onRemove} /> : null}
    </div>
  );
}
