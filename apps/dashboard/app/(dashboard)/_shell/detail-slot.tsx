import 'server-only';
import * as React from 'react';
import { ModuleProvider, type SparxModule } from '@sparx/ui';
import { requireSession } from '@sparx/auth';
import { api } from '@/lib/api-rest-client';
import { CREATE_SENTINEL, isFullBleedCreate, parseDetailToken } from './detail-registry';
import { ProductWizard } from '../commerce/products/_components/product-wizard';
import { CustomerFullProfileWizard } from '../crm/customers/new/customer-full-profile-wizard';
import { loadPipelineOptions } from '../crm/customers/new/pipeline-options';
import { B2bAccountWizard } from '../b2b/accounts/new/b2b-account-wizard';
import { ContentEntryWizard } from '../cms/content/new/content-entry-wizard';
import { loadAuthorOptions } from '../cms/content/new/author-options';
import { InvoiceWizard } from '../invoicing/documents/new/_components/invoice-wizard';
import { loadInvoiceWizardData } from '../invoicing/documents/new/wizard-data';
import { QuoteWizard } from '../crm/quotes/new/_components/quote-wizard';
import { loadQuoteWizardData } from '../crm/quotes/new/wizard-data';
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
import { SegmentCreateForm } from '../crm/segments/_components/segment-create-form';
import { PageCreateForm } from '../cms/_components/page-create-form';
import { ContentTypeCreateForm } from '../cms/types/_components/content-type-create-form';
import { IssueGiftCardForm } from '../commerce/gift-cards/_components/issue-gift-card-form';
import { GrantAccountCreditForm } from '../commerce/account-credit/_components/grant-account-credit-form';
import { AuthorCreateForm } from '../cms/authors/author-create-form';
import { TaxonomyCreateForm } from '../cms/taxonomy/taxonomy-create-form';
import { RedirectCreateForm } from '../cms/redirects/_components/redirect-create-form';
import { AddSuppressionForm } from '../email/suppressions/_components/add-suppression-form';
import { AddDomainForm } from '../email/domains/_components/add-domain-form';
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
import { QuoteDetailContent } from '../crm/quotes/[id]/_content';
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
  quote: QuoteDetailContent,
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
  // Email — create-only overlays (no detail view)
  'sending-domain': 'email',
  suppression: 'email',
  // CRM
  customer: 'crm',
  'b2b-account': 'crm',
  deal: 'crm',
  quote: 'crm',
  order: 'crm',
  segment: 'crm',
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
  // Builder
  'builder-component': 'builder',
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
// Content-entry create is the WizardFrame, but its type-picker step needs the
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

// Customer create is the WizardFrame; its optional follow-up task is assigned to
// the current user and its optional deal needs the tenant's pipelines, so a thin
// server wrapper resolves the session + pipelines and passes them through.
async function CustomerCreateOverlay() {
  const [session, pipelines] = await Promise.all([requireSession(), loadPipelineOptions()]);
  return (
    <CustomerFullProfileWizard
      presentation="overlay"
      currentUserId={session.user.id}
      pipelines={pipelines}
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

// Billing-document create is the multi-step WizardFrame. Its detail/editor is a
// wide, interactive full-page surface (no detail-view drawer), but CREATION opts
// into the overlay so the user's `defaultDetailView` picks the style. The wizard
// needs the tenant's workflows, parties, line types and markup rules, so a thin
// server wrapper resolves them. No `?customerId=` preselection here — the /new
// route carries deep-link preselection instead.
async function BillingDocumentCreateOverlay() {
  const data = await loadInvoiceWizardData();
  return <InvoiceWizard presentation="overlay" {...data} />;
}

// Quote create is the multi-step WizardFrame. Quotes anchor to a customer and/or
// B2B account, so a thin server wrapper resolves both pickers. No `?customerId=`
// preselection here — the /new route carries deep-link preselection instead.
async function QuoteCreateOverlay() {
  const data = await loadQuoteWizardData();
  return <QuoteWizard presentation="overlay" {...data} />;
}

// Order create is the multi-step WizardFrame; a created order opens into its
// detail view. The customer picker needs the tenant's customers.
async function OrderCreateOverlay() {
  const data = await loadOrderWizardData();
  return <OrderWizard presentation="overlay" {...data} />;
}

// Purchase-order + transfer create are multi-step WizardFrames; their editors are
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

const createComponents: Record<string, React.ComponentType> = {
  category: CategoryCreateOverlay,
  // Commerce single-column create overlays (no detail view — stay open with an
  // inline result on success).
  'gift-card': () => <IssueGiftCardForm surface="overlay" />,
  'account-credit': AccountCreditCreateOverlay,
  // CMS — author + taxonomy flow into their detail view on success; redirect
  // has no detail view and stays open.
  author: () => <AuthorCreateForm surface="overlay" />,
  taxonomy: () => <TaxonomyCreateForm surface="overlay" />,
  redirect: () => <RedirectCreateForm surface="overlay" />,
  // Email create overlays (no detail view).
  suppression: () => <AddSuppressionForm surface="overlay" />,
  'sending-domain': () => <AddDomainForm surface="overlay" />,
  collection: () => <CollectionCreateForm surface="overlay" />,
  // Product create is the multi-step WizardFrame, rendered as its `inline`
  // variant so the surrounding drawer/modal chrome owns the overlay shell. It's
  // flagged full-bleed (detail-registry `FULL_BLEED_CREATE_TYPES`) so the chrome
  // hands it the whole body. Full page stays at /commerce/products/new.
  product: () => <ProductWizard presentation="overlay" />,
  warehouse: () => <WarehouseCreateForm surface="overlay" />,
  'price-list': () => <PriceListCreateForm surface="overlay" />,
  customer: CustomerCreateOverlay,
  'b2b-account': () => <B2bAccountWizard presentation="overlay" />,
  // Quote + Order create are multi-step WizardFrames (full-bleed); their detail
  // views exist, so a created record opens straight into it.
  quote: QuoteCreateOverlay,
  order: OrderCreateOverlay,
  // Inventory — multi-step WizardFrame create overlays (editors stay full-page).
  'purchase-order': PurchaseOrderCreateOverlay,
  transfer: TransferCreateOverlay,
  segment: () => <SegmentCreateForm surface="overlay" />,
  page: () => <PageCreateForm surface="overlay" />,
  'content-type': () => <ContentTypeCreateForm surface="overlay" />,
  'content-entry': ContentEntryCreateOverlay,
  // Invoicing — multi-step WizardFrame create overlay (the document editor stays
  // full-page; only creation opens in the drawer/modal).
  'billing-document': BillingDocumentCreateOverlay,
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
  return (
    <ModuleProvider module={module}>
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

  return (
    <React.Suspense key={`${target.typeId}:${target.entityId}`} fallback={null}>
      {renderDetailContent(target.typeId, target.entityId)}
    </React.Suspense>
  );
}

function pickOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
