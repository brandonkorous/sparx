'use client';

// Profile editing — name + phone. Email is the login identifier and is shown
// read-only (changing it would be an account-migration flow, out of scope here).

import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { updateProfile, AccountError } from '@/lib/customer-client';
import { Alert, Button, Input } from '@wizeworks/silicaui-react';

export default function ProfilePage() {
  const { tenantSlug, customer, refresh } = useCustomer();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setFirstName(customer.firstName ?? '');
      setLastName(customer.lastName ?? '');
      setPhone(customer.phone ?? '');
    }
  }, [customer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    setError(null);
    try {
      await updateProfile(tenantSlug, {
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
      });
      await refresh();
      setState('saved');
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Could not save.');
      setState('idle');
    }
  }

  return (
    <div>
      <h1
        className="text-base-content text-3xl font-semibold tracking-tight"
        style={{ marginBottom: '1.25rem' }}
      >
        Profile
      </h1>
      <form onSubmit={submit} className="flex max-w-[560px] flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-base-content text-sm font-medium">Email</span>
          <Input value={customer?.email ?? ''} disabled readOnly />
        </label>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <label className="flex flex-col gap-1.5" style={{ flex: 1 }}>
            <span className="text-base-content text-sm font-medium">First name</span>
            <Input
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setState('idle');
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5" style={{ flex: 1 }}>
            <span className="text-base-content text-sm font-medium">Last name</span>
            <Input
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setState('idle');
              }}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-base-content text-sm font-medium">Phone</span>
          <Input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setState('idle');
            }}
          />
        </label>
        {error ? (
          <Alert color="danger" role="alert">
            {error}
          </Alert>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button type="submit" color="primary" disabled={state === 'busy'}>
            {state === 'busy' ? 'Saving…' : 'Save changes'}
          </Button>
          {state === 'saved' ? (
            <span className="text-base-content" role="status">
              Saved.
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
