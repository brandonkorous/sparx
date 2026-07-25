'use client';

import * as React from 'react';
import { Button, Text } from '@sparx/ui';
import { Field, FieldControl, FieldLabel } from '@wizeworks/silicaui-react';
import { searchTenantsAction } from '../actions';

// A typeahead tenant picker for locking a promotion code to one tenant. Searches
// by business name / slug / email through the billing:act server action, so the
// operator never has to paste a raw tenant id. No silicaui combobox primitive
// exists, so the results list is hand-composed with layout utilities (RULE #1).

export interface TenantChoice {
  id: string;
  name: string;
  slug: string;
}

export function TenantPicker({
  value,
  onChange,
}: {
  value: TenantChoice | null;
  onChange: (choice: TenantChoice | null) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<TenantChoice[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (value || q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchTenantsAction(q).then((found) => {
        if (!active) return;
        setResults(found);
        setLoading(false);
        setOpen(true);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, value]);

  if (value) {
    return (
      <Field>
        <FieldLabel>Tenant</FieldLabel>
        <div className="border-base-300 flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <div className="min-w-0">
            <Text size="sm" className="truncate font-medium">
              {value.name}
            </Text>
            <Text size="xs" variant="muted" className="truncate">
              {value.slug}
            </Text>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setQuery('');
            }}
          >
            Change
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <Field>
      <FieldLabel required>Tenant</FieldLabel>
      <div className="relative">
        <FieldControl
          name="tenantSearch"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by business name, slug or email"
          autoComplete="off"
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
        />
        {open && query.trim().length >= 2 ? (
          <div className="border-base-300 bg-base-100 absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border">
            {loading ? (
              <div className="px-3 py-2">
                <Text size="sm" variant="muted">
                  Searching…
                </Text>
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2">
                <Text size="sm" variant="muted">
                  No tenants match “{query.trim()}”.
                </Text>
              </div>
            ) : (
              results.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="hover:bg-base-200 flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left"
                  onClick={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                >
                  <Text size="sm" className="font-medium">
                    {t.name}
                  </Text>
                  <Text size="xs" variant="muted">
                    {t.slug}
                  </Text>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </Field>
  );
}
