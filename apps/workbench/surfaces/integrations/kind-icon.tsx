// One glyph per category of connection, shared by the list and the detail pane so a
// shipping connection reads the same wherever it appears.

import {
  Bot,
  CreditCard,
  Fingerprint,
  PackageOpen,
  Plug,
  ReceiptText,
  Repeat,
  Share2,
  Store,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { IntegrationCategory } from './data';
import type { ProviderKind } from './provider-connection';

export function categoryIcon(category: IntegrationCategory): LucideIcon {
  switch (category) {
    case 'payments':
      return CreditCard;
    case 'shipping':
      return Truck;
    case 'tax':
      return ReceiptText;
    case 'sales_channels':
      return Store;
    case 'social':
      return Share2;
    case 'dropship':
      return PackageOpen;
    case 'ai':
      return Bot;
    default:
      return Plug;
  }
}

/**
 * The same glyphs keyed by provider KIND, for the connect/manage pane — which still
 * speaks the provider vocabulary because that is what its endpoints return.
 *
 * The two vocabularies no longer line up exactly. `ProviderKind` is a DATABASE enum on
 * `provider_installations.kind`, so it keeps values the catalog has dropped:
 * `subscription_billing` and `identity` are gone as categories because nothing
 * implements them, but a historical row could still carry either and must render
 * rather than fall through to a generic plug.
 */
export function providerKindIcon(kind: ProviderKind): LucideIcon {
  switch (kind) {
    case 'payment':
      return CreditCard;
    case 'subscription_billing':
      return Repeat;
    case 'identity':
      return Fingerprint;
    default:
      return categoryIcon(kind);
  }
}
