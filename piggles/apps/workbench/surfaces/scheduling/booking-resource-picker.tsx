'use client';

// Pin a booking to particular people or equipment, or leave it to whoever is
// free. Its own file so the create form stays one screenful (RULE #0.5).

import { Checkbox, Text } from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import type { ResourceLite } from './bookings-data';

export function BookingResourcePicker({
  resourceList,
  loading,
  resourceIds,
  toggleResource,
}: {
  resourceList: ResourceLite[];
  loading: boolean;
  resourceIds: string[];
  toggleResource: (id: string) => void;
}) {
  return (
    <FormSection
      title="Who or what it is with"
      description="Pin this to particular people or equipment if it matters. Choose none and whoever is free at that time is assigned for you."
    >
      {loading ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : resourceList.length === 0 ? (
        <Text className="text-sm">
          You have not set up any people or equipment yet, so this will be assigned automatically.
        </Text>
      ) : (
        <div className="border-base-300 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border p-1">
          {resourceList.map((resource) => {
            const on = resourceIds.includes(resource.id);
            return (
              <label
                key={resource.id}
                className="hover:bg-base-200 flex cursor-pointer items-center gap-3 rounded px-2 py-2"
              >
                <Checkbox
                  color="module"
                  size="sm"
                  checked={on}
                  aria-label={`Assign ${resource.name}`}
                  onChange={() => {
                    toggleResource(resource.id);
                  }}
                />
                <span className="min-w-0 flex-1 font-medium">{resource.name}</span>
                <Text as="span" className="shrink-0 text-sm capitalize">
                  {resource.kind}
                </Text>
              </label>
            );
          })}
        </div>
      )}
    </FormSection>
  );
}
