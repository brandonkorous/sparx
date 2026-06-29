'use client';

import { Plus } from 'lucide-react';

import { EntityCreateButton } from '../../../_components/entity-create-button';

// "New service" launcher. Opens the create surface in the user's preferred
// presentation (drawer / modal / full page / new tab) via the shared
// EntityCreateButton — the `service` create form is registered in the @detail
// overlay system (detail-slot + detail-registry), with /scheduling/services/new
// as the full-page fallback.
export function NewServiceButton() {
  return (
    <EntityCreateButton entityType="service" newHref="/scheduling/services/new" color="module">
      <Plus className="mr-1 h-4 w-4" />
      New service
    </EntityCreateButton>
  );
}
