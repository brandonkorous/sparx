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
      <h1 className="st-h2" style={{ marginBottom: '1.25rem' }}>
        Profile
      </h1>
      <form onSubmit={submit} className="st-form">
        <label className="st-field">
          <span>Email</span>
          <Input value={customer?.email ?? ''} disabled readOnly />
        </label>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <label className="st-field" style={{ flex: 1 }}>
            <span>First name</span>
            <Input
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setState('idle');
              }}
            />
          </label>
          <label className="st-field" style={{ flex: 1 }}>
            <span>Last name</span>
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
        <label className="st-field">
          <span>Phone</span>
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
            <span className="st-muted" role="status">
              Saved.
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
