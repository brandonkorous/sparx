'use client';

// Provider tiles for the Payments grid — compact, logo-forward rows: brand mark + name +
// status pill + a one-line tag, the whole tile clickable to open its config drawer. PayPal
// links to the provider-install flow (not yet a selectable gateway); manual is a footer row.

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge, Button, Card, CardContent, Stack, Text, cn } from '@sparx/ui';

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
        'cursor-pointer transition-colors hover:border-[var(--color-border-strong)]',
        status === 'active' && 'border-[var(--color-success-border)]',
        disabled && 'pointer-events-none opacity-70'
      )}
    >
      <CardContent>
        <Stack direction="row" align="center" gap={3} className="py-1">
          <GatewayMark gatewayId={gateway.id} size="md" />
          <Stack gap={1} className="min-w-0 flex-1">
            <Stack direction="row" align="center" gap={2} wrap>
              <Text weight="medium" className="truncate">
                {gateway.name}
              </Text>
              <GatewayStatusBadge status={status} />
            </Stack>
            <Text size="xs" variant="muted" className="truncate">
              {checkoutTag(gateway)}
            </Text>
          </Stack>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
        </Stack>
      </CardContent>
    </Card>
  );
}

// PayPal isn't a selectable gateway yet (the full adapter is wired on demand, ADR 94
// §12), so it connects through the provider-install flow rather than the picker.
export function PayPalTile(): React.JSX.Element {
  return (
    <Card className="transition-colors hover:border-[var(--color-border-strong)]">
      <CardContent>
        <Link
          href="/commerce/providers/install?slug=paypal&kind=payment"
          className="block focus-visible:outline-none"
        >
          <Stack direction="row" align="center" gap={3} className="py-1">
            <GatewayMark gatewayId="paypal" size="md" />
            <Stack gap={1} className="min-w-0 flex-1">
              <Text weight="medium" className="truncate">
                PayPal
              </Text>
              <Text size="xs" variant="muted" className="truncate">
                No sparx fee · Hosted page
              </Text>
            </Stack>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
          </Stack>
        </Link>
      </CardContent>
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
      <CardContent>
        <Stack direction="row" align="center" gap={3} className="py-1">
          <GatewayMark gatewayId={gateway.id} size="md" />
          <Stack gap={1} className="min-w-0 flex-1">
            <Stack direction="row" align="center" gap={2} wrap>
              <Text weight="medium">{gateway.name}</Text>
              {active ? (
                <Badge color="success" variant="soft" size="sm">
                  Active
                </Badge>
              ) : null}
            </Stack>
            <Text size="xs" variant="muted">
              Record check, cash, wire, or ACH by hand. No online card payments, no fee.
            </Text>
          </Stack>
          {active ? (
            <Text size="sm" variant="muted">
              In use
            </Text>
          ) : (
            <Button color="module" variant="outline" size="sm" onClick={onUse} disabled={disabled}>
              Use manual
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
