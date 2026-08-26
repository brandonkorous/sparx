'use client';

// What the broadcast says, who it goes to, and which design carries it.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { faEnvelope } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { broadcastableEmails } from './broadcasts-data';
import { peopleCount, EMAIL_DESIGNER_KEY, type ComposeBodyProps } from './broadcast-draft';

export function TheEmail({ draft, set }: ComposeBodyProps) {
  return (
    <FormSection
      title="The email"
      description="The subject is what people see in their inbox. The name is just for you, to find this later."
    >
      <Field>
        <FieldLabel>Name (only you see this)</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.name}
              placeholder="March newsletter"
              onChange={(event) => {
                set('name', event.target.value);
              }}
            />
          }
        />
      </Field>
      <Field>
        <FieldLabel>Subject line</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.subject}
              placeholder="Spring is here — 20% off everything"
              onChange={(event) => {
                set('subject', event.target.value);
              }}
            />
          }
        />
        <FieldDescription>
          Type <code>{'{{customer.greeting}}'}</code> to greet each person by name. It says “there”
          for anyone whose name you haven’t got, so the line always reads properly.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Preview text (optional)</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.preheader}
              placeholder="The one line that shows after the subject in most inboxes"
              onChange={(event) => {
                set('preheader', event.target.value);
              }}
            />
          }
        />
        <FieldDescription>
          A short line most inboxes show next to the subject. Leave it blank and the start of your
          email is used instead.
        </FieldDescription>
      </Field>
    </FormSection>
  );
}

export function WhoItGoesTo({
  draft,
  set,
  audiences,
  recipientCount,
  estimatePending,
}: ComposeBodyProps) {
  return (
    <FormSection
      title="Who it goes to"
      description="An audience is a saved group of your customers. This broadcast reaches everyone in it, apart from anyone who has unsubscribed."
    >
      {audiences.isError ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>Couldn’t load your audiences</AlertTitle>
            <AlertDescription>
              We couldn’t reach your saved audiences just now. Try refreshing in a moment.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : audiences.isSuccess && audiences.items.length === 0 ? (
        <Text className="text-sm">
          You don’t have any saved audiences yet. Audiences are built from your customer list —
          create one, then come back to send to it.
        </Text>
      ) : (
        <Field>
          <FieldLabel>Audience</FieldLabel>
          <NativeSelect
            color="module"
            value={draft.segmentId}
            aria-label="Who this broadcast goes to"
            onChange={(event) => {
              set('segmentId', event.target.value);
            }}
          >
            <option value="">Choose an audience…</option>
            {audiences.items.map((audience) => (
              <option key={audience.id} value={audience.id}>
                {audience.name}
              </option>
            ))}
          </NativeSelect>
          {draft.segmentId ? (
            <FieldDescription>
              {estimatePending
                ? 'Counting who this reaches…'
                : recipientCount === undefined
                  ? ''
                  : recipientCount === 0
                    ? 'Nobody matches this audience yet, so there is no one to send to.'
                    : `About ${peopleCount(recipientCount)} will receive this.`}
            </FieldDescription>
          ) : null}
        </Field>
      )}
    </FormSection>
  );
}

export function WhatYoureSending({
  ctx,
  draft,
  set,
  designed,
  emailUnpublished,
}: ComposeBodyProps) {
  // Only emails the owner wrote: a built-in like "Order confirmation" is sent by
  // one event and reads that event's details, so it has nothing to say to a list.
  const options = broadcastableEmails(designed.items);
  return (
    <FormSection
      title="What you’re sending"
      description="Pick one of the emails you’ve written. It has to be published — a draft design has nothing to send yet."
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
      ) : designed.isSuccess && options.length === 0 ? (
        <Text className="text-sm">
          You haven’t written an email to send yet. Use “Design emails” above to write one, publish
          it, then choose it here. The ready-made ones Piggles sends for you — order confirmations,
          reminders — aren’t offered, because each is written about one customer’s order.
        </Text>
      ) : (
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
            {options.map((email) => (
              <option key={email.id} value={email.id}>
                {email.name}
                {email.published ? '' : ' (draft — not published)'}
              </option>
            ))}
          </NativeSelect>
          {emailUnpublished ? (
            <FieldDescription>
              This design hasn’t been published yet, so it can’t be sent. Open it in the email
              designer and publish it first.
            </FieldDescription>
          ) : null}
        </Field>
      )}
    </FormSection>
  );
}
