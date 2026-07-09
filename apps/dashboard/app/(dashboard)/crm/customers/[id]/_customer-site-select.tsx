'use client';

// Site assignment control for a customer (docs/58 D2). A customer belongs to one
// web PROPERTY (site), or to none — `null` meaning GLOBAL (visible from every
// site's scoped list). This picker lets staff (re)assign the owning site or clear
// it back to global, writing through the existing updateCustomerAction → PATCH
// /v1/crm/customers/:id. Rendered only for multi-site tenants (the detail page
// omits it when there's a single site, where the concept is moot).

import * as React from 'react';
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  NativeSelect,
} from '@wizeworks/silicaui-react';

import { updateCustomerAction } from '../../customer-actions';

interface SiteOption {
  id: string;
  name: string;
}

interface CustomerSiteSelectProps {
  customerId: string;
  /** The customer's current owning property id, or null for global. */
  value: string | null;
  sites: SiteOption[];
}

export function CustomerSiteSelect({ customerId, value, sites }: CustomerSiteSelectProps) {
  const [current, setCurrent] = React.useState(value ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleChange(next: string) {
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError(null);
    // Empty option → null → global. A site id moves the customer to that site.
    const result = await updateCustomerAction(customerId, {
      propertyId: next === '' ? null : next,
    });
    setSaving(false);
    if (!result.ok) {
      setCurrent(previous);
      setError(result.error.message);
    }
  }

  return (
    <Field>
      <FieldLabel>Site</FieldLabel>
      <NativeSelect
        value={current}
        disabled={saving}
        onChange={(e) => void handleChange(e.target.value)}
      >
        <option value="">Global — all sites</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </NativeSelect>
      <FieldDescription>
        {current
          ? 'Belongs to this site (also shown under “All sites”).'
          : 'Global — visible from every site.'}
      </FieldDescription>
      {error && (
        <FieldStatus status="error" attached={false} role="alert">
          {error}
        </FieldStatus>
      )}
    </Field>
  );
}
