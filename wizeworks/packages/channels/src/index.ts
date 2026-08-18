// @wizeworks/channels — public barrel.
//
// The ChannelAdapter contract + normalized types + the adapter registry for
// external sales-channel and sparx.market integrations (docs/106). Pure types and
// a registry singleton — no DB, no React — safe to import from backend services.
// The server-safe channel catalog (display metadata, no adapter code) is also
// re-exported here and available via the `@wizeworks/channels/catalog` subpath for
// client components.

export type {
  ChannelSlug,
  ChannelShape,
  ChannelAuth,
  ChannelTokens,
  ChannelConnectContext,
  ChannelProductInput,
  ChannelProductVariantInput,
  ChannelProductRef,
  ChannelAddress,
  ChannelOrderLine,
  ChannelOrderCustomer,
  NormalizedChannelOrder,
  ChannelFulfillment,
  ChannelInventoryUpdate,
  ChannelPeriod,
  ChannelAnalytics,
  ChannelWebhookRequest,
  ChannelAdapter,
} from './types.js';

export {
  registerChannel,
  unregisterChannel,
  getChannel,
  hasChannel,
  listChannels,
  _resetChannelRegistryForTest,
} from './registry.js';

export {
  CHANNEL_CATALOG,
  AVAILABLE_CHANNEL_SLUGS,
  getChannelDescriptor,
  type ChannelDescriptor,
} from './catalog.js';

// The shared-plane face of the channel catalog (@wizeworks/integrations).
export {
  channelIntegrations,
  channelToIntegrationDescriptor,
  registerChannelIntegrations,
} from './integration.js';
