'use client';

// Provider tiles for the Payments grid — compact, logo-forward rows: brand mark + name +
// status pill + a one-line tag, the whole tile clickable to open its config drawer. PayPal
// links to the provider-install flow (not yet a selectable gateway); manual is a footer row.

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { cn } from '@sparx/ui';

import type { GatewayDescriptor } from '../actions';
import { GatewayMark } from './gateway-mark';

export type GatewayStatus = 'active' | 'connected' | 'none';

/** Terse functional tag: who pays the fee + how the shopper pays. */
export function checkoutTag(g: GatewayDescriptor): string {
  const fee = g.sparxFee ? 'Flat 0.5%' : 'No sparx fee';
  const flow =
    g.checkout === 'inline' ? 'Inline card form' : g.checkout === 'redirect' ? 'Hosted page' : '';
  return flow ? `${fee} · ${flow}` : fee;
}

export function GatewayStatusBadge({
  status,
}: {
  status: GatewayStatus;
}): React.JSX.Element | null {
  if (status === 'active') {
    return (
      <Badge color="success" variant="soft" size="sm">
        Active
      </Badge>
    );
  }
  if (status === 'connected') {
    return (
      <Badge color="neutral" variant="soft" size="sm">
        Connected
      </Badge>
    );
  }
  return null;
}

export function GatewayTile({
  gateway,
  status,
  disabled,
  onOpen,
}: {
  gateway: GatewayDescriptor;
  status: GatewayStatus;
  disabled: boolean;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Configure ${gateway.name}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'hover:border-base-content/30 cursor-pointer transition-colors',
        status === 'active' && 'border-success',
        disabled && 'pointer-events-none opacity-70'
      )}
    >
      <CardBody className="p-4">
        <div className="flex items-center gap-3">
          <GatewayMark gatewayId={gateway.id} size="md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{gateway.name}</p>
              <GatewayStatusBadge status={status} />
            </div>
            <p className="text-base-content truncate text-xs">{checkoutTag(gateway)}</p>
          </div>
          <ChevronRight className="text-base-content h-4 w-4 shrink-0" />
        </div>
      </CardBody>
    </Card>
  );
}

// PayPal isn't a selectable gateway yet (the full adapter is wired on demand, ADR 94
// §12), so it connects through the provider-install flow rather than the picker.
export function PayPalTile(): React.JSX.Element {
  return (
    <Card className="hover:border-base-content/30 transition-colors">
      <CardBody className="p-4">
        <Link
          href="/commerce/providers/install?slug=paypal&kind=payment"
          className="block focus-visible:outline-none"
        >
          <div className="flex items-center gap-3">
            <GatewayMark gatewayId="paypal" size="md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate font-medium">PayPal</p>
              <p className="text-base-content truncate text-xs">No sparx fee · Hosted page</p>
            </div>
            <ChevronRight className="text-base-content h-4 w-4 shrink-0" />
          </div>
        </Link>
      </CardBody>
    </Card>
  );
}

export function ManualRow({
  gateway,
  active,
  disabled,
  onUse,
}: {
  gateway: GatewayDescriptor;
  active: boolean;
  disabled: boolean;
  onUse: () => void;
}): React.JSX.Element {
  return (
    <Card>
      <CardBody className="p-4">
        <div className="flex items-center gap-3">
          <GatewayMark gatewayId={gateway.id} size="md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{gateway.name}</p>
              {active ? (
                <Badge color="success" variant="soft" size="sm">
                  Active
                </Badge>
              ) : null}
            </div>
            <p className="text-base-content text-xs">
              Record check, cash, wire, or ACH by hand. No online card payments, no fee.
            </p>
          </div>
          {active ? (
            <p className="text-base-content text-sm">In use</p>
          ) : (
            <Button color="module" variant="outline" size="sm" onClick={onUse} disabled={disabled}>
              Use manual
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
