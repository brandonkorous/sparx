// Dropship vendor catalog — the selectable list of suppliers a tenant can
// connect, plus the per-vendor credential field spec that drives the dashboard
// "connect supplier" picker and form. (docs/14 §2–§4)
//
// This module is PURE DATA — it imports no adapter code and no `@wizeworks/db`, so
// the dashboard can import it from a client component via the `@wizeworks/dropship/
// vendors` subpath without pulling server-only dependencies into the bundle.
//
// Only vendors with a real, self-serve integration appear here. Suppliers
// without a usable public API (Tapstitch, PODPartner, Zendrop, AutoDS, Faire)
// are intentionally OMITTED rather than shown as dead "Connect" buttons — see
// the vendor-API verdict matrix in docs/14 §3.

import type { SupplierType } from './types.js';

/** A single credential input the merchant fills in when connecting a vendor. */
export interface VendorCredentialField {
  /** Key written into the supplier's `credentials` bag. */
  key: string;
  label: string;
  /** `password` masks the value; `url` validates as a URL. */
  type: 'text' | 'password' | 'url';
  placeholder?: string;
  /** Inline helper text shown under the field. */
  help?: string;
  required: boolean;
}

/** Which SupplierAdapter capabilities a vendor actually implements. */
export interface VendorCapabilities {
  catalogSync: boolean;
  orderSubmission: boolean;
  trackingSync: boolean;
  inventorySync: boolean;
}

export interface DropshipVendor {
  slug: SupplierType;
  label: string;
  /** One-line pitch shown on the picker card. */
  tagline: string;
  /** Longer description shown when the card is selected. */
  description: string;
  /**
   * `api` = automated REST integration (catalog/order/tracking over HTTP).
   * `manual` = feed import + hand-fulfilled orders (the CSV connector).
   */
  connectionMethod: 'api' | 'manual';
  /** Print-on-demand: made-to-order, no finite stock (inventory is unlimited). */
  pod: boolean;
  credentialFields: VendorCredentialField[];
  capabilities: VendorCapabilities;
  /** Where the merchant finds the credentials this vendor needs. */
  credentialsHelpUrl?: string;
}

const API_FULL: VendorCapabilities = {
  catalogSync: true,
  orderSubmission: true,
  trackingSync: true,
  inventorySync: true,
};

// POD suppliers are made-to-order, so there is no finite stock to sync.
const API_POD: VendorCapabilities = {
  catalogSync: true,
  orderSubmission: true,
  trackingSync: true,
  inventorySync: false,
};

