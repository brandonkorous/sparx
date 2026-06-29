'use client';

import { Plus } from 'lucide-react';

import { EntityCreateButton } from '../../../_components/entity-create-button';

// "Connect supplier" launcher — opens the create surface in the user's preferred
// presentation via the shared EntityCreateButton. The `dropship-supplier` create
// form (a two-step pick-a-vendor → configure flow) is registered in the @detail
// overlay system, with /dropship/suppliers/new as the full-page fallback.
export function NewSupplierButton() {
  return (
    <EntityCreateButton
      entityType="dropship-supplier"
      newHref="/dropship/suppliers/new"
      color="module"
    >
      <Plus className="mr-1 h-4 w-4" />
      Connect supplier
    </EntityCreateButton>
  );
}
