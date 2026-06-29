'use client';

import { Plus } from 'lucide-react';

import { EntityCreateButton } from '../../../_components/entity-create-button';

// "New service type" launcher — opens the create surface in the user's preferred
// presentation via the shared EntityCreateButton. The `b2b-service-type` create
// form is registered in the @detail overlay system, with /b2b/service-types/new
// as the full-page fallback.
export function NewServiceTypeButton() {
  return (
    <EntityCreateButton
      entityType="b2b-service-type"
      newHref="/b2b/service-types/new"
      color="module"
    >
      <Plus className="mr-1.5 h-4 w-4" />
      New service type
    </EntityCreateButton>
  );
}
