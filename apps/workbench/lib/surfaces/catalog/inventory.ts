// Inventory — knowing what you have and where it is.

import {
  ArrowLeftRight,
  Barcode,
  BarChart3,
  Boxes,
  CalendarClock,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  Coins,
  History,
  Layers,
  Link2,
  PackageCheck,
  PackageSearch,
  Grid3x3,
  Gauge,
  PackageOpen,
  Printer,
  QrCode,
  RefreshCw,
  Route,
  ScanLine,
  Scale,
  CookingPot,
  Hammer,
  Ruler,
  ShieldCheck,
  SlidersHorizontal,
  Snail,
  Receipt,
  // Aliased because `ShieldCheck` is already the Integrity surface's icon, and
  // sign-offs are a different idea wearing the same glyph.
  ShieldCheck as ShieldSign,
  Undo2,
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
import { PickListsListSurface } from '../../../surfaces/inventory/pick-lists-list';
import { PickListDetailSurface } from '../../../surfaces/inventory/pick-list-detail';
import { PickGuidedSurface } from '../../../surfaces/inventory/pick-guided';
import { PackBenchSurface } from '../../../surfaces/inventory/pack-bench';
import { PickThroughputSurface } from '../../../surfaces/inventory/pick-throughput';
import { CostVarianceSurface } from '../../../surfaces/inventory/cost-variance';
import { CostingSettingsSurface } from '../../../surfaces/inventory/costing-settings';
import { UnitsListSurface } from '../../../surfaces/inventory/units-list';
import { BomsListSurface } from '../../../surfaces/inventory/boms-list';
import { BomDetailSurface } from '../../../surfaces/inventory/bom-detail';
import { AssembliesListSurface } from '../../../surfaces/inventory/assemblies-list';
import { AssemblyDetailSurface } from '../../../surfaces/inventory/assembly-detail';
import { PlanningSurface } from '../../../surfaces/inventory/planning';
import { PlanningClassesSurface } from '../../../surfaces/inventory/planning-classes';
import { PlanningIdleSurface } from '../../../surfaces/inventory/planning-idle';
import { PlanningHoldingSurface } from '../../../surfaces/inventory/planning-holding';
import { PlanningSettingsSurface } from '../../../surfaces/inventory/planning-settings';
import { PlanningExplainSurface } from '../../../surfaces/inventory/planning-explain';
import { CountSchedulesListSurface } from '../../../surfaces/inventory/count-schedules-list';
import { CountScheduleDetailSurface } from '../../../surfaces/inventory/count-schedule-detail';
// Supplier performance + procurement discipline (docs/146 Phase 8)
import { SupplierScorecardsSurface } from '../../../surfaces/inventory/supplier-scorecards';
import { LateOrdersSurface } from '../../../surfaces/inventory/late-orders';
import { PoApprovalsSurface } from '../../../surfaces/inventory/po-approvals';
import { PoApprovalRulesSurface } from '../../../surfaces/inventory/po-approval-rules';
import { PoApprovalRuleDetailSurface } from '../../../surfaces/inventory/po-approval-rule-detail';
import { AsnListSurface } from '../../../surfaces/inventory/asn-list';
import { AsnDetailSurface } from '../../../surfaces/inventory/asn-detail';
import { SupplierReturnsListSurface } from '../../../surfaces/inventory/supplier-returns-list';
import { SupplierReturnDetailSurface } from '../../../surfaces/inventory/supplier-return-detail';
import { SupplierBillsListSurface } from '../../../surfaces/inventory/supplier-bills-list';
import { SupplierBillDetailSurface } from '../../../surfaces/inventory/supplier-bill-detail';

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

  /* ── Buying, the other side of it (docs/146 Phase 8) ──────────────────────
     Everything above is about placing an order. These are about the party at the
     other end: what they said they shipped, what came back, what they billed,
     and whether anybody had to sign for the spend. Deliberately separate
     surfaces rather than tabs on the purchase-order pane — the pane strip is
     already the tab bar, and "sign-offs beside overdue" is an arrangement a
     buyer genuinely wants. */
  {
    key: 'inventory.purchase-orders.approvals',
    title: 'Sign-offs',
    module: 'inventory',
    icon: ShieldSign,
    section: 'Buying',
    order: 23.5,
    keywords: [
      'approval',
      'authorise',
      'authorize',
      'sign off',
      'permission',
      'spending limit',
      'waiting',
      'pending approval',
    ],
    component: PoApprovalsSurface,
  },
  {
    key: 'inventory.purchase-orders.late',
    title: 'Overdue deliveries',
    module: 'inventory',
    icon: CalendarClock,
    section: 'Buying',
    order: 23.6,
    keywords: [
      'late',
      'overdue',
      'chase',
      'not arrived',
      'where is my order',
      'supplier late',
      'missing delivery',
    ],
    component: LateOrdersSurface,
  },
  {
    key: 'inventory.advance-ship-notices',
    title: 'On the way',
    module: 'inventory',
    icon: Truck,
    section: 'Buying',
    order: 23.7,
    keywords: [
      'asn',
      'advance ship notice',
      'shipment',
      'dispatched',
      'in transit',
      'tracking',
      'what is coming',
    ],
    component: AsnListSurface,
  },
  {
    key: 'inventory.advance-ship-notices.detail',
    title: 'Shipment',
    module: 'inventory',
    icon: Truck,
    component: AsnDetailSurface,
    listed: false,
    besideWidth: 0.45,
  },
  {
    key: 'inventory.supplier-returns',
    title: 'Sent back',
    module: 'inventory',
    icon: Undo2,
    section: 'Buying',
    order: 23.8,
    keywords: [
      'rtv',
      'return to vendor',
      'return to supplier',
      'credit note',
      'faulty',
      'damaged',
      'send back',
      'owed',
    ],
    component: SupplierReturnsListSurface,
    createSurface: 'inventory.supplier-returns.detail',
    createLabel: 'Send something back',
  },
  {
    key: 'inventory.supplier-returns.detail',
    title: (params) => (params.id === 'new' ? 'Send something back' : 'Return'),
    module: 'inventory',
    icon: Undo2,
    component: SupplierReturnDetailSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    key: 'inventory.supplier-bills',
    title: 'Bills to pay',
    module: 'inventory',
    icon: Receipt,
    section: 'Buying',
    order: 23.9,
    keywords: [
      'invoice',
      'supplier invoice',
      'accounts payable',
      'three way match',
      'overcharged',
      'what do we owe',
      'pay',
    ],
    component: SupplierBillsListSurface,
    createSurface: 'inventory.supplier-bills.detail',
    createLabel: 'Enter an invoice',
  },
  {
    key: 'inventory.supplier-bills.detail',
    title: (params) => (params.id === 'new' ? 'Enter an invoice' : 'Supplier invoice'),
    module: 'inventory',
    icon: Receipt,
    component: SupplierBillDetailSurface,
    listed: false,
    besideWidth: 0.55,
  },

  /* ── Getting it out of the door (docs/146 Phase 4) ─────────────────────── */
  {
    // "Walk" rather than "pick list": the people using this are not
    // warehouse-systems people, and a walk is what it physically IS. The URL and
    // the API keep `pick-list`, which IS the industry term and is what an
    // integrator should not have to relearn.
    key: 'inventory.picking.list',
    title: 'Walks',
    module: 'inventory',
    icon: Route,
    section: 'Going out',
    order: 25,
    keywords: [
      'pick list',
      'picking',
      'pick',
      'fetch',
      'route',
      'wave',
      'batch',
      'fulfil',
      'orders to pick',
    ],
    component: PickListsListSurface,
  },
  {
    key: 'inventory.picking.detail',
    title: 'Walk',
    module: 'inventory',
    icon: Route,
    component: PickListDetailSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    // The picker's screen: one instruction, enormous, scan-first. Unlisted
    // because it is meaningless without a walk, and reached from the walk or
    // from warehouse mode — which is where somebody about to go and do it is.
    key: 'inventory.picking.guided',
    title: 'Picking',
    module: 'inventory',
    icon: ScanLine,
    component: PickGuidedSurface,
    listed: false,
  },
  {
    // Listed, unlike most order-scoped surfaces: "go and pack" is a station
    // somebody stands at for a shift, not a thing they arrive at from a row.
    key: 'inventory.packing.bench',
    title: 'Pack bench',
    module: 'inventory',
    icon: PackageOpen,
    section: 'Going out',
    order: 26,
    keywords: ['pack', 'box', 'parcel', 'packing slip', 'ship', 'verify', 'carton'],
    component: PackBenchSurface,
  },
  {
    key: 'inventory.picking.throughput',
    title: 'Pick & pack throughput',
    module: 'inventory',
    icon: Gauge,
    section: 'Reporting',
    order: 32,
    keywords: [
      'units per hour',
      'productivity',
      'accuracy',
      'short pick',
      'picker',
      'packer',
      'how fast',
    ],
    component: PickThroughputSurface,
  },
  {
    // Named for the question, not the accounting term. "Purchase price variance"
    // is what it is called in a textbook; "cost vs plan" is what someone typing
    // into the command palette at 9am is actually looking for — so the title is
    // the second and the keywords carry the first.
    key: 'inventory.costing.variance',
    title: 'Cost vs plan',
    module: 'inventory',
    icon: Scale,
    section: 'Reporting',
    order: 33,
    keywords: [
      'purchase price variance',
      'ppv',
      'standard cost',
      'overpaying',
      'supplier price',
      'budget',
      'what it cost',
      'landed cost',
    ],
    component: CostVarianceSurface,
  },

  /* ── Making things (docs/146 Phase 6) ──────────────────────────────────── */
  {
    // "Recipes" and not "bills of materials": that is what they are, and the
    // person setting one up in a workshop has never used the other phrase. The
    // industry term is in the keywords so the palette still finds it.
    key: 'inventory.boms.list',
    title: 'Recipes',
    module: 'inventory',
    icon: CookingPot,
    section: 'Making',
    order: 27,
    keywords: [
      'bill of materials',
      'bom',
      'kit',
      'assembly',
      'components',
      'what it is made of',
      'build',
      'manufacture',
      'recipe',
    ],
    component: BomsListSurface,
    createSurface: 'inventory.boms.detail',
    createLabel: 'Write a recipe',
  },
  {
    key: 'inventory.boms.detail',
    title: (params) => (params.id === 'new' ? 'New recipe' : 'Recipe'),
    module: 'inventory',
    icon: CookingPot,
    component: BomDetailSurface,
    listed: false,
  },
  {
    key: 'inventory.assemblies.list',
    title: 'Runs',
    module: 'inventory',
    icon: Hammer,
    section: 'Making',
    order: 28,
    keywords: [
      'assembly order',
      'build',
      'make',
      'production',
      'work order',
      'disassemble',
      'take apart',
      'batch',
    ],
    component: AssembliesListSurface,
    createSurface: 'inventory.assemblies.detail',
    createLabel: 'Plan a run',
  },
  {
    key: 'inventory.assemblies.detail',
    title: (params) => (params.id === 'new' ? 'Plan a run' : 'Run'),
    module: 'inventory',
    icon: Hammer,
    component: AssemblyDetailSurface,
    listed: false,
  },

  /* ── Planning ──────────────────────────────────────────────────────────────
     Five surfaces, not one surface with five tabs. The pane strip along the top
     of the window is already a tab bar, so an in-surface tab strip is tabs on
     tabs — and it would also forbid the arrangement a buyer actually wants,
     which is "At risk" docked beside "Not selling". Each question gets its own
     dockable, deep-linkable, tear-off-able pane; planning-shell.tsx holds the
     chrome they share. */
  {
    // Its own section rather than under Reporting: everything in Reporting
    // describes what HAS happened, and every one of these describes what is
    // about to. A buyer opens these to decide, not to check.
    key: 'inventory.planning',
    title: 'At risk',
    module: 'inventory',
    icon: Gauge,
    section: 'Planning',
    order: 32,
    keywords: [
      'planning',
      'forecast',
      'demand',
      'reorder point',
      'safety stock',
      'service level',
      'stockout',
      'days of cover',
      'running out',
      'what should i buy',
    ],
    component: PlanningSurface,
  },
  {
    key: 'inventory.planning.classes',
    title: 'What matters',
    module: 'inventory',
    icon: Scale,
    section: 'Planning',
    order: 33,
    keywords: [
      'abc',
      'xyz',
      'classification',
      'ranking',
      'top value',
      'long tail',
      'steady',
      'erratic',
      'where the money is',
    ],
    component: PlanningClassesSurface,
  },
  {
    key: 'inventory.planning.idle',
    title: 'Not selling',
    module: 'inventory',
    icon: Snail,
    section: 'Planning',
    order: 34,
    keywords: [
      'dead stock',
      'overstock',
      'slow moving',
      'obsolete',
      'excess',
      'cash tied up',
      'not moving',
    ],
    component: PlanningIdleSurface,
  },
  {
    key: 'inventory.planning.holding',
    title: 'Cost to keep',
    module: 'inventory',
    icon: Coins,
    section: 'Planning',
    order: 35,
    keywords: [
      'holding cost',
      'carrying cost',
      'storage cost',
      'cost of capital',
      'what stock costs',
    ],
    component: PlanningHoldingSurface,
  },
  {
    key: 'inventory.planning.explain',
    title: 'Why this number',
    module: 'inventory',
    icon: Gauge,
    component: PlanningExplainSurface,
    listed: false,
    besideWidth: 0.45,
  },
  {
    key: 'inventory.count-schedules',
    title: 'Counting schedules',
    module: 'inventory',
    icon: CalendarClock,
    section: 'Planning',
    order: 36,
    keywords: [
      'cycle count',
      'count schedule',
      'recurring count',
      'stocktake',
      'blind count',
      'how often to count',
    ],
    component: CountSchedulesListSurface,
    createSurface: 'inventory.count-schedules.detail',
    createLabel: 'New schedule',
  },
  {
    key: 'inventory.count-schedules.detail',
    title: (params) => (params.id === 'new' ? 'New counting schedule' : 'Counting schedule'),
    module: 'inventory',
    icon: CalendarClock,
    component: CountScheduleDetailSurface,
    listed: false,
    besideWidth: 0.45,
  },
  {
    // Last in the section, because it is the only one you visit once. Tenant-wide,
    // so it carries no location filter.
    key: 'inventory.planning.settings',
    title: 'Planning settings',
    module: 'inventory',
    icon: SlidersHorizontal,
    section: 'Planning',
    order: 37,
    keywords: [
      'service level',
      'holding cost rate',
      'carrying rate',
      'dead stock days',
      'overstock days',
      'automatic reorder levels',
    ],
    component: PlanningSettingsSurface,
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
    // Reporting rather than Buying: it is something you READ about people you
    // already buy from, and it belongs next to the other numbers.
    key: 'inventory.suppliers.scorecards',
    title: 'Supplier performance',
    module: 'inventory',
    icon: Gauge,
    section: 'Reporting',
    order: 34,
    keywords: [
      'scorecard',
      'on time',
      'fill rate',
      'in full',
      'otif',
      'supplier quality',
      'league table',
      'who is reliable',
      'vendor performance',
    ],
    component: SupplierScorecardsSurface,
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
    // Setup rather than Reporting: it is a decision you make once with your
    // accountant, and it changes how every figure in Reporting is computed.
    key: 'inventory.costing.settings',
    title: 'How stock is valued',
    module: 'inventory',
    icon: Scale,
    section: 'Setup',
    order: 39,
    keywords: [
      'costing',
      'fifo',
      'average cost',
      'standard cost',
      'valuation method',
      'currency',
      'landed cost',
      'freight allocation',
    ],
    component: CostingSettingsSurface,
  },
  {
    // Setup, because it is vocabulary you write once: the words your business
    // counts in. What each one CONTAINS is per item, and lives on the item.
    key: 'inventory.units',
    title: 'Units',
    module: 'inventory',
    icon: Ruler,
    section: 'Setup',
    order: 38,
    keywords: [
      'unit of measure',
      'uom',
      'case',
      'box',
      'pack',
      'pair',
      'dozen',
      'pallet',
      'kilogram',
      'each',
      'conversion',
    ],
    component: UnitsListSurface,
  },
  {
    // Setup, because it is a policy you write once and it changes what happens
    // to every order after it.
    key: 'inventory.purchase-orders.approval-rules',
    title: 'Spending limits',
    module: 'inventory',
    icon: ShieldSign,
    section: 'Setup',
    order: 38.5,
    keywords: [
      'approval rule',
      'authorisation',
      'authorization',
      'purchase limit',
      'spending control',
      'who can buy',
      'sign off threshold',
    ],
    component: PoApprovalRulesSurface,
  },
  {
    key: 'inventory.purchase-orders.approval-rules.detail',
    title: (params) => (params.id === 'new' ? 'New spending limit' : 'Spending limit'),
    module: 'inventory',
    icon: ShieldSign,
    component: PoApprovalRuleDetailSurface,
    listed: false,
    besideWidth: 0.45,
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
