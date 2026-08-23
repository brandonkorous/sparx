'use client';

// The booking window, the four quiet option rows, and the remove action — the
// tail of the service form, after the work someone actually came to change.
// Split out of service-detail.tsx (RULE #0.5).

import {
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Text,
} from '@wizeworks/silicaui-react';
import { faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { intOr, type Draft } from './service-draft';

type Setter = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

export function BookingWindow({ draft, onSet }: { draft: Draft; onSet: Setter }) {
  return (
    <FormSection title="Booking window">
      <div className="grid gap-4 @md:grid-cols-2">
        <Field>
          <FieldLabel>Least notice needed (minutes)</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                type="number"
                min={0}
                className="max-w-32 tabular-nums"
                value={String(draft.minLeadMinutes)}
                onChange={(event) => {
                  onSet('minLeadMinutes', intOr(Number(event.target.value), 0));
                }}
              />
            }
          />
          <FieldDescription>
            How far ahead a customer must book. 0 lets them book right up to the start.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>How far ahead people can book (days)</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                type="number"
                min={0}
                className="max-w-32 tabular-nums"
                value={String(draft.maxAdvanceDays)}
                onChange={(event) => {
                  onSet('maxAdvanceDays', intOr(Number(event.target.value), 365));
                }}
              />
            }
          />
          <FieldDescription>The furthest into the future a booking can be made.</FieldDescription>
        </Field>
      </div>
    </FormSection>
  );
}

function OptionRow({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <Checkbox
        color="module"
        checked={checked}
        aria-label={label}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span className="flex flex-col gap-0.5">
        <Text as="span" className="font-medium">
          {label}
        </Text>
        <Text as="span" className="text-sm">
          {hint}
        </Text>
      </span>
    </label>
  );
}

/** The quiet option rows and the remove action, after the work — never a card
 *  competing with the fields someone came to change. */
export function ServiceOptions({
  draft,
  onSet,
  canRemove,
  removing,
  onRemove,
}: {
  draft: Draft;
  onSet: Setter;
  canRemove: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="border-base-300 flex flex-col gap-4 border-t pt-4">
      <OptionRow
        checked={draft.bookableOnline}
        label="Customers can book this themselves online"
        hint="Off, only your team can add this booking — it never appears on your public booking page."
        onChange={(next) => {
          onSet('bookableOnline', next);
        }}
      />
      <OptionRow
        checked={draft.requiresApproval}
        label="You approve each booking before it is confirmed"
        hint="Bookings come in as requests for you to accept, rather than being confirmed on the spot."
        onChange={(next) => {
          onSet('requiresApproval', next);
        }}
      />
      <OptionRow
        checked={draft.requiresAsset}
        label="The customer names a specific item when booking"
        hint="For work done on a customer’s own thing — their vehicle, their bike, their instrument. They tell you which one when they book."
        onChange={(next) => {
          onSet('requiresAsset', next);
        }}
      />
      <OptionRow
        checked={draft.isActive}
        label="This service is switched on"
        hint="Switch it off to stop taking bookings for it without removing it — turn it back on any time."
        onChange={(next) => {
          onSet('isActive', next);
        }}
      />

      {canRemove ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text className="text-sm">
            Removing this service takes it off your website. Bookings already made against it are
            kept, and you can put it back from your services list.
          </Text>
          <Button size="sm" variant="outline" color="danger" disabled={removing} onClick={onRemove}>
            <Icon glyph={faTrashCan} className="size-4" aria-hidden />
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
