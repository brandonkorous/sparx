'use client';

import { Plus } from 'lucide-react';

import { EntityCreateButton } from '../../../_components/entity-create-button';

// "New booking" launcher — opens the create surface in the user's preferred
// presentation via the shared EntityCreateButton. The `booking` create form is
// registered in the @detail overlay system (it loads its own active-service list
// server-side), with /scheduling/bookings/new as the full-page fallback.
export function NewBookingButton() {
  return (
    <EntityCreateButton entityType="booking" newHref="/scheduling/bookings/new" color="module">
      <Plus className="mr-1 h-4 w-4" />
      New booking
    </EntityCreateButton>
  );
}
