// Inventory — knowing what you have and where it is.

import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  History,
  Layers,
  Link2,
  PackageCheck,
  PackageSearch,
  RefreshCw,
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
    keywords: ['analytics', 'value', 'ageing', 'turnover'],
    component: ReportsSurface,
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
