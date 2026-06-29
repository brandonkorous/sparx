'use client';

import { Plus } from 'lucide-react';

import { EntityCreateButton } from '../../../_components/entity-create-button';

// "New resource" launcher — opens the create surface in the user's preferred
// presentation via the shared EntityCreateButton. The `resource` create form is
// registered in the @detail overlay system, with /scheduling/resources/new as
// the full-page fallback.
export function NewResourceButton() {
  return (
    <EntityCreateButton entityType="resource" newHref="/scheduling/resources/new" color="module">
      <Plus className="mr-1 h-4 w-4" />
      New resource
    </EntityCreateButton>
  );
}
