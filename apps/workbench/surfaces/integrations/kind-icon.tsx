// One glyph per kind of connection, shared by the list and the detail pane so a
// shipping connection reads the same wherever it appears.

import {
  CreditCard,
  Fingerprint,
  PackageOpen,
  Plug,
  ReceiptText,
  Repeat,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ProviderKind } from './data';

export function kindIcon(kind: ProviderKind): LucideIcon {
  switch (kind) {
    case 'shipping':
      return Truck;
    case 'payment':
      return CreditCard;
    case 'tax':
      return ReceiptText;
    case 'subscription_billing':
      return Repeat;
    case 'dropship':
      return PackageOpen;
    case 'identity':
      return Fingerprint;
    default:
      return Plug;
  }
}
