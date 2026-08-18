// Dropship suppliers' entry in the shared integration plane (@wizeworks/integrations).
//
// Dropship is the one system that never got a registry at all — it has a
// `createAdapter()` factory and a pure `VENDOR_CATALOG`, so there was no lifecycle to
// copy and no availability concept to drift. That made it the next candidate to repeat
// the payments mistake: a second `DropshipProvider` contract already exists in the
// provider framework with nothing dispatching it, exactly the shape that left payments
// modelled twice.
//
// Registering the catalog here settles it. `SupplierAdapter` stays the contract, the
// factory stays the constructor, and the plane holds the catalog face — so suppliers
// list beside every other connection without inventing a sixth private registry.

import {
  defineIntegrationKind,
  type CredentialField,
  type IntegrationDescriptor,
} from '@wizeworks/integrations';

import type { SupplierAdapter } from './types.js';
import { VENDOR_CATALOG, type DropshipVendor } from './vendors.js';

/** Typed on `SupplierAdapter`, though entries register descriptor-only: a supplier
 *  adapter is constructed per-connection with that tenant's credentials, so there is no
 *  process-wide singleton to hold here. The plane models that honestly rather than
 *  parking a useless instance. */
export const dropshipIntegrations = defineIntegrationKind<SupplierAdapter>('dropship');

function credentialFields(vendor: DropshipVendor): CredentialField[] {
  return vendor.credentialFields.map((field) => ({
    key: field.key,
    label: field.label,
    help: field.help,
    placeholder: field.placeholder,
    secret: field.type === 'password',
    required: field.required,
    type: field.type,
  }));
}

function capabilityPhrases(vendor: DropshipVendor): string[] {
  const phrases: string[] = [];
  if (vendor.capabilities.catalogSync) phrases.push('Imports their product list');
  if (vendor.capabilities.orderSubmission) phrases.push('Sends orders automatically');
  if (vendor.capabilities.trackingSync) phrases.push('Tracking comes back to you');
  if (vendor.capabilities.inventorySync) phrases.push('Keeps stock in step');
  if (vendor.pod) phrases.push('Made to order — no stock to hold');
  return phrases;
}

export function vendorToIntegrationDescriptor(vendor: DropshipVendor): IntegrationDescriptor {
  return {
    category: 'dropship',
    slug: vendor.slug,
    name: vendor.label,
    // The CSV connector is not another company's service — it is a file the tenant
    // supplies, so it is ours.
    vendor: vendor.connectionMethod === 'manual' ? 'sparx' : vendor.label,
    blurb: vendor.tagline,
    publisher: 'sparx',
    // Every vendor in this catalog has a working adapter by construction: the doc
    // comment on VENDOR_CATALOG says suppliers without a usable public API are omitted
    // rather than shown as dead Connect buttons. That editorial rule is the same
    // instinct as `coming_soon`, applied by deletion — the plane keeps the entry and
    // labels it instead, but nothing here needs it yet.
    availability: 'available',
    connect: vendor.connectionMethod === 'manual' ? 'manual' : 'api_keys',
    credentialFields: credentialFields(vendor),
    capabilities: capabilityPhrases(vendor),
    docsUrl: vendor.credentialsHelpUrl,
    // Real API suppliers lead; the hand-managed CSV feed is the fallback.
    sortWeight: vendor.connectionMethod === 'api' ? 10 : -10,
  };
}

/** Publish every supplier in the catalog into the shared plane. */
export function registerDropshipIntegrations(): void {
  for (const vendor of VENDOR_CATALOG) {
    dropshipIntegrations.register(vendorToIntegrationDescriptor(vendor));
  }
}
