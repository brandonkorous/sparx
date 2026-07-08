'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from '@sparx/ui';
import { Button, Card, CardBody, Input, Label, Textarea } from 'silicaui-react';

import { updateEmailSettingsAction } from './actions';
import type { EmailSettingsView } from '../_lib/types';

interface SettingsFormProps {
  initial: EmailSettingsView;
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const [pending, startTransition] = useTransition();
  const [fromName, setFromName] = useState(initial.fromName ?? '');
  const [fromAddress, setFromAddress] = useState(initial.fromAddress ?? '');
  const [replyTo, setReplyTo] = useState(initial.replyTo ?? '');
  const [physicalAddress, setPhysicalAddress] = useState(initial.physicalAddress ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});

    // No brand fields here on purpose — email brand (color, fonts, logo) is
    // read from the tenant-level brand (docs/30 §6), never re-entered per
    // channel and never overridable from email.
    const input = {
      fromName: fromName.trim() || null,
      fromAddress: fromAddress.trim() || null,
      replyTo: replyTo.trim() || null,
      physicalAddress: physicalAddress.trim() || null,
    };

    startTransition(async () => {
      const result = await updateEmailSettingsAction(input);
      if (result.ok) {
        toast.success('Email settings saved.');
      } else if (result.error.details?.length) {
        setFieldErrors(Object.fromEntries(result.error.details.map((d) => [d.field, d.message])));
        toast.error('Please fix the highlighted fields.');
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex max-w-2xl flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fromName">From name</Label>
          <Input
            id="fromName"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Acme Store"
            disabled={pending}
          />
          <p className="text-base-content/70 text-sm">
            The display name recipients see in their inbox.
          </p>
          {fieldErrors.fromName ? (
            <p className="text-danger text-sm">{fieldErrors.fromName}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fromAddress">From address</Label>
          <Input
            id="fromAddress"
            type="email"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder="orders@yourstore.com"
            disabled={pending}
          />
          <p className="text-base-content/70 text-sm">
            Must be on a verified sending domain to send from your own brand.
          </p>
          {fieldErrors.fromAddress ? (
            <p className="text-danger text-sm">{fieldErrors.fromAddress}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="replyTo">Reply-to address</Label>
          <Input
            id="replyTo"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="support@yourstore.com"
            disabled={pending}
          />
          {fieldErrors.replyTo ? (
            <p className="text-danger text-sm">{fieldErrors.replyTo}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="physicalAddress">Physical mailing address</Label>
          <Textarea
            id="physicalAddress"
            value={physicalAddress}
            onChange={(e) => setPhysicalAddress(e.target.value)}
            placeholder={'Acme Store\n123 Main St\nVisalia, CA 93291'}
            rows={3}
            disabled={pending}
          />
          <p className="text-base-content/70 text-sm">
            Required by CAN-SPAM / GDPR — shown in the footer of every email.
          </p>
        </div>

        <Card className="border-transparent bg-transparent shadow-none">
          <CardBody>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Brand is set once, for everything</p>
              <p className="text-base-content/70 text-sm">
                Email colors, fonts, and logo come from your brand — there&apos;s nothing to set per
                channel. Update your brand once and every transactional and marketing email adopts
                it automatically.
              </p>
              <Button
                color="primary"
                variant="link"
                size="sm"
                render={<Link href="/sitebuilder/brand" />}
              >
                Manage brand →
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-row gap-2">
          <Button type="submit" color="module" loading={pending} disabled={pending}>
            Save settings
          </Button>
        </div>
      </div>
    </form>
  );
}
