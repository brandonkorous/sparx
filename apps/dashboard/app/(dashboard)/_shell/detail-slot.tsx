import 'server-only';
import * as React from 'react';
import { ModuleProvider, Skeleton, type SparxModule } from '@sparx/ui';
import { requireSession } from '@sparx/auth';
import { api } from '@/lib/api-rest-client';
import {
  CREATE_SENTINEL,
  isFullBleedCreate,
  isFullBleedDetail,
  parseDetailToken,
} from './detail-registry';
import { ProductWizard } from '../commerce/products/_components/product-wizard';
import { CustomerFullProfileWizard } from '../crm/customers/new/customer-full-profile-wizard';
import { loadPipelineOptions } from '../crm/customers/new/pipeline-options';
import { loadQuoteWorkflowId } from '../crm/customers/new/quote-workflow-option';
import { B2bAccountWizard } from '../b2b/accounts/new/b2b-account-wizard';
import { ContentEntryWizard } from '../cms/content/new/content-entry-wizard';
import { loadAuthorOptions } from '../cms/content/new/author-options';
import { InvoiceWizard } from '../invoicing/documents/new/_components/invoice-wizard';
import { loadInvoiceWizardData } from '../invoicing/documents/new/wizard-data';
import { OrderWizard } from '../crm/orders/new/_components/order-wizard';
import { loadOrderWizardData } from '../crm/orders/new/wizard-data';
import { PurchaseOrderWizard } from '../inventory/purchase-orders/new/_components/purchase-order-wizard';
import { loadPurchaseOrderWizardData } from '../inventory/purchase-orders/new/wizard-data';
import { TransferWizard } from '../inventory/transfers/new/_components/transfer-wizard';
import { loadTransferWizardData } from '../inventory/transfers/new/wizard-data';
import { CategoryCreateForm } from '../commerce/categories/_components/category-create-form';
import { loadCategoryParents } from '../commerce/categories/_components/category-parent-options';
import { CollectionCreateForm } from '../commerce/collections/_components/collection-create-form';
import { WarehouseCreateForm } from '../inventory/warehouses/_components/warehouse-create-form';
import { PriceListCreateForm } from '../commerce/pricing/_components/price-list-create-form';
import { loadPriceListTargetingOptions } from '../commerce/pricing/_lib/targeting-options';
import { SegmentCreateForm } from '../crm/segments/_components/segment-create-form';
import { NewDealForm } from '../crm/deals/new/_components/new-deal-form';
import { NewTaskForm } from '../crm/tasks/new/_components/new-task-form';
import { NewPipelineForm } from '../crm/pipelines/new/_components/new-pipeline-form';
import { SupplierCreateForm } from '../inventory/suppliers/_components/supplier-create-form';
import { LotCreateForm } from '../inventory/lots/new/_components/lot-create-form';
import { CountCreateForm } from '../inventory/counts/new/_components/count-create-form';
import { NewWorkflowForm } from '../invoicing/workflows/new/_components/new-workflow-form';
import { PageCreateForm } from '../cms/_components/page-create-form';
import { ContentTypeCreateForm } from '../cms/types/_components/content-type-create-form';
import { IssueGiftCardForm } from '../commerce/gift-cards/_components/issue-gift-card-form';
import { GrantAccountCreditForm } from '../commerce/account-credit/_components/grant-account-credit-form';
import { AuthorCreateForm } from '../cms/authors/author-create-form';
import { TaxonomyCreateForm } from '../cms/taxonomy/taxonomy-create-form';
import { RedirectCreateForm } from '../cms/redirects/_components/redirect-create-form';
import { AddSuppressionForm } from '../email/suppressions/_components/add-suppression-form';
import { AddDomainForm } from '../email/domains/_components/add-domain-form';
import { DiscountCreateForm } from '../commerce/discounts/_components/discount-create-form';
import { BundleEditor } from '../commerce/bundles/_components/bundle-editor';
import { loadBundleCreateData } from '../commerce/bundles/_components/bundle-create-data';
import { NewZoneForm } from '../commerce/shipping/zones/new/_components/new-zone-form';
import { NewProfileForm } from '../commerce/shipping/profiles/new/_components/new-profile-form';
import { NewTaxZoneForm } from '../commerce/tax/zones/new/_components/new-tax-zone-form';
import { NewTemplateForm } from '../commerce/configurator/new/_components/new-template-form';
import { loadConfiguratorProducts } from '../commerce/configurator/new/_components/configurator-create-data';
import { ServiceForm } from '../scheduling/services/_components/service-form';
import { ResourceForm } from '../scheduling/resources/_components/resource-form';
import { PolicyForm } from '../scheduling/policies/_components/policy-form';
import { BookingForm } from '../scheduling/bookings/_components/booking-form';
import type { SchedulingService } from '../scheduling/_lib/types';
import { TierCreateForm } from '../b2b/pricing-tiers/_components/tier-create-form';
import { SourceForm } from '../inventory/sources/_components/source-form';
import {
  SupplierForm,
  type Vendor,
  type SiteOption,
} from '../dropship/suppliers/_components/supplier-form';
import { listProperties } from '@/lib/sites';
import { AuthorDetailContent } from '../cms/authors/[id]/_content';
import { ContentTypeDetailContent } from '../cms/types/[typeKey]/_content';
import { ContentEntryDetailContent } from '../cms/types/[typeKey]/[id]/_content';
import { CmsPageDetailContent } from '../cms/[id]/_content';
import { MediaAssetDetailContent } from '../cms/media/[id]/_content';
import { MenuDetailContent } from '../cms/navigation/menu-detail';
import { TaxonomyDetailContent } from '../cms/taxonomy/[key]/_content';
import { B2bAccountDetailContent } from '../crm/b2b/[id]/_content';
import { CustomerDetailContent } from '../crm/customers/[id]/_content';
import { DealDetailContent } from '../crm/deals/[id]/_content';
import { OrderDetailContent } from '../crm/orders/[id]/_content';
import { SegmentDetailContent } from '../crm/segments/[id]/_content';
import { BundleDetailContent } from '../commerce/bundles/[id]/_content';
import { CartDetailContent } from '../commerce/carts/[id]/_content';
import { CategoryDetailContent } from '../commerce/categories/[id]/_content';
import { CollectionDetailContent } from '../commerce/collections/[id]/_content';
import { ConfiguratorTemplateDetailContent } from '../commerce/configurator/[id]/_content';
import { PriceListDetailContent } from '../commerce/pricing/[id]/_content';
import { ProductDetailContent } from '../commerce/products/[id]/_content';
import { ProviderInstallationDetailContent } from '../commerce/providers/[id]/_content';
import { QuestionDetailContent } from '../commerce/qa/[id]/_content';
import { ReturnDetailContent } from '../commerce/returns/[id]/_content';
import { ReviewDetailContent } from '../commerce/reviews/[id]/_content';
import { ShippingProfileDetailContent } from '../commerce/shipping/profiles/[id]/_content';
import { ShippingZoneDetailContent } from '../commerce/shipping/zones/[id]/_content';
import { SubscriptionDetailContent } from '../commerce/subscriptions/[id]/_content';
import { TaxZoneDetailContent } from '../commerce/tax/zones/[id]/_content';
import { WarehouseDetailContent } from '../inventory/warehouses/[id]/_content';
import { ComponentDetailContent } from '../builder/components/[type]/_content';
import { BookingDetailContent } from '../scheduling/bookings/[id]/_content';
import { SiteDetailContent } from '../settings/sites/[id]/_content';
import { NewSiteWizard } from '../settings/sites/new-site-wizard';
import { loadNewSiteData } from '../settings/sites/new/wizard-data';

