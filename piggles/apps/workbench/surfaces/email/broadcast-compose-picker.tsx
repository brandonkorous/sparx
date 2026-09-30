'use client';

// Which designed email carries the broadcast. Only emails the owner wrote are
// offered; the ready-made ones Piggles sends by itself are refused by the server
// too (`assertBroadcastableEmail`).

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { faEnvelope } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { broadcastableEmails, type DesignedEmail } from './broadcasts-data';
import { EMAIL_DESIGNER_KEY, type ComposeBodyProps } from './broadcast-draft';

export function WhatYoureSending(props: ComposeBodyProps) {
  const { ctx, designed, emailBuiltIn } = props;
  // Only emails the owner wrote: a built-in like "Order confirmation" is sent by
  // one event and reads that event's details, so it has nothing to say to a list.
  const options = broadcastableEmails(designed.items);
  return (
    <FormSection
      title="What you’re sending"
      description="Pick one of the emails you’ve written. It has to be published: a draft design has nothing to send yet."
      action={
        <Button
          size="sm"
          onClick={() => {
            ctx.open(EMAIL_DESIGNER_KEY, {}, { target: 'beside' });
          }}
        >
          <Icon glyph={faEnvelope} className="size-4" aria-hidden />
          Design emails
        </Button>
      }
    >
      {designed.isError ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>Couldn’t load your designed emails</AlertTitle>
            <AlertDescription>
              We couldn’t reach your email designs just now. Try refreshing in a moment.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : designed.isSuccess && options.length === 0 && !emailBuiltIn ? (
        <Text className="text-sm">
          You haven’t written an email to send yet. Use “Design emails” above to write one, publish
          it, then choose it here. The ready-made ones Piggles sends for you (order confirmations,
          reminders) aren’t offered: each goes out by itself, to one customer at a time, about their
          own order.
        </Text>
      ) : (
        <DesignedEmailField {...props} options={options} />
      )}
    </FormSection>
  );
}

/** The picker itself. A draft saved before ready-made emails were filtered out
 *  can still point at one; it is shown, disabled and explained, rather than the
 *  select reading "Choose an email…" while the draft still holds "Payment failed". */
function DesignedEmailField({
  draft,
  set,
  designed,
  emailUnpublished,
  emailBuiltIn,
  options,
}: ComposeBodyProps & { options: DesignedEmail[] }) {
  const chosen = emailBuiltIn
    ? designed.items.find((email) => email.id === draft.builderEmailId)
    : undefined;
  return (
    <Field>
      <FieldLabel>Designed email</FieldLabel>
      <NativeSelect
        color="module"
        value={draft.builderEmailId}
        aria-label="Which designed email to send"
        onChange={(event) => {
          set('builderEmailId', event.target.value);
        }}
      >
        <option value="">Choose an email…</option>
        {chosen ? (
          <option value={chosen.id} disabled>
            {chosen.name} (goes out by itself, can’t go to a list)
          </option>
        ) : null}
        {options.map((email) => (
          <option key={email.id} value={email.id}>
            {email.name}
            {email.published ? '' : ' (draft, not published)'}
          </option>
        ))}
      </NativeSelect>
      {chosen ? (
        <FieldDescription>
          “{chosen.name}” is one Piggles sends by itself, to one customer at a time, when something
          happens to them. It’s written about that one moment, so it can’t go to your whole
          audience. Choose an email you wrote instead.
        </FieldDescription>
      ) : null}
      {emailUnpublished ? (
        <FieldDescription>
          This design hasn’t been published yet, so it can’t be sent. Open it in the email designer
          and publish it first.
        </FieldDescription>
      ) : null}
    </Field>
  );
}
