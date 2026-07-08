'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from '@sparx/ui';
import { Button, Input, Label, Select } from 'silicaui-react';

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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !subject.trim()) {
      toast.error('Name and subject are required.');
      return;
    }
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Campaign name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring sale"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="20% off this week"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="preheader">Preheader</Label>
          <Input
            id="preheader"
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            placeholder="Inbox preview line"
            disabled={pending}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="segment">Audience (CRM segment)</Label>
          {segments.length === 0 ? (
            <p className="text-base-content/70 text-sm">
              No segments found. Create one in the CRM module to target an audience.
            </p>
          ) : (
            <Select
              id="segment"
              className="w-full"
              value={segmentId}
              onValueChange={(v) => setSegmentId(v as string)}
              disabled={pending}
              placeholder="Choose a segment"
              items={segmentItems}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="designed-email">Email</Label>
          {designedEmails.length === 0 ? (
            <p className="text-base-content/70 text-sm">
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
              onValueChange={(v) => setBuilderEmailId(v as string)}
              disabled={pending}
              placeholder="Choose a designed email"
              items={emailItems}
            />
          )}
        </div>

        <div className="flex flex-row gap-2">
          <Button type="submit" color="module" loading={pending} disabled={pending}>
            Create draft
          </Button>
        </div>
      </div>
    </form>
  );
}
