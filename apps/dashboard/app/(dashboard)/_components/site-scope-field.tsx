'use client';

import * as React from 'react';
import { Checkbox, Label, Text } from '@sparx/ui';
import type { Property } from '@/lib/sites';

// Reusable "Visible on sites" control (docs/49 §3 Model B). The selected set is
// the web PROPERTIES an item (product / content entry) is scoped to; an EMPTY
// set means "all sites" (the default). Renders nothing for single-site tenants —
// scoping is meaningless there, so the editor stays unchanged.
export interface SiteScopeFieldProps {
  sites: Property[];
  /** Selected property ids. Empty = visible on all sites. */
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  description?: string;
}

export function SiteScopeField({
  sites,
  value,
  onChange,
  label = 'Visible on sites',
  description,
}: SiteScopeFieldProps) {
  const baseId = React.useId();
  // Single-site tenants: no scoping axis, render nothing.
  if (sites.length <= 1) return null;

  const allSites = value.length === 0;
  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Text size="sm" variant="muted">
        {description ??
          'Leave “All sites” checked to show this everywhere, or pick specific sites.'}
      </Text>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${baseId}-all`}
          color="module"
          checked={allSites}
          onCheckedChange={(c) => {
            // Checking "All sites" clears the specific selection; unchecking is a
            // no-op (you opt out by picking specific sites instead).
            if (c === true) onChange([]);
          }}
        />
        <label htmlFor={`${baseId}-all`} className="cursor-pointer text-sm">
          All sites
        </label>
      </div>
      {sites.map((s) => (
        <div key={s.id} className="flex items-center gap-2 pl-5">
          <Checkbox
            id={`${baseId}-${s.id}`}
            color="module"
            checked={value.includes(s.id)}
            onCheckedChange={(c) => toggle(s.id, c === true)}
          />
          <label htmlFor={`${baseId}-${s.id}`} className="cursor-pointer text-sm">
            {s.name}
            {s.isPrimary ? ' · primary' : ''}
          </label>
        </div>
      ))}
    </div>
  );
}
