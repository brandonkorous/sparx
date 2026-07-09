'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Field, FieldLabel, NativeSelect } from '@wizeworks/silicaui-react';

import type { SchedulingResource } from '../../_lib/types';
import { RESOURCE_KIND_LABEL } from '../../_lib/format';

// Switches which resource's schedule the editor shows by setting `?resource=<id>`
// (the page reads it server-side and loads that resource's windows/exceptions).
export function ResourcePicker({
  resources,
  selectedId,
}: {
  resources: SchedulingResource[];
  selectedId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function select(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set('resource', id);
    router.push(`/scheduling/availability?${next.toString()}`);
  }

  return (
    <Field className="max-w-sm">
      <FieldLabel>Resource</FieldLabel>
      <NativeSelect value={selectedId} onChange={(e) => select(e.target.value)}>
        {resources.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} · {RESOURCE_KIND_LABEL[r.kind]}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}
