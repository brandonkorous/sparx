'use client';

// Bookings-list filters (docs/79 §12) — narrow to one person's or one service's
// bookings, composing with the status chips (status is preserved). Both map to the
// list API's existing `resourceId` / `serviceId` params; "All …" clears the filter.

import { useRouter } from 'next/navigation';
import { NativeSelect } from '@sparx/ui';

export interface BookingsFilterResource {
  id: string;
  name: string;
  kind: string;
}

export function BookingsFilters({
  status,
  resource,
  service,
  resources,
  services,
}: {
  status: string;
  resource: string;
  service: string;
  resources: BookingsFilterResource[];
  services: { id: string; name: string }[];
}) {
  const router = useRouter();

  function go(next: { resource?: string; service?: string }): void {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const r = next.resource ?? resource;
    const s = next.service ?? service;
    if (r) params.set('resource', r);
    if (s) params.set('service', s);
    const qs = params.toString();
    router.push(qs ? `/scheduling/bookings?${qs}` : '/scheduling/bookings');
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}
