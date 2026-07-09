'use client';

// Calendar toolbar filters (docs/79 §12) — narrow the week grid to one person's
// schedule or one service. Both are wired to the query params the calendar API
// already honors (`resourceId` / `serviceId`); "All …" clears the filter. The
// current week (`from`) is preserved so filtering doesn't jump you to today.

import { useRouter } from 'next/navigation';
import { NativeSelect } from '@wizeworks/silicaui-react';

export interface CalendarResource {
  id: string;
  name: string;
  kind: string;
}

export function CalendarFilters({
  from,
  resource,
  service,
  resources,
  services,
}: {
  from: string;
  resource: string;
  service: string;
  resources: CalendarResource[];
  services: { id: string; name: string }[];
}) {
  const router = useRouter();

  function go(next: { resource?: string; service?: string }): void {
    const params = new URLSearchParams({ from });
    const r = next.resource ?? resource;
    const s = next.service ?? service;
    if (r) params.set('resource', r);
    if (s) params.set('service', s);
    router.push(`/scheduling/calendar?${params.toString()}`);
  }

  return (
    <>
      <NativeSelect
        aria-label="Filter by resource"
        value={resource}
        onChange={(e) => go({ resource: e.target.value })}
        className="w-auto"
      >
        <option value="">All resources</option>
        {resources.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Filter by service"
        value={service}
        onChange={(e) => go({ service: e.target.value })}
        className="w-auto"
      >
        <option value="">All services</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </NativeSelect>
    </>
  );
}
