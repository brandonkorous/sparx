// Inventory — knowing what you have and where it is.

import {
  ArrowLeftRight,
  Barcode,
  BarChart3,
  Boxes,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  History,
  Layers,
  Link2,
  PackageCheck,
  PackageSearch,
  Grid3x3,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Truck,
  Warehouse,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { StockItemSurface } from '../../../surfaces/inventory/stock-item';
import { StockListSurface } from '../../../surfaces/inventory/stock-list';
import { LocationsListSurface } from '../../../surfaces/inventory/locations-list';
import { LocationDetailSurface } from '../../../surfaces/inventory/location-detail';
import { TransfersListSurface } from '../../../surfaces/inventory/transfers-list';
import { TransferDetailSurface } from '../../../surfaces/inventory/transfer-detail';
import { CountsListSurface } from '../../../surfaces/inventory/counts-list';
import { CountDetailSurface } from '../../../surfaces/inventory/count-detail';
import { MovementsListSurface } from '../../../surfaces/inventory/movements-list';
import { LotsListSurface } from '../../../surfaces/inventory/lots-list';
import { LotDetailSurface } from '../../../surfaces/inventory/lot-detail';
import { SuppliersListSurface } from '../../../surfaces/inventory/suppliers-list';
import { SupplierDetailSurface } from '../../../surfaces/inventory/supplier-detail';
import { PurchaseOrdersListSurface } from '../../../surfaces/inventory/purchase-orders-list';
import { PurchaseOrderDetailSurface } from '../../../surfaces/inventory/purchase-order-detail';
import { ReceivingListSurface } from '../../../surfaces/inventory/receiving-list';
import { ReceiptDetailSurface } from '../../../surfaces/inventory/receipt-detail';
import { ReorderListSurface } from '../../../surfaces/inventory/reorder-list';
import { ReportsSurface } from '../../../surfaces/inventory/reports';
import { SourcesListSurface } from '../../../surfaces/inventory/sources-list';
import { SourceDetailSurface } from '../../../surfaces/inventory/source-detail';
import { IntegritySurface } from '../../../surfaces/inventory/integrity';
import { ProvenanceSurface } from '../../../surfaces/inventory/provenance';
import { BinsListSurface } from '../../../surfaces/inventory/bins-list';
import { BinDetailSurface } from '../../../surfaces/inventory/bin-detail';
import { BinLabelsSurface } from '../../../surfaces/inventory/bin-labels';
import { BarcodesListSurface } from '../../../surfaces/inventory/barcodes-list';
import { BarcodeConflictsSurface } from '../../../surfaces/inventory/barcode-conflicts';
import { ProductLabelsSurface } from '../../../surfaces/inventory/product-labels';
import { DocumentLabelSurface } from '../../../surfaces/inventory/document-label';
import { ReceivingScanSurface } from '../../../surfaces/inventory/receiving-scan';
import { WarehouseModeSurface } from '../../../surfaces/inventory/warehouse-mode';

export const INVENTORY_SURFACES: SurfaceDefinition[] = [
  {
    // Unsectioned on purpose: stock is the module's landing surface, so it leads
    // the panel above the grouped sections (unsectioned surfaces sort first —
    // see nav.ts).
    key: 'inventory.stock.list',
    title: 'Stock',
    module: 'inventory',
    icon: Boxes,
    order: 1,
    keywords: ['on hand', 'levels', 'quantity', 'availability', 'low stock', 'reorder'],
    component: StockListSurface,
  },
  {
    key: 'inventory.stock.item',
    title: 'Stock item',
    module: 'inventory',
    icon: PackageSearch,
    component: StockItemSurface,
    // Reachable from the list, not the launcher — opening "an item's stock" with
    // no item in mind is not a thing anyone wants. There is no create
    // counterpart either: a stock level comes into existence by being counted,
    // received or sold, never by being declared.
    listed: false,
    // Docks comfortably beside the list it was opened from, which is the whole
    // point of shift-clicking a row.
    besideWidth: 0.45,
  },
  {
    // "Why is this number what it is." Opened BESIDE the quantity it explains —
    // a dialog would cover the very thing the person is asking about. Unlisted:
    // it is meaningless without an item and a location, so it is reached from a
    // number, never from the launcher.
    key: 'inventory.stock.provenance',
    title: 'Where this number came from',
    module: 'inventory',
    icon: ShieldCheck,
    component: ProvenanceSurface,
    listed: false,
    besideWidth: 0.4,
  },

  /* ── Where it lives ────────────────────────────────────────────────────── */
  {
    key: 'inventory.warehouses.list',
    title: 'Locations',
    module: 'inventory',
    icon: Warehouse,
    section: 'Where it lives',
    order: 10,
    keywords: ['warehouses', 'shops', 'sites', 'storage'],
    component: LocationsListSurface,
    createSurface: 'inventory.warehouses.detail',
    createLabel: 'New location',
  },
  {
    key: 'inventory.warehouses.detail',
    title: (params) => (params.id === 'new' ? 'New location' : 'Location'),
    module: 'inventory',
    icon: Warehouse,
    component: LocationDetailSurface,
    listed: false,
    besideWidth: 0.45,
  },
  {
    // Sits directly under Locations because a shelf lives inside one, and the
    // two are always set up together.
    key: 'inventory.bins.list',
    title: 'Shelves',
    module: 'inventory',
    icon: Grid3x3,
    section: 'Where it lives',
    order: 10.5,
    keywords: ['bins', 'racks', 'aisles', 'zones', 'put away', 'where is it', 'pick face'],
    component: BinsListSurface,
    createSurface: 'inventory.bins.detail',
    createLabel: 'New shelf',
  },
  {
    key: 'inventory.bins.detail',
    title: (params) => (params.id === 'new' ? 'New shelf' : 'Shelf'),
    module: 'inventory',
    icon: Grid3x3,
    component: BinDetailSurface,
    listed: false,
    besideWidth: 0.45,
  },
  {
    // Listed, unlike most detail surfaces: "print shelf labels" is a task
    // somebody sets out to do, not something they arrive at from a row.
    key: 'inventory.bins.labels',
    title: 'Shelf labels',
    module: 'inventory',
    icon: QrCode,
    section: 'Where it lives',
    order: 10.6,
    keywords: ['print', 'qr', 'barcode', 'label', 'sticker'],
    component: BinLabelsSurface,
    besideWidth: 0.55,
  },

  /* ── Scanning (docs/146 Phase 3) ──────────────────────────────────────── */

  {
    // The registry, and the screen that answers "can we scan yet". Its own
    // section rather than folded into "Where it lives": a barcode is about
    // identifying a thing, not locating it, and the two are different jobs
    // done by different people.
    key: 'inventory.barcodes.list',
    title: 'Barcodes',
    module: 'inventory',
    icon: Barcode,
    section: 'Scanning',
    order: 12,
    keywords: ['upc', 'ean', 'gtin', 'code 128', 'scan', 'sku', 'label'],
    component: BarcodesListSurface,
  },
  {
    // Listed, and deliberately: an unresolved conflict is the one thing that
    // stops scanning working, and a screen you can only reach from a banner is
    // a screen nobody checks.
    key: 'inventory.barcodes.conflicts',
    title: 'Shared barcodes',
    module: 'inventory',
    icon: CircleAlert,
    section: 'Scanning',
    order: 12.2,
    keywords: ['duplicate', 'conflict', 'clash', 'two items', 'same code'],
    component: BarcodeConflictsSurface,
    besideWidth: 0.5,
  },
  {
    key: 'inventory.barcodes.labels',
    title: 'Product labels',
    module: 'inventory',
    icon: Printer,
    section: 'Scanning',
    order: 12.4,
    keywords: ['print', 'sticker', 'barcode', 'code 128', 'upc'],
    component: ProductLabelsSurface,
    besideWidth: 0.55,
  },
  {
    // Addressed by the purchase order, because the receipt does not exist until
    // the session is posted. Unlisted: opening "scan a delivery" with no
    // delivery in mind is not a thing anyone wants — warehouse mode and the PO
    // are the two ways in.
    key: 'inventory.receiving.scan',
    title: 'Scan a delivery',
    module: 'inventory',
    icon: ScanLine,
    component: ReceivingScanSurface,
    listed: false,
  },
  {
    // The sticker that makes "scan the count sheet" true. Unlisted: it is always
    // about a specific document, and the four detail screens that own those
    // documents are the way in.
    key: 'inventory.documents.label',
    title: 'Print a label',
    module: 'inventory',
    icon: Printer,
    component: DocumentLabelSurface,
    listed: false,
    besideWidth: 0.45,
  },
  {
    // The phone-in-the-aisle surface. Listed, because somebody picking up a
    // tablet to go and work the floor is setting out to do exactly this.
    key: 'inventory.warehouse',
    title: 'Warehouse mode',
    module: 'inventory',
    icon: ScanLine,
    section: 'Scanning',
    order: 12.6,
    keywords: ['scan', 'phone', 'tablet', 'handheld', 'floor', 'gun', 'pick', 'put away'],
    component: WarehouseModeSurface,
  },

  {
    key: 'inventory.transfers.list',
    title: 'Transfers',
    module: 'inventory',
    icon: ArrowLeftRight,
    section: 'Where it lives',
    order: 11,
    keywords: ['move', 'between locations'],
    component: TransfersListSurface,
    createSurface: 'inventory.transfers.detail',
    createLabel: 'New transfer',
  },
  {
    key: 'inventory.transfers.detail',
    title: (params) => (params.id === 'new' ? 'New transfer' : 'Transfer'),
    module: 'inventory',
    icon: ArrowLeftRight,
    component: TransferDetailSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    key: 'inventory.counts.list',
    title: 'Stock counts',
    module: 'inventory',
    icon: ClipboardCheck,
    section: 'Where it lives',
    order: 12,
    keywords: ['stocktake', 'audit', 'physical count'],
    component: CountsListSurface,
    createSurface: 'inventory.counts.detail',
    createLabel: 'New count',
  },
  {
    key: 'inventory.counts.detail',
    title: (params) => (params.id === 'new' ? 'New count' : 'Stock count'),
    module: 'inventory',
    icon: ClipboardCheck,
    component: CountDetailSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    key: 'inventory.movements.list',
    title: 'Movements',
    module: 'inventory',
    icon: History,
    section: 'Where it lives',
    order: 13,
    keywords: ['history', 'ledger', 'changes', 'why'],
    component: MovementsListSurface,
  },
  {
    key: 'inventory.lots.list',
    title: 'Lots & serials',
    module: 'inventory',
    icon: Layers,
    section: 'Where it lives',
    order: 14,
    keywords: ['batch', 'serial number', 'expiry', 'traceability', 'recall', 'lot'],
    component: LotsListSurface,
  },
  {
    key: 'inventory.lots.detail',
    title: 'Batch',
    module: 'inventory',
    icon: Layers,
    component: LotDetailSurface,
    listed: false,
    besideWidth: 0.45,
  },

  /* ── Buying ────────────────────────────────────────────────────────────── */
  {
    key: 'inventory.suppliers.list',
    title: 'Suppliers',
    module: 'inventory',
    icon: Truck,
    section: 'Buying',
    order: 20,
    keywords: ['vendors', 'wholesalers'],
    component: SuppliersListSurface,
    createSurface: 'inventory.suppliers.detail',
    createLabel: 'New supplier',
  },
  {
    key: 'inventory.suppliers.detail',
    title: (params) => (params.id === 'new' ? 'New supplier' : 'Supplier'),
    module: 'inventory',
    icon: Truck,
    component: SupplierDetailSurface,
    listed: false,
    besideWidth: 0.45,
  },
  {
    key: 'inventory.purchase-orders.list',
    title: 'Purchase orders',
    module: 'inventory',
    icon: ClipboardList,
    section: 'Buying',
    order: 21,
    keywords: ['po', 'ordering', 'restock'],
    component: PurchaseOrdersListSurface,
    createSurface: 'inventory.purchase-orders.detail',
    createLabel: 'New purchase order',
  },
  {
    key: 'inventory.purchase-orders.detail',
    title: (params) => (params.id === 'new' ? 'New purchase order' : 'Purchase order'),
    module: 'inventory',
    icon: ClipboardList,
    component: PurchaseOrderDetailSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    key: 'inventory.receiving.list',
    title: 'Receiving',
    module: 'inventory',
    icon: PackageCheck,
    section: 'Buying',
    order: 22,
    keywords: ['delivery', 'goods in', 'check in'],
    component: ReceivingListSurface,
    createSurface: 'inventory.receiving.detail',
    createLabel: 'Receive a delivery',
  },
  {
    key: 'inventory.receiving.detail',
    title: (params) => (params.id === 'new' ? 'Receive a delivery' : 'Delivery'),
    module: 'inventory',
    icon: PackageCheck,
    component: ReceiptDetailSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    key: 'inventory.reorder',
    title: 'Reorder',
    module: 'inventory',
    icon: RefreshCw,
    section: 'Buying',
    order: 23,
    keywords: ['low stock', 'replenish', 'buy more'],
    component: ReorderListSurface,
  },

  /* ── Reporting / Setup ─────────────────────────────────────────────────── */
  {
    key: 'inventory.reports',
    title: 'Reports',
    module: 'inventory',
    icon: BarChart3,
    section: 'Reporting',
    order: 30,
    keywords: ['analytics', 'value', 'ageing', 'turnover', 'shrinkage', 'loss'],
    component: ReportsSurface,
  },
  {
    // Sits in Reporting rather than Setup because it is something you READ, and
    // it belongs next to the other numbers people come here to check.
    key: 'inventory.integrity',
    title: 'Integrity',
    module: 'inventory',
    icon: ShieldCheck,
    section: 'Reporting',
    order: 31,
    keywords: [
      'accuracy',
      'trust',
      'audit',
      'reconcile',
      'does it add up',
      'oversell',
      'stale',
      'drift',
      'wrong numbers',
    ],
    component: IntegritySurface,
  },
  {
    key: 'inventory.sources',
    title: 'Stock sources',
    module: 'inventory',
    icon: Link2,
    section: 'Setup',
    order: 40,
    keywords: ['feeds', 'sync', 'external'],
    component: SourcesListSurface,
    createSurface: 'inventory.sources.detail',
    createLabel: 'Add a source',
  },
  {
    key: 'inventory.sources.detail',
    title: (params) => (params.id === 'new' ? 'Add a source' : 'Stock source'),
    module: 'inventory',
    icon: Link2,
    component: SourceDetailSurface,
    listed: false,
    besideWidth: 0.45,
  },
];
