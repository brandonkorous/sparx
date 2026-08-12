// The vendor roster.
//
// Order matters in exactly one place — detection ties. When two adapters fingerprint a
// file equally well, the earlier one wins, so the roster is ordered by how likely a
// given file is to be that vendor's in the first place. Shopify's export shapes have
// been copied by half the industry, so it sits first and its imitators sit below it.

import type { VendorAdapter } from '../types';

import { shopify } from './shopify';
import { woocommerce } from './woocommerce';
import { bigcommerce } from './bigcommerce';
import { magento } from './magento';
import { squarespace } from './squarespace';
import { wix } from './wix';
import { webflow } from './webflow';
import { etsy } from './etsy';
import { square } from './square';
import { bigcartel } from './bigcartel';
import { godaddy } from './godaddy';
import { wordpress } from './wordpress';
import { ghost } from './ghost';
import { substack } from './substack';
import { framer } from './framer';
import { hubspot } from './hubspot';
import { salesforce } from './salesforce';
import { pipedrive } from './pipedrive';
import { mailchimp } from './mailchimp';
import { klaviyo } from './klaviyo';

export const VENDORS: readonly VendorAdapter[] = [
  shopify,
  woocommerce,
  bigcommerce,
  magento,
  squarespace,
  wix,
  webflow,
  etsy,
  square,
  bigcartel,
  godaddy,
  wordpress,
  ghost,
  substack,
  framer,
  hubspot,
  salesforce,
  pipedrive,
  mailchimp,
  klaviyo,
];

export type VendorSlug = (typeof VENDORS)[number]['slug'];

const bySlug = new Map(VENDORS.map((vendor) => [vendor.slug, vendor]));

export function getVendor(slug: string): VendorAdapter | undefined {
  return bySlug.get(slug);
}

/** Every source across every vendor, for detection and for the catalogue. */
export function allSources(): {
  vendor: VendorAdapter;
  source: VendorAdapter['sources'][number];
}[] {
  return VENDORS.flatMap((vendor) => vendor.sources.map((source) => ({ vendor, source })));
}

export function getSource(
  id: string
): { vendor: VendorAdapter; source: VendorAdapter['sources'][number] } | undefined {
  return allSources().find((entry) => entry.source.id === id);
}

export {
  shopify,
  woocommerce,
  bigcommerce,
  magento,
  squarespace,
  wix,
  webflow,
  etsy,
  square,
  bigcartel,
  godaddy,
  wordpress,
  ghost,
  substack,
  framer,
  hubspot,
  salesforce,
  pipedrive,
  mailchimp,
  klaviyo,
};