// Server-only registry mapping a manifest entity type id → its detail content
// component. These are React Server Components that fetch their own data
// (session, REST, DB), so they can only ever be rendered on the server — the
// `@detail` parallel route is the single place that does so.
//
// The `server-only` import above is a tripwire: if anything in the client
// graph ever imports this module, the build fails loudly here instead of
// surfacing as an opaque "next/headers in a Client Component" error.

type DetailComponent = React.ComponentType<{ id: string }>;

const detailComponents: Record<string, DetailComponent> = {
  // CMS
  page: CmsPageDetailContent,
  media: MediaAssetDetailContent,
  author: AuthorDetailContent,
  taxonomy: TaxonomyDetailContent,
  menu: MenuDetailContent,
  'content-type': ContentTypeDetailContent,
  'content-entry': ContentEntryDetailContent,
  // CRM
  customer: CustomerDetailContent,
  'b2b-account': B2bAccountDetailContent,
  deal: DealDetailContent,
  order: OrderDetailContent,
  segment: SegmentDetailContent,
  // Commerce
  product: ProductDetailContent,
  category: CategoryDetailContent,
  collection: CollectionDetailContent,
  warehouse: WarehouseDetailContent,
  review: ReviewDetailContent,
  'qa-question': QuestionDetailContent,
  subscription: SubscriptionDetailContent,
  return: ReturnDetailContent,
  bundle: BundleDetailContent,
  cart: CartDetailContent,
  'provider-installation': ProviderInstallationDetailContent,
  'price-list': PriceListDetailContent,
  'configurator-template': ConfiguratorTemplateDetailContent,
  'shipping-profile': ShippingProfileDetailContent,
  'shipping-zone': ShippingZoneDetailContent,
  'tax-zone': TaxZoneDetailContent,
  // Builder
  'builder-component': ComponentDetailContent,
  // Settings — hosted on the builder/ai manifests (settings is not a module).
  site: SiteDetailContent,
  // Scheduling
  booking: BookingDetailContent,
};