export const VENDOR_CATALOG: DropshipVendor[] = [
  {
    slug: 'printify',
    label: 'Printify',
    tagline: 'Print-on-demand — broadest catalog, 90+ print providers',
    description:
      'Connect your Printify shop to import its products, route orders to Printify for fulfillment, and sync tracking. Best for a wide range of products (apparel, drinkware, accessories, home goods).',
    connectionMethod: 'api',
    pod: true,
    capabilities: API_POD,
    credentialsHelpUrl: 'https://printify.com/app/account/api',
    credentialFields: [
      {
        key: 'apiToken',
        label: 'Personal Access Token',
        type: 'password',
        placeholder: 'Paste your Printify API token',
        help: 'Printify → My account → Connections → Generate a Personal Access Token.',
        required: true,
      },
      {
        key: 'shopId',
        label: 'Shop ID',
        type: 'text',
        placeholder: 'Optional — leave blank to use your first shop',
        help: 'Only needed if your account has multiple Printify shops.',
        required: false,
      },
    ],
  },
  {
    slug: 'printful',
    label: 'Printful',
    tagline: 'Print-on-demand — premium quality, global fulfillment',
    description:
      'Connect your Printful store to import its sync products, submit orders for fulfillment, and sync shipment tracking. Apparel-led with strong print quality.',
    connectionMethod: 'api',
    pod: true,
    capabilities: API_POD,
    credentialsHelpUrl: 'https://developers.printful.com/',
    credentialFields: [
      {
        key: 'apiToken',
        label: 'API Token',
        type: 'password',
        placeholder: 'Paste your Printful API token',
        help: 'Printful → Settings → Developers → generate a private token with order + sync-product scopes.',
        required: true,
      },
      {
        key: 'storeId',
        label: 'Store ID',
        type: 'text',
        placeholder: 'Optional — only for account-level tokens',
        help: 'Required only when your token is account-scoped rather than store-scoped.',
        required: false,
      },
    ],
  },
  {
    slug: 'dsers',
    label: 'DSers',
    tagline: 'AliExpress dropshipping automation',
    description:
      'Connect DSers to import AliExpress-sourced products, route orders, and sync tracking and inventory.',
    connectionMethod: 'api',
    pod: false,
    capabilities: API_FULL,
    credentialsHelpUrl: 'https://help.dsers.com/api',
    credentialFields: [
      {
        key: 'apiToken',
        label: 'API Token',
        type: 'password',
        placeholder: 'Paste your DSers API token',
        required: true,
      },
      {
        key: 'storeId',
        label: 'Store ID',
        type: 'text',
        placeholder: 'e.g. 123456',
        required: true,
      },
    ],
  },
  {
    slug: 'spocket',
    label: 'Spocket',
    tagline: 'US/EU premium dropship suppliers',
    description:
      'Connect Spocket to import US/EU-based supplier products with faster shipping, route orders, and sync tracking.',
    connectionMethod: 'api',
    pod: false,
    capabilities: {
      catalogSync: true,
      orderSubmission: true,
      trackingSync: true,
      inventorySync: false,
    },
    credentialsHelpUrl: 'https://www.spocket.co/',
    credentialFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'Paste your Spocket API key',
        help: 'Found in your Spocket dashboard under Settings → API.',
        required: true,
      },
    ],
  },
  {
    slug: 'csv',
    label: 'CSV feed',
    tagline: 'Any supplier — import a product feed, fulfill orders manually',
    description:
      'For suppliers without an API: point sparx at a CSV product feed to import the catalog. Orders are fulfilled manually with your supplier (no automated submission or tracking).',
    connectionMethod: 'manual',
    pod: false,
    capabilities: {
      catalogSync: true,
      orderSubmission: false,
      trackingSync: false,
      inventorySync: true,
    },
    credentialFields: [
      {
        key: 'csvUrl',
        label: 'CSV feed URL',
        type: 'url',
        placeholder: 'https://supplier.example.com/catalog.csv',
        help: 'A publicly accessible URL. The first row must be a header row.',
        required: true,
      },
      {
        key: 'delimiter',
        label: 'Column delimiter',
        type: 'text',
        placeholder: ',',
        help: 'Leave blank for a standard comma-separated file.',
        required: false,
      },
      // Column mapping — each field is the exact header name (case-sensitive)
      // in the feed's first row. Product ID groups rows into one product with
      // multiple variants (e.g. one row per size/color); Title/SKU/Cost are
      // the minimum needed to import anything.
      {
        key: 'mapProductIdColumn',
        label: 'Column: Product ID',
        type: 'text',
        placeholder: 'e.g. product_id',
        help: 'Groups rows sharing this value into one product with multiple variants.',
        required: true,
      },
      {
        key: 'mapTitleColumn',
        label: 'Column: Title',
        type: 'text',
        placeholder: 'e.g. title',
        required: true,
      },
      {
        key: 'mapSkuColumn',
        label: 'Column: SKU',
        type: 'text',
        placeholder: 'e.g. sku',
        required: true,
      },
      {
        key: 'mapCostColumn',
        label: 'Column: Cost price',
        type: 'text',
        placeholder: 'e.g. cost',
        help: 'A dollar amount, e.g. "15.99".',
        required: true,
      },
      {
        key: 'mapDescriptionColumn',
        label: 'Column: Description',
        type: 'text',
        placeholder: 'e.g. description',
        required: false,
      },
      {
        key: 'mapCategoryColumn',
        label: 'Column: Category',
        type: 'text',
        placeholder: 'e.g. category',
        required: false,
      },
      {
        key: 'mapTagsColumn',
        label: 'Column: Tags',
        type: 'text',
        placeholder: 'e.g. tags',
        help: 'Comma-separated values within the cell.',
        required: false,
      },
      {
        key: 'mapImagesColumn',
        label: 'Column: Image URLs',
        type: 'text',
        placeholder: 'e.g. images',
        help: 'Pipe-separated URLs within the cell, e.g. "url1|url2".',
        required: false,
      },
      {
        key: 'mapMsrpColumn',
        label: 'Column: MSRP',
        type: 'text',
        placeholder: 'e.g. msrp',
        help: 'Used as the retail price when no pricing rule is set.',
        required: false,
      },
      {
        key: 'mapInventoryColumn',
        label: 'Column: Inventory quantity',
        type: 'text',
        placeholder: 'e.g. qty',
        required: false,
      },
      {
        key: 'mapWeightColumn',
        label: 'Column: Weight (grams)',
        type: 'text',
        placeholder: 'e.g. weight',
        required: false,
      },
      {
        key: 'mapColorColumn',
        label: 'Column: Color option',
        type: 'text',
        placeholder: 'e.g. color',
        required: false,
      },
      {
        key: 'mapSizeColumn',
        label: 'Column: Size option',
        type: 'text',
        placeholder: 'e.g. size',
        required: false,
      },
    ],
  },
];

export function getVendor(slug: string): DropshipVendor | undefined {
  return VENDOR_CATALOG.find((v) => v.slug === slug);
}

/** The slugs the connect flow offers — the source of truth for the type enum. */
export const SUPPORTED_VENDOR_SLUGS = VENDOR_CATALOG.map((v) => v.slug);
