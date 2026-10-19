'use client';

// Applying to the partner program, from the page every partner section shows a
// business that is not in it.
//
// That page said "An owner or admin can apply to join from your account
// settings", and no screen in the console could: `POST /v1/partner/apply` and
// its status read were built for a join surface that did not survive the move to
// the workbench (sparx persona issue 307). Staff still approve every
// application; this only lets the owner ask, and says where the asking stands.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  Select,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useTenant } from '../../lib/api/shell-data';
import { ApiError } from '@wizeworks/api-client';
import { useApplyToPartnerProgram, usePartnerApplication } from './data';
import { formatDate, PARTNER_KINDS } from './format';

const KIND_ITEMS: Record<string, string> = Object.fromEntries(
  PARTNER_KINDS.map((k) => [k.value, k.label])
);

export function JoinPartnerProgram() {
  const application = usePartnerApplication();
  const tenant = useTenant();
  const apply = useApplyToPartnerProgram();
  const toast = useToast();
  const [name, setName] = useState<string | null>(null);
  const [kind, setKind] = useState('freelance');

  if (application.isPending) return null;
  if (application.isError) {
    return (
      <Text className="text-sm">
        {application.error instanceof ApiError && application.error.status === 403
          ? 'An owner or admin of this business can apply.'
          : 'Whether this business has applied could not be checked just now.'}
      </Text>
    );
  }

  const current = application.data;
  if (current?.status === 'pending') {
    return (
      <Alert color="info" variant="soft">
        <AlertContent>
          <AlertTitle>Your application is in review</AlertTitle>
          <AlertDescription>
            Sent {formatDate(current.createdAt)}. Each application is reviewed by hand, and this
            section fills in once it is approved.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  const displayName = name ?? tenant.data?.name ?? '';
  const ready = displayName.trim().length > 0;

  return (
    <form
      className="flex w-full max-w-md flex-col gap-3 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        apply.mutate(
          { displayName: displayName.trim(), kind },
          {
            onSuccess: () => {
              toast.add({ title: 'Application sent', type: 'success' });
            },
            onError: () => {
              toast.add({
                title: 'Could not send your application',
                description: 'Nothing was sent. Try again in a moment.',
                type: 'error',
              });
            },
          }
        );
      }}
    >
      {current?.status === 'rejected' ? (
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertTitle>Your last application was not approved</AlertTitle>
            <AlertDescription>
              Sent {formatDate(current.createdAt)}. You can apply again below.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}
      <Field>
        <FieldLabel required>The name your clients will see</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={displayName}
              maxLength={255}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          }
        />
      </Field>
      <Field>
        <FieldLabel>What describes you</FieldLabel>
        <Select
          color="module"
          items={KIND_ITEMS}
          value={kind}
          aria-label="What best describes your practice"
          onValueChange={(next) => {
            if (typeof next === 'string') setKind(next);
          }}
        />
      </Field>
      <Button type="submit" color="module" disabled={!ready || apply.isPending}>
        Apply to join
      </Button>
    </form>
  );
}
