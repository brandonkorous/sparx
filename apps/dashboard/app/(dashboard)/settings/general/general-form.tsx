'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardActions,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@sparx/forms';
import { updateGeneralSettings } from './actions';

// Tenant-level account details. Social links are NOT here anymore — they are a
// per-SITE setting (each site has its own), edited in Builder → Brand → Identity
// (docs/49 "full per-site brand").

export interface GeneralFormProps {
  tenant: {
    name: string;
    email: string;
    slug: string;
    plan: string;
  };
}

export function GeneralForm({ tenant }: GeneralFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState(tenant.name);
  const [email, setEmail] = React.useState(tenant.email);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const v = useFieldValidation(
    { name, email },
    {
      name: rule.required('Enter your business name.'),
      email: rules(rule.required('Enter a contact email.'), rule.email()),
    }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!v.validate()) return;
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateGeneralSettings(formData);
      if (!result.ok) {
        const msg = result.error ?? 'Could not save changes.';
        if (/email/i.test(msg)) {
          v.setServerErrors({ email: msg });
        } else {
          setError(msg);
        }
        return;
      }
      setMessage('Settings saved.');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardBody>
          <CardTitle>General</CardTitle>
          <p className="opacity-70">
            Your business and account details — used for billing and admin. Your customer-facing
            site name and social links live in Builder → Brand (each site has its own).
          </p>
          <div className="flex flex-col gap-4">
            <Field {...v.field('name')}>
              <FieldLabel required>Business name</FieldLabel>
              <FieldControl
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                {...v.control('name')}
              />
              <FieldDescription>
                Your legal or organization name. Used for billing and account notices — never shown
                to customers.
              </FieldDescription>
            </Field>
            <Field {...v.field('email')}>
              <FieldLabel required>Contact email</FieldLabel>
              <FieldControl
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                {...v.control('email')}
              />
              <FieldDescription>Receives billing and account notifications.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Site URL</FieldLabel>
              <FieldControl name="slug" defaultValue={tenant.slug} disabled />
              <FieldDescription>
                The slug your tenant is keyed by. Contact support to change.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Plan</FieldLabel>
              <FieldControl name="plan" defaultValue={tenant.plan} disabled />
            </Field>

            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}
            {message && (
              <FieldStatus status="success" attached={false} role="status" aria-live="polite">
                {message}
              </FieldStatus>
            )}
          </div>
          <CardActions className="justify-start">
            <Button type="submit" disabled={pending} loading={pending}>
              Save changes
            </Button>
          </CardActions>
        </CardBody>
      </Card>
    </form>
  );
}