// Each entity type's owning module. The `@detail` slot renders OUTSIDE any
// module `layout.tsx`, so without this the drawer/modal content inherits the
// `:root` default of `--module-active` (storefront indigo) — the Publish
// button, section rules, and badges all come out indigo regardless of which
// module the record belongs to. Wrapping the content in the right
// ModuleProvider restores the correct accent (CMS teal, CRM cyan, etc.).
const detailModules: Record<string, SparxModule> = {
  // CMS
  page: 'cms',
  media: 'cms',
  author: 'cms',
  taxonomy: 'cms',
  menu: 'cms',
  'content-type': 'cms',
  'content-entry': 'cms',
  // CMS — create-only overlays (no detail view)
  redirect: 'cms',
  // Invoicing — create-only overlay (the document editor stays full-page)
  'billing-document': 'invoicing',
  // Workflow create-only overlay (the stage editor stays full-page).
  workflow: 'invoicing',
  // Email — create-only overlays (no detail view)
  'sending-domain': 'email',
  suppression: 'email',
  // CRM
  customer: 'crm',
  'b2b-account': 'crm',
  deal: 'crm',
  order: 'crm',
  segment: 'crm',
  // Task create-only overlay (no detail view) — wears the crm accent.
  task: 'crm',
  // Pipeline create-only overlay (detail is a full-width Kanban, not a drawer) —
  // wears the crm accent.
  pipeline: 'crm',
  // Commerce
  product: 'commerce',
  category: 'commerce',
  collection: 'commerce',
  // Warehouse is an inventory-module entity now (docs/100 P1e) — its overlay
  // chrome wears the inventory accent even though it's reachable from commerce.
  warehouse: 'inventory',
  // Inventory — create-only overlays (the PO / transfer editors stay full-page)
  'purchase-order': 'inventory',
  transfer: 'inventory',
  // Supplier create-only overlay (detail is a wide full-page surface, not a drawer).
  supplier: 'inventory',
  // Lot create-only overlay (the lot detail manages serials + recalls full-page).
  lot: 'inventory',
  // Count create-only overlay (the count detail — quantity entry — is full-page).
  count: 'inventory',
  review: 'commerce',
  'qa-question': 'commerce',
  subscription: 'commerce',
  return: 'commerce',
  bundle: 'commerce',
  cart: 'commerce',
  'provider-installation': 'commerce',
  'price-list': 'commerce',
  'configurator-template': 'commerce',
  'shipping-profile': 'commerce',
  'shipping-zone': 'commerce',
  'tax-zone': 'commerce',
  // Commerce — create-only overlays (no detail view)
  'gift-card': 'commerce',
  'account-credit': 'commerce',
  discount: 'commerce',
  // Scheduling — service/resource/policy are create-only overlays (lists edit via
  // a self-owned modal); booking ALSO has a detail view (registered above).
  service: 'scheduling',
  resource: 'scheduling',
  'booking-policy': 'scheduling',
  booking: 'scheduling',
  // B2B — create-only overlays (lists edit via a self-owned modal / are read-only)
  'b2b-service-type': 'b2b',
  'b2b-pricing-tier': 'b2b',
  // Inventory — connect-a-source create overlay (edits via a self-owned modal)
  'inventory-source': 'inventory',
  // Dropship — connect-a-supplier create overlay (edits via a self-owned modal)
  'dropship-supplier': 'dropship',
  // Builder
  'builder-component': 'builder',
  // Settings — sites (+ domains) are Builder-owned; api keys are AI-owned.
  site: 'builder',
};

