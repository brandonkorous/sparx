'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from '@sparx/ui';
import { Button, Field, FieldControl, FieldLabel, Select } from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { createBroadcastAction } from '../actions';
import type { SegmentOption } from '../../_lib/types';

/** A published Builder email usable as a broadcast body (docs/52). */
export interface BuilderEmailOption {
  id: string;
  name: string;
}

interface ComposerProps {
  segments: SegmentOption[];
  designedEmails: BuilderEmailOption[];
}

export function BroadcastComposer({ segments, designedEmails }: ComposerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [builderEmailId, setBuilderEmailId] = useState('');

  const v = useFieldValidation(
    { name, subject },
    {
      name: rule.required('Enter a campaign name.'),
      subject: rule.required('Enter a subject line.'),
    }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!v.validate()) return;
    startTransition(async () => {
      const result = await createBroadcastAction({
        name: name.trim(),
        subject: subject.trim(),
        preheader: preheader.trim() || undefined,
        segmentId: segmentId || undefined,
        builderEmailId: builderEmailId || undefined,
      });
      if (result.ok) {
        toast.success('Draft created.');
        router.push(`/email/broadcasts/${result.data.id}`);
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  const segmentItems = Object.fromEntries(segments.map((s) => [s.id, s.name]));
  const emailItems = Object.fromEntries(designedEmails.map((e) => [e.id, e.name]));

  return (
    <form onSubmit={onSubmit}>
      <div className="flex max-w-2xl flex-col gap-5">
        <Field {...v.field('name')}>
          <FieldLabel required>Campaign name</FieldLabel>
          <FieldControl
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            {...v.control('name')}
            placeholder="Spring sale"
            disabled={pending}
          />
        </Field>
        <Field {...v.field('subject')}>
          <FieldLabel required>Subject</FieldLabel>
          <FieldControl
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            {...v.control('subject')}
            placeholder="20% off this week"
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel>Preheader</FieldLabel>
          <FieldControl
            name="preheader"
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            placeholder="Inbox preview line"
            disabled={pending}
          />
        </Field>

        <Field>
          <FieldLabel>Audience (CRM segment)</FieldLabel>
          {segments.length === 0 ? (
            <p className="text-base-content text-sm">
              No segments found. Create one in the CRM module to target an audience.
            </p>
          ) : (
            <Select
              id="segment"
              className="w-full"
              value={segmentId}
              onValueChange={(val) => setSegmentId(val as string)}
              disabled={pending}
              placeholder="Choose a segment"
              items={segmentItems}
            />
          )}
        </Field>

        <Field>
          <FieldLabel>Email</FieldLabel>
          {designedEmails.length === 0 ? (
            <p className="text-base-content text-sm">
              No published emails yet.{' '}
              <Link href="/builder/email" className="underline">
                Design one in the Email Builder
              </Link>{' '}
              and publish it to use as the body.
            </p>
          ) : (
            <Select
              id="designed-email"
              className="w-full"
              value={builderEmailId}
              onValueChange={(val) => setBuilderEmailId(val as string)}
              disabled={pending}
              placeholder="Choose a designed email"
              items={emailItems}
            />
          )}
        </Field>

        <div className="flex flex-row gap-2">
          <Button type="submit" color="module" loading={pending} disabled={pending}>
            Create draft
          </Button>
        </div>
      </div>
    </form>
  );
}
