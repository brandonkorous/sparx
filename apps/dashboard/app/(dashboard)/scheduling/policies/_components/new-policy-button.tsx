'use client';

import { Plus } from 'lucide-react';

import { EntityCreateButton } from '../../../_components/entity-create-button';

// "New policy" launcher — opens the create surface in the user's preferred
// presentation via the shared EntityCreateButton. The `booking-policy` create
// form is registered in the @detail overlay system, with
// /scheduling/policies/new as the full-page fallback.
export function NewPolicyButton() {
  return (
    <EntityCreateButton
      entityType="booking-policy"
      newHref="/scheduling/policies/new"
      color="module"
    >
      <Plus className="mr-1 h-4 w-4" />
      New policy
    </EntityCreateButton>
  );
}
