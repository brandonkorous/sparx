'use client';

// The gateway config drawer — opens when a provider tile is picked. The frame header
// carries identity + status (mark, name, tag, Active/Connected pill); the body holds the
// schema-generated credential form. Saving encrypts the secrets server-side, then the
// parent activates the gateway and closes (docs/86 frame pattern: status in the header).

import * as React from 'react';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Stack,
  Text,
} from '@sparx/ui';

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
          <DrawerHeader>
            <Stack direction="row" align="center" gap={3}>
              <GatewayMark gatewayId={gateway.id} size="md" />
              <Stack gap={1} className="min-w-0 flex-1">
                <DrawerTitle>{gateway.name}</DrawerTitle>
                <DrawerDescription>{checkoutTag(gateway)}</DrawerDescription>
              </Stack>
              <GatewayStatusBadge status={status} />
            </Stack>
          </DrawerHeader>
          <DrawerBody>
            <Stack gap={5}>
              <Text size="sm" variant="muted">
                {gateway.feeNote}
                {gateway.checkout === 'redirect'
                  ? ' Shoppers pay on the gateway’s hosted page, so card data never touches sparx.'
                  : ''}
              </Text>
              <GatewayCredentialForm
                descriptor={gateway}
                credential={credential}
                onSaved={onSaved}
              />
            </Stack>
          </DrawerBody>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}
