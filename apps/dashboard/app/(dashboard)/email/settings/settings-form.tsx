'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from '@sparx/ui';
import {
  Button,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { updateEmailSettingsAction } from './actions';
import type { EmailSettingsView } from '../_lib/types';

// Reuse the shared email rule but treat empty as valid — these addresses are optional.
const optionalEmail = (value: string): string | null => (value.trim() ? rule.email()(value) : null);

interface SettingsFormProps {
  initial: EmailSettingsView;
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const [pending, startTransition] = useTransition();
  const [fromName, setFromName] = useState(initial.fromName ?? '');
  const [fromAddress, setFromAddress] = useState(initial.fromAddress ?? '');
  const [replyTo, setReplyTo] = useState(initial.replyTo ?? '');
  const [physicalAddress, setPhysicalAddress] = useState(initial.physicalAddress ?? '');

  const v = useFieldValidation(
    { fromName, fromAddress, replyTo, physicalAddress },
    { fromAddress: optionalEmail, replyTo: optionalEmail }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!v.validate()) return;

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
        v.setServerErrors(
          Object.fromEntries(result.error.details.map((d) => [d.field, d.message]))
        );
        toast.error('Please fix the highlighted fields.');
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex max-w-2xl flex-col gap-5">
        <Field {...v.field('fromName')}>
          <FieldLabel>From name</FieldLabel>
          <FieldControl
            name="fromName"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            {...v.control('fromName')}
            placeholder="Acme Store"
            disabled={pending}
          />
          <FieldDescription>The display name recipients see in their inbox.</FieldDescription>
        </Field>

        <Field {...v.field('fromAddress')}>
          <FieldLabel>From address</FieldLabel>
          <FieldControl
            name="fromAddress"
            type="email"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            {...v.control('fromAddress')}
            placeholder="orders@yourstore.com"
            disabled={pending}
          />
          <FieldDescription>
            Must be on a verified sending domain to send from your own brand.
          </FieldDescription>
        </Field>

        <Field {...v.field('replyTo')}>
          <FieldLabel>Reply-to address</FieldLabel>
          <FieldControl
            name="replyTo"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            {...v.control('replyTo')}
            placeholder="support@yourstore.com"
            disabled={pending}
          />
        </Field>

        <Field {...v.field('physicalAddress')}>
          <FieldLabel>Physical mailing address</FieldLabel>
          <FieldControl
            name="physicalAddress"
            value={physicalAddress}
            onChange={(e) => setPhysicalAddress(e.target.value)}
            {...v.control('physicalAddress')}
            disabled={pending}
            render={
              <Textarea placeholder={'Acme Store\n123 Main St\nVisalia, CA 93291'} rows={3} />
            }
          />
          <FieldDescription>
            Required by CAN-SPAM / GDPR — shown in the footer of every email.
          </FieldDescription>
        </Field>

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