// Create-form registry, parallel to `detailComponents`. Keyed by the same
// manifest entity-type id, rendered when the detail token carries the
// `CREATE_SENTINEL` id (`?drawer=collection:new`). These are the
// `surface="overlay"` create forms — the same components the `/new` route
// renders `surface="page"`. A type opts into overlay-create by registering
// here AND being listed in `CREATE_VIEW_TYPES` (detail-registry.ts) — the
// client-safe set `EntityCreateButton` reads to decide drawer/modal-vs-
// fullPage. Keep the two in sync; types absent from the set fall back to the
// full-page `/new` route.
//
// Forms needing server-fetched data (e.g. select options) would register a
// thin server wrapper that fetches then renders the client form — these are
// all self-contained, so they register directly.
// Content-entry create is the SurfaceFrame, but its type-picker step needs the
// tenant's content types — so it registers a thin server wrapper that fetches
// them (the documented pattern for create overlays needing server data). The
// overlay always starts at the type picker; the `/new` route carries any
// `?type=` preselection instead.
interface ContentTypeSummary {
  key: string;
  name: string;
  plural_name: string;
  description: string | null;
  is_singleton: boolean;
}

// Customer create is the SurfaceFrame; its optional follow-up task is assigned to
// the current user and its optional deal needs the tenant's pipelines, so a thin
// server wrapper resolves the session + pipelines and passes them through.
async function CustomerCreateOverlay() {
  const [session, pipelines, quoteWorkflowId] = await Promise.all([
    requireSession(),
    loadPipelineOptions(),
    loadQuoteWorkflowId(),
  ]);
  return (
    <CustomerFullProfileWizard
      presentation="overlay"
      currentUserId={session.user.id}
      pipelines={pipelines}
      quoteWorkflowId={quoteWorkflowId}
    />
  );
}

// Deal create is the single-step SurfaceFrame; its pipeline + stage pickers and
// optional customer need the tenant's pipelines (with stages) + a customer slice,
// so a thin server wrapper resolves them (mirrors the /new route's fetch). No
// `?pipelineId=` preselection here — the /new route carries deep-link preselection
// instead. A created deal opens into its detail view.
interface DealPipelineRow {
  id: string;
  name: string;
  stages: {
    id: string;
    name: string;
    probability: string | number;
    stageType: 'open' | 'won' | 'lost';
  }[];
}
interface DealCustomerRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}
async function DealCreateOverlay() {
  const [pipelines, customersPaged] = await Promise.all([
    api.get<DealPipelineRow[]>('/v1/crm/pipelines?take=250'),
    api.getPaged<DealCustomerRow[]>('/v1/crm/customers?take=200&sort_by=updatedAt'),
  ]);
  return (
    <NewDealForm
      surface="overlay"
      pipelines={pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        stages: p.stages.map((s) => ({
          id: s.id,
          name: s.name,
          probability: Number(s.probability),
          stageType: s.stageType,
        })),
      }))}
      customers={customersPaged.data.map((c) => ({
        id: c.id,
        label:
          [c.firstName, c.lastName].filter(Boolean).join(' ') ||
          (c.company ?? c.email ?? c.id.slice(0, 8)),
      }))}
      initialPipelineId={pipelines[0]?.id ?? null}
    />
  );
}

