export { prisma } from './client';
export { withTenant, withSystem } from './tenant-context';
export type { TenantContext, TxClient } from './tenant-context';
export { tenantStore } from './tenant-store';
export type { TenantScope } from './tenant-store';

// Sample data (docs/104, Wave 5) — load/clear/status + the per-industry packs,
// shared by the dev/e2e seed and the api-rest production seam.
export {
  loadSampleData,
  clearSampleData,
  sampleDataStatus,
  resolveSamplePack,
  getSamplePack,
  packModules,
  countsTotal,
  SAMPLE_DATA_PACKS,
  GENERIC_INDUSTRY,
} from './sample-data';
export type { SampleDataPack, SampleDataCounts, SampleDataStatus } from './sample-data';

export type {
  Tenant,
  OnboardingChecklist,
  User,
  Session,
  Account,
  Verification,
  AuditLog,
  // CMS
  Page,
  ContentType,
  ContentEntry,
  ContentRevision,
  ContentReference,
  Taxonomy,
  TaxonomyTerm,
  EntryTaxonomyTerm,
  Author,
  Redirect,
  NavigationMenu,
  NavigationItem,
  PreviewToken,
  WebhookSubscription,
  WebhookDelivery,
  MediaAsset,
  MediaVariant,
  // Customer auth (Layer 2 — Better Auth customer instance, docs/27 v2)
  CustomerUser,
  CustomerSession,
  CustomerAccount,
  CustomerVerification,
  CustomerOauthApplication,
  CustomerOauthAccessToken,
  CustomerOauthConsent,
  // CRM
  Customer,
  CustomerAddress,
  CustomerDocument,
  // Site forms (docs/115)
  FormSubmission,
  FormDefinition,
  Company,
  B2bAccountContact,
  Pipeline,
  PipelineStage,
  // Invoicing (docs/87)
  DocumentWorkflow,
  DocumentStage,
  BillingDocumentLineType,
  BillingDocument,
  BillingDocumentLine,
  BillingDocumentSnapshot,
  BillingDocumentPayment,
  BillingDocumentTemplate,
  Deal,
  DealOrder,
  DealBillingDocument,
  CrmActivity,
  Task,
  Segment,
  SegmentMember,
  SavedView,
  // CRM — the object registry (docs/144 §3): what a record IS for this tenant,
  // and the rows of the record types they invented.
  CrmObjectDef,
  CrmRecord,
  // CRM — the relationship graph (docs/144 §6): "these two records are related,
  // and here is what that relationship is called".
  CrmAssociation,
  CrmAssociationLabel,
  // CRM — the engagement spine (docs/144 §5): what was SAID, as opposed to what
  // the platform did.
  MailboxConnection,
  EngagementThread,
  EngagementMessage,
  SalesTemplate,
  SalesSnippet,
  // CRM — calling (docs/144 §5.6): the placement and its lifecycle, plus the
  // tenant's own phone-system credentials.
  CallRecord,
  VoiceConnection,
  // CRM — service requests (docs/144 §7): the request, the promise made about
  // it, and that promise's per-priority targets.
  Ticket,
  TicketSlaPolicy,
  TicketSlaTarget,
  // CRM — the report builder (docs/144 §8): a saved definition, a board of
  // them, and one report's placement on one board.
  CrmReport,
  CrmDashboard,
  CrmDashboardWidget,
  ScoringModel,
  ScoreEvent,
  SegmentMembershipEvent,
  // The CRM workspace layer (docs/144 §11 + §12) — how a business works its CRM
  // rather than anything about a customer.
  CrmSettings,
  CrmSavedView,
  CrmMeetingLink,
  BillingDocumentSignature,
  // CRM — orders + child tables
  Order,
  OrderItem,
  OrderPayment,
  OrderRefund,
  OrderRefundItem,
  OrderFulfillment,
  OrderFulfillmentItem,
  // Commerce — catalog
  Product,
  // Typed product attributes (docs/143) — the commerce mirror of content types.
  ProductType,
  ProductProperty,
  ProductTranslation,
  ProductOption,
  ProductOptionValue,
  ProductVariant,
  VariantImage,
  ProductCategory,
  CategoryProduct,
  ProductCollection,
  CollectionProduct,
  FitmentDomain,
  FitmentNode,
  ProductFitment,
  ProductFitmentRange,
  // Inventory module
  Warehouse,
  InventoryLevel,
  InventoryMovement,
  InventoryReservation,
  LotBatch,
  SerialUnit,
  Supplier,
  SupplierVariant,
  PurchaseOrder,
  PurchaseOrderLine,
  GoodsReceipt,
  GoodsReceiptLine,
  InventoryCount,
  InventoryCountLine,
  InventoryTransfer,
  InventoryTransferLine,
  // Commerce — pricing + promotions
  PriceList,
  PriceListEntry,
  BulkPriceTier,
  ContractPrice,
  MarkupRule,
  SurchargeRule,
  Discount,
  DiscountUsage,
  GiftCard,
  GiftCardTransaction,
  AccountCredit,
  AccountCreditTransaction,
  // Commerce — bundles + configurator
  Bundle,
  BundleComponent,
  ConfigurationTemplate,
  ConfigurationOption,
  ConfigurationRule,
  ConfigurationAddOn,
  // Commerce — cart + checkout + subscriptions
  Cart,
  CartItem,
  CartDiscount,
  CheckoutSession,
  Subscription,
  SubscriptionItem,
  SubscriptionEvent,
  DunningAttempt,
  CustomerPaymentMethod,
  // Commerce — reviews, returns, shipping, tax, providers, storefront
  ProductReview,
  ReviewMedia,
  ReviewHelpfulVote,
  ReviewModerationLog,
  ProductQuestion,
  ProductAnswer,
  Wishlist,
  WishlistItem,
  ReturnRequest,
  ReturnLineItem,
  ReturnInspection,
  ReturnLabel,
  ShippingZone,
  ShippingProfile,
  ShippingRate,
  TaxZone,
  TaxRate,
  TaxExemption,
  ProviderInstallation,
  ProviderWebhookEvent,
  CommerceSiteSettings,
  CommerceSiteTheme,
  // Sitebuilder
  SiteConfig,
  SiteVersion,
  PageLayout,
  SiteSection,
  SiteLayoutBlock,
  SitePublishSchedule,
  SiteTheme,
  SiteLayoutDefault,
  SiteLayoutAssignment,
  TenantSectionDefinition,
  // Builder
  BuilderPage,
  BuilderLayout,
  // The per-property silica site record: authored theme + saved-component symbols
  BuilderSite,
  BuilderEmail,
  BuilderComponent,
  BuilderComponentVersion,
  BuilderGovernance,
  BuilderArchetype,
  // Platform component catalog (global, docs/98 §5)
  PlatformComponent,
  // Email platform
  EmailSettings,
  SendingDomain,
  ScheduledSend,
  Broadcast,
  EmailEvent,
  EmailSuppression,
  // Live Chat
  ChatConversation,
  ChatMessage,
  ChatQuickReply,
  // AI module (docs/07)
  AiPromptTemplate,
  AiToolPolicy,
  // Scheduling (docs/79)
  SchedulingResource,
  SchedulingService,
  Booking,
  BookingResource,
  BookingAttendee,
  AvailabilityWindow,
  AvailabilityException,
  BookingSeries,
  WaitlistEntry,
  BookingPolicy,
  IntakeForm,
  IntakeSubmission,
  CalendarConnection,
  ExternalBusyBlock,
  BookingNotification,
  BusinessLocation,
} from '@prisma/client';

// `Prisma` is exported as a VALUE (not type-only) because callers need the
// runtime members — Prisma.DbNull / Prisma.JsonNull / Prisma.sql — in addition
// to the type namespace (Prisma.TransactionClient, Prisma.*WhereInput, …).
// Type-only consumers keep using `import type { Prisma } from '@sparx/db'`.
export { Prisma } from '@prisma/client';

// The single allocation table for Postgres advisory-lock keys used by the
// platform's background ticks (see ./advisory-locks for why it is centralized).
export { ADVISORY_LOCKS, type AdvisoryLockName } from './advisory-locks';
// The transaction-scoped single-flight guard those keys are used with — replaces
// the leak-prone session-lock acquire/release pattern (see ./advisory-tick-lock).
export { withAdvisoryTickLock } from './advisory-tick-lock';
