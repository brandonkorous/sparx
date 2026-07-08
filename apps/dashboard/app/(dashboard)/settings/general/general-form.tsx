'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardActions, CardBody, CardTitle, Input, Label } from 'silicaui-react';
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
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateGeneralSettings(formData);
      if (!result.ok) {
        setError(result.error ?? 'Could not save changes.');
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Business name</Label>
              <Input id="name" name="name" defaultValue={tenant.name} required />
              <p className="text-base-content/70 text-xs">
                Your legal or organization name. Used for billing and account notices — never shown
                to customers.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Contact email</Label>
              <Input id="email" name="email" type="email" defaultValue={tenant.email} required />
              <p className="text-base-content/70 text-xs">
                Receives billing and account notifications.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">Site URL</Label>
              <Input id="slug" name="slug" defaultValue={tenant.slug} disabled />
              <p className="text-base-content/70 text-xs">
                The slug your tenant is keyed by. Contact support to change.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan">Plan</Label>
              <Input id="plan" name="plan" defaultValue={tenant.plan} disabled />
            </div>

            {error && (
              <p className="text-danger text-sm" role="alert" aria-live="polite">
                {error}
              </p>
            )}
            {message && (
              <p className="text-success text-sm" role="status" aria-live="polite">
                {message}
              </p>
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