// Task create is single-step; tasks have no detail view, so a created task returns
// to the list. The assignee + customer pickers need the tenant's users + customers
// and the current user (the default assignee), so a thin server wrapper resolves
// them (mirrors the /new route's fetch). No preselection in the overlay.
interface TaskUserRow {
  id: string;
  name: string | null;
  email: string | null;
}
async function TaskCreateOverlay() {
  const [session, customersPaged, users] = await Promise.all([
    requireSession(),
    api.getPaged<DealCustomerRow[]>('/v1/crm/customers?take=200'),
    api.get<TaskUserRow[]>('/v1/users?take=100'),
  ]);
  return (
    <NewTaskForm
      surface="overlay"
      currentUserId={session.user.id}
      users={users.map((u) => ({ id: u.id, label: u.name ?? u.email ?? u.id.slice(0, 8) }))}
      customers={customersPaged.data.map((c) => ({
        id: c.id,
        label:
          [c.firstName, c.lastName].filter(Boolean).join(' ') ||
          (c.company ?? c.email ?? c.id.slice(0, 8)),
      }))}
      preselectedCustomerId={null}
      preselectedDealId={null}
    />
  );
}

// Category create needs the existing tree to seed its parent picker, so a thin
// server wrapper loads + flattens it (the documented pattern for create
// overlays needing server data).
async function CategoryCreateOverlay() {
  const parents = await loadCategoryParents();
  return <CategoryCreateForm surface="overlay" parents={parents} />;
}

// Billing-document create is the multi-step SurfaceFrame. Its detail/editor is a
// wide, interactive full-page surface (no detail-view drawer), but CREATION opts
// into the overlay so the user's `defaultDetailView` picks the style. The wizard
// needs the tenant's workflows, parties, line types and markup rules, so a thin
// server wrapper resolves them. No `?customerId=` preselection here — the /new
// route carries deep-link preselection instead.
async function BillingDocumentCreateOverlay() {
  const data = await loadInvoiceWizardData();
  return <InvoiceWizard presentation="overlay" {...data} />;
}

// Order create is the multi-step SurfaceFrame; a created order opens into its
// detail view. The customer picker needs the tenant's customers.
async function OrderCreateOverlay() {
  const data = await loadOrderWizardData();
  return <OrderWizard presentation="overlay" {...data} />;
}

// Purchase-order + transfer create are multi-step SurfaceFrames; their editors are
// wide full-page surfaces (no detail-view drawer), so only CREATION opens in the
// overlay. Each needs its option lists (suppliers / warehouses). The wizards guard
// on missing options themselves.
async function PurchaseOrderCreateOverlay() {
  const data = await loadPurchaseOrderWizardData();
  return <PurchaseOrderWizard presentation="overlay" {...data} />;
}

async function TransferCreateOverlay() {
  const data = await loadTransferWizardData();
  return <TransferWizard presentation="overlay" {...data} />;
}

async function ContentEntryCreateOverlay() {
  let types: ContentTypeSummary[] = [];
  try {
    types = await api.get<ContentTypeSummary[]>('/v1/content/types?take=250');
  } catch {
    types = [];
  }
  const authors = await loadAuthorOptions();
  return <ContentEntryWizard types={types} presentation="overlay" authors={authors} />;
}

// Account-credit "grant" overlay needs the tenant's customers to populate its
// picker, so a thin server wrapper fetches + maps them (the documented pattern
// for create overlays needing server data). Mirrors the /new route's fetch.
interface AccountCreditCustomerRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

