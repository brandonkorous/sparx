'use client';

import { Plus } from 'lucide-react';

import { EntityCreateButton } from '../../../_components/entity-create-button';

// "New tier" launcher — opens the create surface in the user's preferred
// presentation via the shared EntityCreateButton. The `b2b-pricing-tier` create
// form is registered in the @detail overlay system, with /b2b/pricing-tiers/new
// as the full-page fallback.
export function TierCreateButton() {
  return (
    <EntityCreateButton
      entityType="b2b-pricing-tier"
      newHref="/b2b/pricing-tiers/new"
      color="module"
      leftIcon={<Plus className="h-4 w-4" />}
    >
      New tier
    </EntityCreateButton>
  );
}
