// The connector registry.
//
// Three, and three is the whole list on purpose. Shopify, WordPress/WooCommerce and
// HubSpot are the only platforms on the twenty-vendor roster with an API a tenant can
// authorise for themselves in under two minutes, without applying to a partner
// programme and without us holding a platform-level credential. Wix, Squarespace,
// Webflow and Klaviyo all have APIs; every one of them wants an app review, an agency
// account or a plan tier the tenant leaving does not have — so a "connector" for them
// would be a signup form for a waiting list, which is worse than the file that already
// works today.
//
// That is why the architecture is file-first. Files work for all twenty on day one,
// and a connector is an accelerant on three of them rather than the foundation.

import type { CanonicalEntity } from '../canonical';
import { getVendor } from '../vendors';
import { hubspotConnector } from './hubspot';
import { shopifyConnector } from './shopify';
import { wordpressConnector } from './wordpress';
import {
  describeConnector,
  type Connector,
  type ConnectorDescriptor,
  type ConnectorSlug,
} from './types';

export const CONNECTORS: readonly Connector[] = [
  shopifyConnector,
  wordpressConnector,
  hubspotConnector,
];

export function getConnector(slug: string): Connector | undefined {
  return CONNECTORS.find((connector) => connector.slug === slug);
}

/** The connector serving a VENDOR — `woocommerce` and `wordpress` share one. */
export function connectorForVendor(vendorSlug: string): Connector | undefined {
  return CONNECTORS.find((connector) => connector.vendors.includes(vendorSlug));
}

/** Every connector, functions stripped, ready to serve to a browser. */
export function connectorCatalogue(): ConnectorDescriptor[] {
  return CONNECTORS.map(describeConnector);
}

export function connectorDescriptorForVendor(vendorSlug: string): ConnectorDescriptor | undefined {
  const connector = connectorForVendor(vendorSlug);
  return connector === undefined ? undefined : describeConnector(connector);
}

/**
 * Which resources these credentials can actually reach.
 *
 * A WordPress site with no WooCommerce keys can still bring its posts and its media
 * library; asking for its products would 401. Filtering here means the tenant is
 * offered what they can have rather than being shown four things and told off for
 * picking two of them.
 */
export function availableResources(
  connector: Connector,
  credentials: Record<string, string>
): Connector['resources'] {
  return connector.resources.filter((resource) => {
    if (resource.requires === undefined) return true;
    const value = credentials[resource.requires];
    return value !== undefined && value.trim() !== '';
  });
}

/**
 * What the live connection reaches that no export of theirs does.
 *
 * Shopify has no CSV for collections, pages or blog posts; a WordPress publisher has
 * no exporter that produces their media library as anything but a 90 MB XML file. The
 * marketing pages promise both, so the promise is computed from the difference
 * between what the connector reads and what the vendor's own files yield — the same
 * rule the rest of this package follows. If somebody removes a connector resource,
 * the sentence on the website shortens by itself.
 */
export function connectorOnlyEntities(vendorSlug: string): CanonicalEntity[] {
  const connector = connectorForVendor(vendorSlug);
  const vendor = getVendor(vendorSlug);
  if (connector === undefined || vendor === undefined) return [];

  const fromFiles = new Set<CanonicalEntity>();
  for (const source of vendor.sources) {
    for (const entity of source.yields ?? [source.entity]) fromFiles.add(entity);
  }

  const seen = new Set<CanonicalEntity>();
  return connector.resources
    .map((resource) => resource.entity)
    .filter((entity) => {
      if (fromFiles.has(entity) || seen.has(entity)) return false;
      seen.add(entity);
      return true;
    });
}

export { ConnectorError, assertHttps, assertSafeUrl } from './http';

export { describeConnector, type ConnectorSlug };
export type {
  Connector,
  ConnectorAccount,
  ConnectorDescriptor,
  ConnectorResource,
  CredentialField,
  Credentials,
  FetchLike,
  HttpRequest,
  HttpResponse,
  PullInput,
  PullPage,
} from './types';
