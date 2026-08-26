'use client';

// What the broadcast will look like when it arrives, who it comes from, and
// when it goes.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { faEnvelope, faGear } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { productCopy } from '../../lib/product';
import { senderDisplay } from './broadcasts-presentation';
import { BroadcastPreview } from './broadcast-preview';
import { formatList, soonLocalValue, SETTINGS_KEY, type ComposeBodyProps } from './broadcast-draft';

export function WhatItLooksLike({ savedId, dirty }: ComposeBodyProps) {
  return (
    <FormSection
      title="What it looks like"
      description="Exactly what lands in your customer’s inbox, shown for one real person out of your audience."
    >
      {dirty && savedId ? (
        <Text className="text-sm">
          You’ve made changes since this was last saved. Save the draft to see them here.
        </Text>
      ) : null}
      <BroadcastPreview id={savedId ?? 'new'} enabled={savedId !== null} />
    </FormSection>
  );
}

export function WhereItComesFrom({ ctx, settings, settingsPending }: ComposeBodyProps) {
  return (
    <FormSection
      title="The address it comes from"
      description="This is who your broadcast appears to be from. It’s the same for every email you send from this site."
      action={
        <Button
          size="sm"
          onClick={() => {
            ctx.open(SETTINGS_KEY, {}, { target: 'beside' });
          }}
        >
          <Icon glyph={faGear} className="size-4" aria-hidden />
          Change
        </Button>
      }
    >
      <div className="border-base-300 flex items-center gap-3 rounded-lg border p-3">
        <Icon glyph={faEnvelope} className="size-5 shrink-0" aria-hidden />
        <Text className="min-w-0 font-medium break-all">
          {settingsPending ? 'Loading…' : senderDisplay(settings)}
        </Text>
      </div>
    </FormSection>
  );
}

export function WhenToSend({
  timing,
  setTiming,
  scheduledAt,
  setScheduledAt,
  scheduleValid,
  missing,
}: ComposeBodyProps) {
  return (
    <FormSection
      title="When to send"
      description={productCopy(
        'email.broadcast.scheduleHint',
        'Send it straight away, or pick a date and time and Piggles will send it for you.'
      )}
    >
      <Field>
        <FieldLabel>Timing</FieldLabel>
        <NativeSelect
          color="module"
          className="max-w-xs"
          value={timing}
          aria-label="When to send this broadcast"
          onChange={(event) => {
            const next = event.target.value as 'now' | 'schedule';
            setTiming(next);
            if (next === 'schedule' && scheduledAt === '') setScheduledAt(soonLocalValue());
          }}
        >
          <option value="now">Send as soon as I press Send</option>
          <option value="schedule">Schedule for a specific time</option>
        </NativeSelect>
      </Field>

      {timing === 'schedule' ? (
        <Field>
          <FieldLabel>Date and time</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                type="datetime-local"
                className="max-w-xs"
                value={scheduledAt}
                min={soonLocalValue()}
                onChange={(event) => {
                  setScheduledAt(event.target.value);
                }}
              />
            }
          />
          {scheduledAt !== '' && !scheduleValid ? (
            <FieldDescription>Pick a time in the future.</FieldDescription>
          ) : (
            <FieldDescription>Uses your own time zone.</FieldDescription>
          )}
        </Field>
      ) : null}

      {missing.length > 0 ? (
        <Text className="text-sm">
          Before you can send, this still needs {formatList(missing)}.
        </Text>
      ) : null}
    </FormSection>
  );
}
