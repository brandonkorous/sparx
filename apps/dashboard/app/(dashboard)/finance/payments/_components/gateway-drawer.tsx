'use client';

// The gateway config drawer — opens when a provider tile is picked. The frame header
// carries identity + status (mark, name, tag, Active/Connected pill); the body holds the
// schema-generated credential form. Saving encrypts the secrets server-side, then the
// parent activates the gateway and closes (docs/86 frame pattern: status in the header).

import * as React from 'react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from 'silicaui-react';

import type { GatewayDescriptor, MaskedGatewayCredential } from '../actions';
import { GatewayCredentialForm } from './gateway-credential-form';
import { GatewayMark } from './gateway-mark';
import { checkoutTag, GatewayStatusBadge, type GatewayStatus } from './gateway-tile';

export function GatewayDrawer({
  gateway,
  credential,
  status,
  onClose,
  onSaved,
}: {
  gateway: GatewayDescriptor | null;
  credential?: MaskedGatewayCredential;
  status: GatewayStatus;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  return (
    <Drawer open={gateway !== null} onOpenChange={(open) => !open && onClose()}>
      {gateway ? (
        <DrawerContent side="right" className="w-full max-w-md">
          <div className="flex items-center gap-3">
            <GatewayMark gatewayId={gateway.id} size="md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DrawerTitle>{gateway.name}</DrawerTitle>
              <DrawerDescription>{checkoutTag(gateway)}</DrawerDescription>
            </div>
            <GatewayStatusBadge status={status} />
          </div>
          <div className="mt-5 flex flex-col gap-5">
            <p className="text-base-content/70 text-sm">
              {gateway.feeNote}
              {gateway.checkout === 'redirect'
                ? ' Shoppers pay on the gateway’s hosted page, so card data never touches sparx.'
                : ''}
            </p>
            <GatewayCredentialForm descriptor={gateway} credential={credential} onSaved={onSaved} />
          </div>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}
