'use client';

// Address book — list, add, edit, delete. The default address is highlighted
// and used to prefill checkout.

import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
  AccountError,
  type Address,
  type AddressInput,
} from '@/lib/customer-client';
import { Alert, Badge, Button, Input } from '@wizeworks/silicaui-react';

const EMPTY: Partial<AddressInput> = {
  type: 'shipping',
  line1: '',
  city: '',
  region: '',
  postalCode: '',
  country: 'US',
  isDefault: false,
};

function formatAddress(a: Address): string {
  return [
    a.recipientName,
    a.line1,
    a.line2,
    [a.city, a.region, a.postalCode].filter(Boolean).join(', '),
    a.country,
  ]
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' · ');
}

export default function AddressesPage() {
  const { tenantSlug } = useCustomer();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    getAddresses(tenantSlug)
      .then(setAddresses)
      .catch(() => setError('Could not load addresses.'));
  }
  useEffect(load, [tenantSlug]);

  async function remove(id: string) {
    await deleteAddress(tenantSlug, id);
    load();
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">Addresses</h1>
        {editing === null ? (
          <Button color="neutral" variant="outline" onClick={() => setEditing('new')}>
            Add address
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      {editing !== null ? (
        <AddressForm
          tenantSlug={tenantSlug}
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : addresses === null ? (
        <div className="skeleton" style={{ height: 140 }} />
      ) : addresses.length === 0 ? (
        <p className="text-base-content">No saved addresses yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {addresses.map((a) => (
            <div
              key={a.id}
              className="card border-base-300 border"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div>
                {a.label ? <strong>{a.label} </strong> : null}
                {a.isDefault ? (
                  <Badge color="neutral" variant="soft">
                    Default
                  </Badge>
                ) : null}
                <div
                  className="text-base-content"
                  style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}
                >
                  {formatAddress(a)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button color="neutral" variant="ghost" onClick={() => setEditing(a)}>
                  Edit
                </Button>
                <Button color="neutral" variant="ghost" onClick={() => void remove(a.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddressForm({
  tenantSlug,
  initial,
  onCancel,
  onSaved,
}: {
  tenantSlug: string;
  initial: Address | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<AddressInput>>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (initial) await updateAddress(tenantSlug, initial.id, form);
      else await createAddress(tenantSlug, form);
      onSaved();
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Could not save address.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-[560px] flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-base-content text-sm font-medium">Label (optional)</span>
        <Input
          value={form.label ?? ''}
          onChange={(e) => set('label', e.target.value)}
          placeholder="Home, Work…"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-base-content text-sm font-medium">Recipient name</span>
        <Input
          autoComplete="name"
          value={form.recipientName ?? ''}
          onChange={(e) => set('recipientName', e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-base-content text-sm font-medium">Address line 1</span>
        <Input
          required
          autoComplete="address-line1"
          value={form.line1 ?? ''}
          onChange={(e) => set('line1', e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-base-content text-sm font-medium">Address line 2 (optional)</span>
        <Input
          autoComplete="address-line2"
          value={form.line2 ?? ''}
          onChange={(e) => set('line2', e.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-4 max-[860px]:grid-cols-1">
        <label className="flex flex-col gap-1.5">
          <span className="text-base-content text-sm font-medium">City</span>
          <Input
            required
            autoComplete="address-level2"
            value={form.city ?? ''}
            onChange={(e) => set('city', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base-content text-sm font-medium">State / Region</span>
          <Input
            autoComplete="address-level1"
            value={form.region ?? ''}
            onChange={(e) => set('region', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base-content text-sm font-medium">Postal code</span>
          <Input
            autoComplete="postal-code"
            value={form.postalCode ?? ''}
            onChange={(e) => set('postalCode', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base-content text-sm font-medium">Country</span>
          <Input
            required
            maxLength={2}
            autoComplete="country"
            value={form.country ?? ''}
            onChange={(e) => set('country', e.target.value.toUpperCase())}
            placeholder="US"
          />
        </label>
      </div>
      <label className="text-base-content flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          className="checkbox"
          checked={form.isDefault ?? false}
          onChange={(e) => set('isDefault', e.target.checked)}
        />
        Set as default address
      </label>
      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : null}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Button color="neutral" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" color="primary" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save address' : 'Add address'}
        </Button>
      </div>
    </form>
  );
}
