// The category-aware primary action for a listing card (docs/60). Today only
// blueprints carry a per-tenant action (the install lifecycle); themes /
// components / integrations land their actions ("Apply", "Add", "Connect") in
// later phases. Keeping the switch here means the generic card stays category-
// blind. Server-compatible — it just delegates to the right (client) action.

import type { MarketplaceListing } from '../_types';

import { BlueprintCardActions } from './blueprint-card-actions';

export function ListingCardActions({
  item,
  canInstall,
}: {
  item: MarketplaceListing;
  canInstall: boolean;
}) {
  if (item.category === 'blueprints') {
    return (
      <BlueprintCardActions
        blueprintKey={item.slug}
        blueprintName={item.name}
        latestVersion={item.version}
        install={item.install ?? null}
        canInstall={canInstall}
      />
    );
  }
  return null;
}
