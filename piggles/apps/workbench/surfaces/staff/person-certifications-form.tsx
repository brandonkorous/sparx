'use client';

// ADDING A TICKET — what it is, who issued it, and when it runs out.
//
// The expiry is the field that matters: a lapsed licence is a van that cannot
// leave the yard, and the reminder lead is how long before that somebody hears
// about it.

import { useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  useToast,
} from '@wizeworks/silicaui-react';

import { afterPaneChange } from '../../lib/defer';
import { staffErrorMessage, useSaveCertification } from './data';

export function NewCertificationForm({
  staffMemberId,
  onCancel,
}: {
  staffMemberId: string;
  onCancel: () => void;
}) {
  const toast = useToast();
  const save = useSaveCertification();
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [lead, setLead] = useState('30');

  const submit = () => {
    save.mutate(
      {
        id: null,
        staffMemberId,
        name: name.trim(),
        issuer: issuer.trim() === '' ? null : issuer.trim(),
        referenceNumber: null,
        issuedOn: null,
        expiresOn: expiresOn === '' ? null : expiresOn,
        reminderLeadDays: Number(lead) || 30,
        notes: null,
      },
      {
        onSuccess: () => {
          onCancel();
          afterPaneChange(() => {
            toast.add({ title: 'Qualification added', type: 'success' });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not add that',
            description: staffErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <div className="border-base-300 rounded-box flex flex-col gap-3 border p-3">
      <div className="grid gap-3 @lg:grid-cols-2">
        <Field>
          <FieldLabel>What it is</FieldLabel>
          <FieldControl
            render={
              <Input
                placeholder="CDL Class A, Gas Safe, First aid…"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            }
          />
        </Field>
        <Field>
          <FieldLabel>Who issued it</FieldLabel>
          <FieldControl
            render={
              <Input
                value={issuer}
                onChange={(event) => {
                  setIssuer(event.target.value);
                }}
              />
            }
          />
        </Field>
        <Field>
          <FieldLabel>Expires</FieldLabel>
          <FieldControl
            render={
              <Input
                type="date"
                value={expiresOn}
                onChange={(event) => {
                  setExpiresOn(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            Leave blank if it never expires — that is a real answer, and it will not be treated as a
            missing date.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Warn this many days ahead</FieldLabel>
          <FieldControl
            render={
              <Input
                inputMode="numeric"
                value={lead}
                onChange={(event) => {
                  setLead(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            Give yourself more notice for anything you renew by post.
          </FieldDescription>
        </Field>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          color="module"
          disabled={name.trim() === ''}
          loading={save.isPending}
          onClick={submit}
        >
          Add it
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
