'use client';

// What the broadcast says and who it goes to. Which design carries it is
// broadcast-compose-picker.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import type { ReactNode } from 'react';
import { FormSection } from '../../components/form-section';
import { peopleCount, type ComposeBodyProps } from './broadcast-draft';

/** One labelled text box on the draft, with an optional line under it. */
function DraftTextField({
  label,
  value,
  placeholder,
  onChange,
  children,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
  children?: ReactNode;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={value}
            placeholder={placeholder}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        }
      />
      {children ? <FieldDescription>{children}</FieldDescription> : null}
    </Field>
  );
}

export function TheEmail({ draft, set }: ComposeBodyProps) {
  return (
    <FormSection
      title="The email"
      description="The subject is what people see in their inbox. The name is just for you, to find this later."
    >
      <DraftTextField
        label="Name (only you see this)"
        value={draft.name}
        placeholder="March newsletter"
        onChange={(next) => {
          set('name', next);
        }}
      />
      <DraftTextField
        label="Subject line"
        value={draft.subject}
        placeholder="Spring is here: 20% off everything"
        onChange={(next) => {
          set('subject', next);
        }}
      >
        Type <code>{'{{customer.greeting}}'}</code> to greet each person by name. It says “there”
        for anyone whose name you haven’t got, so the line always reads properly.
      </DraftTextField>
      <DraftTextField
        label="Preview text (optional)"
        value={draft.preheader}
        placeholder="The one line that shows after the subject in most inboxes"
        onChange={(next) => {
          set('preheader', next);
        }}
      >
        A short line most inboxes show next to the subject. Leave it blank and the start of your
        email is used instead.
      </DraftTextField>
    </FormSection>
  );
}

export function WhoItGoesTo(props: ComposeBodyProps) {
  const { audiences } = props;
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
          You don’t have any saved audiences yet. Audiences are built from your customer list:
          create one, then come back to send to it.
        </Text>
      ) : (
        <AudienceField {...props} />
      )}
    </FormSection>
  );
}

/** The audience picker, and how many people the chosen one reaches. */
function AudienceField({
  draft,
  set,
  audiences,
  recipientCount,
  estimatePending,
}: ComposeBodyProps) {
  return (
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
  );
}
