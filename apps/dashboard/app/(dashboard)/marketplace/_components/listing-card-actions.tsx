// The category-aware primary action for a listing card (docs/60). Blueprints
// install/go-live, themes Apply, integrations Connect; components land "Add" in a
// later phase. Keeping the switch here means the generic card stays category-
// blind. Server-compatible — it just delegates to the right (client) action.

import type { MarketplaceListing } from '../_types';

import { BlueprintCardActions } from './blueprint-card-actions';
import { ThemeCardActions } from './theme-card-actions';
import { IntegrationCardActions } from './integration-card-actions';
import { ComponentCardActions } from './component-card-actions';

export function ListingCardActions({
  item,
  canInstall,
  detail = false,
}: {
  item: MarketplaceListing;
  canInstall: boolean;
  // True on the listing DETAIL page. Components route browse cards to the detail
  // (where the storage-backed tree resolves the real action) — docs/85 §7.
  detail?: boolean;
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
  if (item.category === 'themes') {
    return <ThemeCardActions themeSlug={item.slug} themeName={item.name} canInstall={canInstall} />;
  }
  if (item.category === 'integrations' && item.integration) {
    return (
      <IntegrationCardActions
        providerSlug={item.integration.providerSlug}
        canInstall={canInstall}
      />
    );
  }
  if (item.category === 'components') {
    return (
      <ComponentCardActions
        slug={item.slug}
        name={item.name}
        component={item.component}
        detail={detail}
      />
    );
  }
  return null;
}