async function AccountCreditCreateOverlay() {
  const customersPaged = await api.getPaged<AccountCreditCustomerRow[]>(
    '/v1/crm/customers?take=200'
  );
  const customers = customersPaged.data.map((c) => {
    const full = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    const name = full !== '' ? full : (c.email ?? c.id.slice(0, 8) + '…');
    return { id: c.id, email: c.email, name };
  });
  return <GrantAccountCreditForm surface="overlay" customers={customers} />;
}

// Bundle create is the surface-aware BundleEditor (single-step F-shell on create,
// inline on edit). Its wrapper-product + variant pickers need the tenant's
// products/variants, so a thin server wrapper loads + filters them (the same
// loader the /new route uses). A created bundle opens into its detail view.
async function BundleCreateOverlay() {
  const { products, variants } = await loadBundleCreateData();
  return <BundleEditor surface="overlay" products={products} variants={variants} />;
}

// Configurator-template create binds a template to a configurable product, so a
// thin server wrapper loads the product picker options. A created template opens
// into its detail editor.
async function ConfiguratorTemplateCreateOverlay() {
  const products = await loadConfiguratorProducts();
  return <NewTemplateForm surface="overlay" products={products} />;
}

// Booking create is single-step but needs the tenant's services to populate the
// service picker (the form filters to the active, bookable ones), so a thin
// server wrapper fetches them. No detail view — a created booking returns to the
// list.
async function BookingCreateOverlay() {
  const services = await api
    .get<SchedulingService[]>('/v1/scheduling/services')
    .catch(() => [] as SchedulingService[]);
  return <BookingForm presentation="overlay" services={services} />;
}

// Dropship-supplier create is a two-step SurfaceFrame (pick vendor → configure),
// so it needs the connectable vendor catalog + the tenant's sites. A thin server
// wrapper loads both. No detail view — a created supplier returns to the list.
async function SupplierCreateOverlay() {
  const [vendors, properties] = await Promise.all([
    api.get<Vendor[]>('/v1/dropship/vendors').catch(() => [] as Vendor[]),
    listProperties().catch(() => []),
  ]);
  const sites: SiteOption[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
    isPrimary: p.isPrimary,
  }));
  return <SupplierForm presentation="overlay" vendors={vendors} sites={sites} />;
}

// Lot create is single-step but a lot is held at one warehouse, so a thin server
// wrapper loads the warehouse option list (the form owns the no-warehouse guard).
// No @detail drawer — a created lot navigates to its full-page detail.
async function LotCreateOverlay() {
  const { data: warehouses } = await api
    .getPaged<{ id: string; name: string; code: string }[]>('/v1/inventory/locations?take=250')
    .catch(() => ({ data: [] as { id: string; name: string; code: string }[] }));
  return <LotCreateForm surface="overlay" warehouses={warehouses} />;
}

// Count create is single-step; a count is scoped to one warehouse, so a thin
// server wrapper loads the warehouse list (the form owns the no-warehouse guard).
// No @detail drawer — a created count navigates to its full-page detail (quantity
// entry).
async function CountCreateOverlay() {
  const { data: warehouses } = await api
    .getPaged<{ id: string; name: string; code: string }[]>('/v1/inventory/locations?take=250')
    .catch(() => ({ data: [] as { id: string; name: string; code: string }[] }));
  return <CountCreateForm surface="overlay" warehouses={warehouses} />;
}

// Price-list create overlay — needs the B2B account / segment targeting
// options, so a thin server wrapper loads them (parity with CountCreateOverlay).
async function PriceListCreateOverlay() {
  const { b2bAccounts, segments } = await loadPriceListTargetingOptions();
  return <PriceListCreateForm surface="overlay" b2bAccounts={b2bAccounts} segments={segments} />;
}

// New-site wizard as a create overlay — multi-step SurfaceFrame (full-bleed). It
// needs the blueprint catalog + tenant zone suffix, so a thin server wrapper loads
// them. Full page lives at /settings/sites/new; a created site returns to the list.
async function SiteCreateOverlay() {
  const data = await loadNewSiteData();
  return <NewSiteWizard presentation="overlay" {...data} />;
}

