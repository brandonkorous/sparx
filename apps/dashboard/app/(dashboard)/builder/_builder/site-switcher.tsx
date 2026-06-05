'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { NativeSelect } from '@sparx/ui';
import type { Property } from '@/lib/sites';
import { setActiveSite } from '../../settings/sites/actions';

// The in-editor site switcher (docs/49 Phase 3) — choose which web PROPERTY the
// Builder authors. Sets the active-site cookie (via the shared server action) and
// refreshes so the page tree + chrome reload for the chosen site. Only rendered
// when the tenant has more than one site (single-site tenants see nothing).
export interface SiteSwitcherProps {
  properties: Property[];
  activePropertyId: string | null;
}

export function SiteSwitcher({ properties, activePropertyId }: SiteSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (properties.length <= 1) return null;

  const primary = properties.find((p) => p.isPrimary);
  const value =
    (activePropertyId && properties.some((p) => p.id === activePropertyId)
      ? activePropertyId
      : undefined) ??
    primary?.id ??
    properties[0]?.id;

  const onChange = (id: string) => {
    if (id === value) return;
    startTransition(async () => {
      await setActiveSite(id);
      router.refresh();
    });
  };

  return (
    <NativeSelect
      size="sm"
      className="bx-siteselect"
      aria-label="Active site"
      title="Which site you’re editing"
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
    >
      {properties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.isPrimary ? ' (primary)' : ''}
        </option>
      ))}
    </NativeSelect>
  );
}
