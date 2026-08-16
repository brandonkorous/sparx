// One glyph per category of connection, shared by the list and the detail pane so a
// shipping connection reads the same wherever it appears.

import {
  faBoxOpen,
  faCreditCard,
  faFingerprint,
  faPlug,
  faReceipt,
  faRepeat,
  faRobot,
  faShareNodes,
  faShop,
  faTruck,
} from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';

import type { IntegrationCategory } from './data';
import type { ProviderKind } from './provider-connection';

export function categoryIcon(category: IntegrationCategory): PigglesIcon {
  switch (category) {
    case 'payments':
      return faCreditCard;
    case 'shipping':
      return faTruck;
    case 'tax':
      return faReceipt;
    case 'sales_channels':
      return faShop;
    case 'social':
      return faShareNodes;
    case 'dropship':
      return faBoxOpen;
    case 'ai':
      return faRobot;
    default:
      return faPlug;
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
export function providerKindIcon(kind: ProviderKind): PigglesIcon {
  switch (kind) {
    case 'payment':
      return faCreditCard;
    case 'subscription_billing':
      return faRepeat;
    case 'identity':
      return faFingerprint;
    default:
      return categoryIcon(kind);
  }
}