const createComponents: Record<string, React.ComponentType> = {
  category: CategoryCreateOverlay,
  // Settings — the New-site wizard (hosted on the builder manifest).
  site: SiteCreateOverlay,
  // Commerce single-column create overlays (no detail view — stay open with an
  // inline result on success).
  'gift-card': () => <IssueGiftCardForm surface="overlay" />,
  'account-credit': AccountCreditCreateOverlay,
  // Commerce — single-step F-shell create overlays. discount has no detail view
  // (stays open / returns to the list); bundle + the shipping/tax zones flow into
  // their detail view on success.
  discount: () => <DiscountCreateForm surface="overlay" />,
  bundle: BundleCreateOverlay,
  'shipping-zone': () => <NewZoneForm surface="overlay" />,
  'shipping-profile': () => <NewProfileForm surface="overlay" />,
  'tax-zone': () => <NewTaxZoneForm surface="overlay" />,
  'configurator-template': ConfiguratorTemplateCreateOverlay,
  // CMS — author + taxonomy flow into their detail view on success; redirect
  // has no detail view and stays open.
  author: () => <AuthorCreateForm surface="overlay" />,
  taxonomy: () => <TaxonomyCreateForm surface="overlay" />,
  redirect: () => <RedirectCreateForm surface="overlay" />,
  // Email create overlays (no detail view).
  suppression: () => <AddSuppressionForm surface="overlay" />,
  'sending-domain': () => <AddDomainForm surface="overlay" />,
  collection: () => <CollectionCreateForm surface="overlay" />,
  // Product create is the multi-step SurfaceFrame, rendered as its `inline`
  // variant so the surrounding drawer/modal chrome owns the overlay shell. It's
  // flagged full-bleed (detail-registry `FULL_BLEED_CREATE_TYPES`) so the chrome
  // hands it the whole body. Full page stays at /commerce/products/new.
  product: () => <ProductWizard presentation="overlay" />,
  warehouse: () => <WarehouseCreateForm surface="overlay" />,
  'price-list': PriceListCreateOverlay,
  customer: CustomerCreateOverlay,
  'b2b-account': () => <B2bAccountWizard presentation="overlay" />,
  // Deal create is the single-step SurfaceFrame; a created deal opens into its detail.
  deal: DealCreateOverlay,
  // Task create is single-step; no detail view, so a created task returns to the list.
  task: TaskCreateOverlay,
  // Pipeline create is single-step with no server data; no detail drawer, so on
  // success it continues to the pipeline's edit screen (to add stages).
  pipeline: () => <NewPipelineForm surface="overlay" />,
  // Order create is a multi-step SurfaceFrame (full-bleed); its detail view
  // exists, so a created order opens straight into it.
  order: OrderCreateOverlay,
  // Inventory — multi-step SurfaceFrame create overlays (editors stay full-page).
  'purchase-order': PurchaseOrderCreateOverlay,
  transfer: TransferCreateOverlay,
  // Supplier create is single-step with no server data; no @detail drawer, so on
  // success it navigates to the supplier's full-page detail.
  supplier: () => <SupplierCreateForm surface="overlay" />,
  // Lot create is single-step; needs the warehouse list (server wrapper). No
  // @detail drawer — a created lot navigates to its full-page detail.
  lot: LotCreateOverlay,
  // Count create is single-step; needs the warehouse list (server wrapper). No
  // @detail drawer — a created count navigates to its full-page detail.
  count: CountCreateOverlay,
  // Workflow create is single-step with no server data; no @detail drawer, so on
  // success it continues to the workflow's edit screen (to add stages).
  workflow: () => <NewWorkflowForm surface="overlay" />,
  segment: () => <SegmentCreateForm surface="overlay" />,
  page: () => <PageCreateForm surface="overlay" />,
  'content-type': () => <ContentTypeCreateForm surface="overlay" />,
  'content-entry': ContentEntryCreateOverlay,
  // Invoicing — multi-step SurfaceFrame create overlay (the document editor stays
  // full-page; only creation opens in the drawer/modal).
  'billing-document': BillingDocumentCreateOverlay,
  // Scheduling — single-step create overlays (no detail view, so a created record
  // returns to the list; editing rides a self-owned modal on the list).
  service: () => <ServiceForm presentation="overlay" />,
  resource: () => <ResourceForm presentation="overlay" />,
  'booking-policy': () => <PolicyForm presentation="overlay" />,
  booking: BookingCreateOverlay,
  'b2b-pricing-tier': () => <TierCreateForm presentation="overlay" />,
  'inventory-source': () => <SourceForm presentation="overlay" />,
  'dropship-supplier': SupplierCreateOverlay,
};

