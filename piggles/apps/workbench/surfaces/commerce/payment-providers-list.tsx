'use client';

// The loaded half of Payment providers: what checkout uses now, and a row per
// provider that opens its own pane to set it up or switch to it.

import { Badge, Text } from '@wizeworks/silicaui-react';
import { faStar } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ManagersOnlyNotice } from '../../components/managers-only';
import { FormSection } from '../../components/form-section';
import { RowOpenHint } from '../../components/row-open-hint';
import { productCopy } from '../../lib/product';
import {
  gatewayState,
  type GatewayDescriptor,
  type MaskedGatewayCredential,
  type PaymentConfig,
} from './providers-data';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function GatewayRow({
  gateway,
  config,
  credential,
  onOpen,
}: {
  gateway: GatewayDescriptor;
  config: PaymentConfig | undefined;
  credential: MaskedGatewayCredential | undefined;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const state = gatewayState(gateway, config, credential);
  // A provider with no adapter yet cannot be opened: choosing one that cannot charge
  // a card would break checkout on a live site. It still shows, so the list is honest.
  const unbuilt = gateway.availability === 'coming_soon';
  return (
    <button
      type="button"
      disabled={unbuilt}
      aria-disabled={unbuilt}
      className="hover:bg-base-200 flex w-full flex-wrap items-center gap-2 rounded px-2 py-2 text-left disabled:cursor-default disabled:hover:bg-transparent"
      onClick={(event) => {
        if (unbuilt) return;
        onOpen(gateway.id, event);
      }}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="font-semibold">{gateway.name}</span>
          {gateway.recommended ? (
            <Badge color="module" variant="soft" size="sm">
              <Icon glyph={faStar} className="size-3" aria-hidden />
              Recommended
            </Badge>
          ) : null}
        </span>
        <Text as="span" className="text-sm">
          {gateway.feeNote}
        </Text>
      </span>
      <Badge color={state.tone} variant="soft" size="sm">
        {state.label}
      </Badge>
    </button>
  );
}

function SetupIntro({
  active,
  config,
}: {
  active: GatewayDescriptor | undefined;
  config: PaymentConfig | undefined;
}) {
  if (!active || !config?.isActive) {
    return (
      <Text className="text-sm">
        {productCopy(
          'commerce.payments.chooseIntro',
          'Choose the service that takes your customers’ payments. sparx Pay is the fastest to start; you can also connect your own processor if you already have one.'
        )}
      </Text>
    );
  }
  // Manual is the ONE active provider that takes no card, so it must not claim to.
  return (
    <Text className="text-sm">
      {active.id === 'manual'
        ? `You're set up with ${active.name}. You take the money yourself: checkout places the order and nothing is charged online.`
        : `You're set up with ${active.name} and can take card payments now. Switch to another provider below at any time.`}
    </Text>
  );
}

export function ProvidersList({
  gateways,
  active,
  config,
  credentials,
  onOpen,
}: {
  gateways: GatewayDescriptor[];
  active: GatewayDescriptor | undefined;
  config: PaymentConfig | undefined;
  credentials: MaskedGatewayCredential[];
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const credByGateway = new Map(credentials.map((c) => [c.gatewayId, c]));
  return (
    <>
      <SetupIntro active={active} config={config} />
      {/* Each provider opens for anybody to read; only an owner or an
          admin may change one (sparx persona issue 168). */}
      <ManagersOnlyNotice change="choose or set up how you get paid" />
      <FormSection
        title="Choose how you get paid"
        description="Pick one provider to handle checkout. Open any of them to set it up or switch to it."
      >
        <div className="flex flex-col">
          {gateways.map((gateway) => (
            <GatewayRow
              key={gateway.id}
              gateway={gateway}
              config={config}
              credential={credByGateway.get(gateway.id)}
              onOpen={onOpen}
            />
          ))}
        </div>
      </FormSection>
      {gateways.length > 0 ? <RowOpenHint /> : null}
    </>
  );
}
