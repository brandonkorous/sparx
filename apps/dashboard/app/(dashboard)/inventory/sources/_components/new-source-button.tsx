'use client';

import { Plus } from 'lucide-react';

import { EntityCreateButton } from '../../../_components/entity-create-button';

// "Connect source" launcher — opens the create surface in the user's preferred
// presentation via the shared EntityCreateButton. The `inventory-source` create
// form is registered in the @detail overlay system, with /inventory/sources/new
// as the full-page fallback.
export function NewSourceButton() {
  return (
    <EntityCreateButton
      entityType="inventory-source"
      newHref="/inventory/sources/new"
      color="module"
    >
      <Plus className="mr-1.5 size-4" />
      Connect source
    </EntityCreateButton>
  );
}