// Renders the detail content for a given (typeId, id), or null when the type
// has no registered server component. The `CREATE_SENTINEL` id swaps the
// detail body for the registered create form. Returns a node — callers wrap
// it in a Suspense boundary so the fetch streams. Either way the content is
// wrapped in its module's provider so the drawer/modal adopts the correct
// accent color.
export function renderDetailContent(typeId: string, id: string): React.ReactNode {
  const module = detailModules[typeId] ?? 'platform';

  if (id === CREATE_SENTINEL) {
    const Create = createComponents[typeId];
    if (!Create) return null;
    // Full-bleed create overlays (the product wizard) fill the chrome body, so
    // the module wrapper must carry the height through rather than collapse to
    // content — otherwise the wizard's two-pane frame can't fill the panel.
    const fullBleed = isFullBleedCreate(typeId);
    return (
      <ModuleProvider module={module} className={fullBleed ? 'h-full' : undefined}>
        <Create />
      </ModuleProvider>
    );
  }

  const Content = detailComponents[typeId];
  if (!Content) return null;
  // A full-bleed detail view (a single edit form on the SurfaceFrame) fills the
  // chrome body, so the module wrapper must carry height through rather than
  // collapse to content — otherwise the inline frame can't fill the panel or pin
  // its floor toolbar. Tabbed detail views collapse to content as before.
  const fullBleed = isFullBleedDetail(typeId);
  return (
    <ModuleProvider module={module} className={fullBleed ? 'h-full' : undefined}>
      <Content id={id} />
    </ModuleProvider>
  );
}

// The `@detail` parallel-slot page. Both the index slot and the catch-all
// slot re-export this so the detail resolves on every route under (dashboard)
// — the detail is keyed by the query string, not the path. Reads the same
// `?modal=` / `?drawer=` token as the client `useDetailTarget()` (modal wins),
// dispatches through the registry, and wraps the (async) content in a Suspense
// boundary so it streams.
export default async function DetailSlot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const token = pickOne(sp.modal) ?? pickOne(sp.drawer);
  const target = parseDetailToken(token);
  if (!target) return null;

  // The detail body is a server component that fetches everything it needs before
  // it can render, so the overlay would otherwise open to an empty body for the
  // whole fetch. A skeleton (not `null`) gives the chrome immediate structure to
  // paint into. Full-bleed targets own their padding; padded ones sit inside the
  // chrome's p-6 body, so the skeleton matches.
  const fullBleed =
    target.entityId === CREATE_SENTINEL
      ? isFullBleedCreate(target.typeId)
      : isFullBleedDetail(target.typeId);

  return (
    <React.Suspense
      key={`${target.typeId}:${target.entityId}`}
      fallback={<DetailContentSkeleton fullBleed={fullBleed} />}
    >
      {renderDetailContent(target.typeId, target.entityId)}
    </React.Suspense>
  );
}

// Loading placeholder for a streaming detail body. Neutral and surface-agnostic:
// a faux tab strip over a few field blocks, sized to the chassis. Shown only
// until the body's server fetch resolves.
function DetailContentSkeleton({ fullBleed }: { fullBleed: boolean }) {
  return (
    <div className={fullBleed ? 'space-y-6 p-6' : 'space-y-6'} aria-hidden>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20" />
        ))}
      </div>
      <div className="border-base-300 space-y-4 rounded-lg border p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

function pickOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
