// The per-integration action for a marketplace card/detail (docs/60 §10, docs/66
// MP-Ph3). The marketplace is DISCOVERY; connecting/configuring a provider lives
// in Settings → Integrations (/commerce/providers), so "Connect" hands off there
// (the provider slug rides along for the install flow to preselect). Gated to
// owner/admin — connecting a payment/shipping/tax provider is a sensitive action.
// No client state, so this stays a plain component.

import Link from 'next/link';
import { Button, Text } from '@sparx/ui';

export function IntegrationCardActions({
  providerSlug,
  canInstall,
}: {
  providerSlug: string;
  canInstall: boolean;
}) {
  if (!canInstall) {
    return (
      <Text size="xs" variant="muted">
        Only an owner or admin can connect an integration.
      </Text>
    );
  }
  return (
    <Button color="primary" asChild>
      <Link href={`/commerce/providers?provider=${encodeURIComponent(providerSlug)}`}>Connect</Link>
    </Button>
  );
}
