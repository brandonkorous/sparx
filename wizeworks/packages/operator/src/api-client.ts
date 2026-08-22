// The typed api-rest `/internal/operator/*` client (docs/apps/admin build-plan
// §2 D6). The admin app holds NO cross-tenant DB role — every byte of tenant
// business data, read or written, flows through these Layer-5 internal calls.
//
// Trust model: wizeworks/apps/admin is the operator trust boundary. It authenticates the
// operator (Better Auth + capabilities) BEFORE calling here, then presents a
// shared secret proving "this is the admin app" plus the operator's id for the
// audit trail. api-rest verifies the secret (constant-time, fail-closed) and
// records the operator id it was told — it does not (and cannot, as sparx_app)
// read the wize_admin capability store itself.
//
// SERVER-ONLY. The secret must never reach a browser; construct the client in
// Next server components / route handlers, never in a client component.

import type {
  OperatorWhoAmIResult,
  OperatorApiErrorBody,
  OperatorTenantListItem,
  OperatorTenantListParams,
  OperatorTenantListResult,
  OperatorTenantDetail,
  OperatorMetricsParams,
  OperatorMetricsResult,
  OperatorStripeEvent,
  OperatorCoupon,
  OperatorCouponInput,
  OperatorPromotionCode,
  OperatorPromotionCodeInput,
  OperatorRefundInput,
  OperatorRefundResult,
  OperatorInvoiceInput,
  OperatorInvoiceResult,
  OperatorTenantBillingView,
  OperatorDomainListParams,
  OperatorDomainListResult,
  OperatorDomainDetail,
  OperatorDomainReverifyResult,
  OperatorSupportSearchParams,
  OperatorOrderSearchResult,
  OperatorCustomerSearchResult,
  OperatorSearchIndexStatus,
  OperatorReindexInput,
  OperatorReindexResult,
  OperatorEmailLogParams,
  OperatorEmailLogResult,
  OperatorResendConfirmationResult,
  OperatorFeedbackListParams,
  OperatorFeedbackListResult,
  OperatorFeedbackDetail,
  OperatorFeedbackTriageInput,
  OperatorFeedbackReplyInput,
  OperatorModuleToggleInput,
  OperatorModuleToggleResult,
  OperatorSuspendInput,
  OperatorTenantStatusResult,
  OperatorStorageLimitInput,
  OperatorStorageLimitResult,
  OperatorPartnerApplication,
  OperatorPartnerListItem,
  OperatorPartnerDetail,
  OperatorPartnerApproveInput,
  OperatorPartnerRejectInput,
  OperatorPartnerTierInput,
  OperatorPartnerStatusInput,
  OperatorPayoutRunResult,
  OperatorCommissionApproveResult,
  OperatorBootcampListResult,
  OperatorUserListParams,
  OperatorUserListResult,
  OperatorUserDetail,
  OperatorMembershipStatusInput,
  OperatorMembershipRoleInput,
  OperatorMembershipRemoveInput,
  OperatorUserMembershipsResult,
  OperatorPasswordResetResult,
  OperatorSiteListParams,
  OperatorSiteListResult,
  OperatorSiteDetail,
  OperatorSiteStatusInput,
  OperatorSiteStatusResult,
  OperatorAnnouncement,
  OperatorAnnouncementInput,
  OperatorAnnouncementPatch,
  OperatorAnnouncementListParams,
  OperatorAnnouncementListResult,
} from './types';

/** Shared-secret header — mirrors the existing `X-sparx-Internal-*-Token`
 *  Layer-5 convention (docs/16 §2.5). */
export const INTERNAL_OPERATOR_TOKEN_HEADER = 'x-sparx-internal-operator-token';
/** Carries the authenticated operator's id so api-rest can attribute + audit
 *  the action. Trusted because it rides inside the secret-authenticated call. */
export const OPERATOR_ID_HEADER = 'x-sparx-operator-id';

export interface OperatorApiClientConfig {
  /** api-rest origin, e.g. `http://api-rest.sparx-prod:3100` in-cluster or
   *  `http://localhost:3100` in dev. */
  baseUrl: string;
  /** The shared secret (env `SPARX_INTERNAL_OPERATOR_TOKEN`). */
  token: string;
}

export interface OperatorApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** The acting operator's id — sent as the audit header. */
  operatorId: string;
  /** JSON body for write calls. */
  body?: unknown;
  /** Optional AbortSignal for request cancellation / timeouts. */
  signal?: AbortSignal;
}

export class OperatorApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'OperatorApiError';
  }
}

export interface OperatorApiClient {
  request<T>(path: string, options: OperatorApiRequestOptions): Promise<T>;
  /** Slice-1 round-trip probe (see OperatorWhoAmIResult). */
  whoami(operatorId: string, signal?: AbortSignal): Promise<OperatorWhoAmIResult>;
  /** Cross-tenant tenant list, filtered + paginated (Slice 2). */
  listTenants(
    params: OperatorTenantListParams,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorTenantListResult>;
  /** One tenant's full detail (Slice 2). Throws `OperatorApiError` with status 404
   *  when the tenant id is unknown. */
  getTenant(
    tenantId: string,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorTenantDetail>;
  /** Platform metrics snapshot (Slice 3). */
  getMetrics(
    params: OperatorMetricsParams,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorMetricsResult>;
  // ── Billing ops (Slice 4) ──
  /** Tenants whose platform subscription payment is failing (past_due / unpaid). */
  listFailedPayments(operatorId: string, signal?: AbortSignal): Promise<OperatorTenantListItem[]>;
  /** Recent platform Stripe events (webhook-log viewer). */
  listStripeEvents(
    operatorId: string,
    limit?: number,
    signal?: AbortSignal
  ): Promise<OperatorStripeEvent[]>;
  listCoupons(operatorId: string, signal?: AbortSignal): Promise<OperatorCoupon[]>;
  createCoupon(
    input: OperatorCouponInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorCoupon>;
  deleteCoupon(couponId: string, operatorId: string, signal?: AbortSignal): Promise<void>;
  /** Promotion codes — the strings tenants redeem at checkout; optionally scoped to
   *  one coupon. */
  listPromotionCodes(
    operatorId: string,
    couponId?: string,
    signal?: AbortSignal
  ): Promise<OperatorPromotionCode[]>;
  createPromotionCode(
    input: OperatorPromotionCodeInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorPromotionCode>;
  deactivatePromotionCode(
    id: string,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorPromotionCode>;
  /** A tenant's platform-billing view (subscription snapshot + recent charges). */
  getTenantBilling(
    tenantId: string,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorTenantBillingView>;
  refundCharge(
    input: OperatorRefundInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorRefundResult>;
  createInvoice(
    input: OperatorInvoiceInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorInvoiceResult>;
  // ── Domain management (Slice 5) ──
  /** All custom + purchased domains cross-tenant, filtered + paginated. */
  listDomains(
    params: OperatorDomainListParams,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorDomainListResult>;
  /** One domain's full detail — routing, registrar, live DNS probe, purchase
   *  history. Throws `OperatorApiError` 404 when the id is unknown. */
  getDomain(
    domainId: string,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorDomainDetail>;
  /** Force re-verify a domain: re-check DNS now (custom) or re-trigger the
   *  domain-worker (purchased). */
  reverifyDomain(
    domainId: string,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorDomainReverifyResult>;
  // ── Support tools (Slice 6) ──
  /** Cross-tenant order lookup (by number / customer / SKU) via Typesense. */
  searchOrders(
    params: OperatorSupportSearchParams,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorOrderSearchResult>;
  /** Cross-tenant customer lookup (by email / name / company) via Typesense. */
  searchCustomers(
    params: OperatorSupportSearchParams,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorCustomerSearchResult>;
  /** One tenant's per-collection search-index document counts. */
  getSearchIndex(
    tenantId: string,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorSearchIndexStatus>;
  /** Trigger a full search reindex for a tenant (publishes the reindex event). */
  reindexTenant(
    tenantId: string,
    input: OperatorReindexInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorReindexResult>;
  /** A tenant's email delivery log (filtered by recipient / type / message id). */
  getEmailLog(
    tenantId: string,
    params: OperatorEmailLogParams,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorEmailLogResult>;
  /** Re-send an order's confirmation email through the tenant's own template. */
  resendOrderConfirmation(
    tenantId: string,
    orderId: string,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorResendConfirmationResult>;
  // ── Feedback triage (Slice 7) ──
  /** Cross-tenant feedback inbox — filtered, paginated, with queue counts. */
  listFeedback(
    params: OperatorFeedbackListParams,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorFeedbackListResult>;
  /** One submission + its full thread + context. */
  getFeedback(
    tenantId: string,
    submissionId: string,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorFeedbackDetail>;
  /** Triage a submission (status / assignee / tags), optionally notifying. */
  triageFeedback(
    tenantId: string,
    submissionId: string,
    input: OperatorFeedbackTriageInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorFeedbackDetail>;
  /** Post a staff reply (publishes `feedback.responded`), optionally with a status. */
  replyFeedback(
    tenantId: string,
    submissionId: string,
    input: OperatorFeedbackReplyInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorFeedbackDetail>;
  // ── Tenant write actions (Slice 8) ──
  /** Manually activate/deactivate a module for a tenant. Drives the tenant's own
   *  toggle path (publishes `module.{activated,deactivated}`, seeds defaults,
   *  syncs Stripe) and stamps the tenant's audit_logs as an operator action.
   *  Throws `OperatorApiError` 409 when disabling a module another still requires. */
  toggleTenantModule(
    tenantId: string,
    slug: string,
    input: OperatorModuleToggleInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorModuleToggleResult>;
  /** Suspend / unsuspend a tenant (status-only — no request path blocks a
   *  suspended tenant yet). Stamps the tenant's audit_logs as an operator action. */
  setTenantStatus(
    tenantId: string,
    input: OperatorSuspendInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorTenantStatusResult>;
  /** Set / clear a tenant's storage-cap override (stored + displayed; not yet
   *  enforced at the upload path). */
  setTenantStorageLimit(
    tenantId: string,
    input: OperatorStorageLimitInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorStorageLimitResult>;
  // ── Partner Program (Slice 9) ──
  /** WizeWorks' partner-application review queue (optionally filtered by status). */
  listPartnerApplications(
    operatorId: string,
    status?: string,
    signal?: AbortSignal
  ): Promise<OperatorPartnerApplication[]>;
  /** Approve an application → provision/activate the applicant's partner row. */
  approvePartnerApplication(
    applicationId: string,
    input: OperatorPartnerApproveInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorPartnerListItem>;
  /** Reject a pending application. */
  rejectPartnerApplication(
    applicationId: string,
    input: OperatorPartnerRejectInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorPartnerApplication>;
  /** The active partner roster (suspended partners drop out — reach via detail). */
  listPartners(operatorId: string, signal?: AbortSignal): Promise<OperatorPartnerListItem[]>;
  /** One partner's full detail (profile + referrals + commissions + payouts + KPIs). */
  getPartner(
    tenantId: string,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorPartnerDetail>;
  /** Set a partner's tier. */
  setPartnerTier(
    tenantId: string,
    input: OperatorPartnerTierInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorPartnerListItem>;
  /** Suspend / reinstate a partner. */
  setPartnerStatus(
    tenantId: string,
    input: OperatorPartnerStatusInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorPartnerListItem>;
  /** Promote eligible pending commissions to `approved` (clawback window passed). */
  approvePartnerCommissions(
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorCommissionApproveResult>;
  /** Run the monthly Stripe Connect payout batch. */
  runPartnerPayouts(operatorId: string, signal?: AbortSignal): Promise<OperatorPayoutRunResult>;
  /** The cross-partner published-bootcamp overview (read-only). */
  listBootcamps(operatorId: string, signal?: AbortSignal): Promise<OperatorBootcampListResult>;
  // ── Users (staff/team members) ──
  /** Cross-tenant staff-user roster, filtered + paginated. */
  listUsers(
    params: OperatorUserListParams,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorUserListResult>;
  /** One staff user's full detail + every org membership. Throws `OperatorApiError`
   *  404 when the id is unknown. */
  getUser(userId: string, operatorId: string, signal?: AbortSignal): Promise<OperatorUserDetail>;
  /** Suspend / reactivate a user's membership in one tenant (Member.status). */
  setMembershipStatus(
    userId: string,
    input: OperatorMembershipStatusInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorUserMembershipsResult>;
  /** Change a user's role within one tenant (Member.role). */
  setMembershipRole(
    userId: string,
    input: OperatorMembershipRoleInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorUserMembershipsResult>;
  /** Remove a user's membership from one tenant. Throws 409 when it would strip a
   *  tenant's last owner. */
  removeMembership(
    userId: string,
    input: OperatorMembershipRemoveInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorUserMembershipsResult>;
  /** Send the user a password-reset email (Better Auth, via the dashboard seam). */
  resetUserPassword(
    userId: string,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorPasswordResetResult>;
  // ── Sites (web properties) ──
  /** Cross-tenant site roster, filtered + paginated. */
  listSites(
    params: OperatorSiteListParams,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorSiteListResult>;
  /** One site's full detail (+ hostnames). Throws `OperatorApiError` 404 when the
   *  id is unknown. */
  getSite(siteId: string, operatorId: string, signal?: AbortSignal): Promise<OperatorSiteDetail>;
  /** Pause / archive / reactivate a site (properties.status). */
  setSiteStatus(
    siteId: string,
    input: OperatorSiteStatusInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorSiteStatusResult>;
  // ── Announcements (the header notice bar) ──
  /** Every announcement, both brands, newest first — drafts and expired ones
   *  included. The console is where a notice is written and retired, so it must
   *  show the ones that are not on screen. */
  listAnnouncements(
    params: OperatorAnnouncementListParams,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorAnnouncementListResult>;
  createAnnouncement(
    input: OperatorAnnouncementInput,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorAnnouncement>;
  updateAnnouncement(
    id: string,
    input: OperatorAnnouncementPatch,
    operatorId: string,
    signal?: AbortSignal
  ): Promise<OperatorAnnouncement>;
  deleteAnnouncement(id: string, operatorId: string, signal?: AbortSignal): Promise<void>;
}

export function createOperatorApiClient(config: OperatorApiClientConfig): OperatorApiClient {
  const base = config.baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, options: OperatorApiRequestOptions): Promise<T> {
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      [INTERNAL_OPERATOR_TOKEN_HEADER]: config.token,
      [OPERATOR_ID_HEADER]: options.operatorId,
    };
    if (options.body !== undefined) headers['content-type'] = 'application/json';

    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      // Operator data must never be served from a cached edge/runtime response.
      cache: 'no-store',
    });

    if (!res.ok) {
      const err = await safeErrorBody(res);
      throw new OperatorApiError(res.status, err.code, err.message);
    }
    // 204 / empty body → undefined (typed as T by the caller's expectation).
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    request,
    whoami: (operatorId, signal) =>
      request<OperatorWhoAmIResult>('/internal/operator/whoami', { operatorId, signal }),
    listTenants: (params, operatorId, signal) => {
      const qs = new URLSearchParams();
      if (params.q) qs.set('q', params.q);
      if (params.status) qs.set('status', params.status);
      if (params.plan) qs.set('plan', params.plan);
      if (params.limit !== undefined) qs.set('limit', String(params.limit));
      if (params.offset !== undefined) qs.set('offset', String(params.offset));
      const query = qs.toString();
      return request<OperatorTenantListResult>(
        `/internal/operator/tenants${query ? `?${query}` : ''}`,
        { operatorId, signal }
      );
    },
    getTenant: (tenantId, operatorId, signal) =>
      request<OperatorTenantDetail>(`/internal/operator/tenants/${encodeURIComponent(tenantId)}`, {
        operatorId,
        signal,
      }),
    getMetrics: (params, operatorId, signal) => {
      const qs = new URLSearchParams();
      if (params.windowDays !== undefined) qs.set('windowDays', String(params.windowDays));
      const query = qs.toString();
      return request<OperatorMetricsResult>(
        `/internal/operator/metrics${query ? `?${query}` : ''}`,
        { operatorId, signal }
      );
    },
    listFailedPayments: (operatorId, signal) =>
      request<OperatorTenantListItem[]>('/internal/operator/billing/failed-payments', {
        operatorId,
        signal,
      }),
    listStripeEvents: (operatorId, limit, signal) =>
      request<OperatorStripeEvent[]>(
        `/internal/operator/billing/events${limit ? `?limit=${limit}` : ''}`,
        { operatorId, signal }
      ),
    listCoupons: (operatorId, signal) =>
      request<OperatorCoupon[]>('/internal/operator/billing/coupons', { operatorId, signal }),
    createCoupon: (input, operatorId, signal) =>
      request<OperatorCoupon>('/internal/operator/billing/coupons', {
        method: 'POST',
        body: input,
        operatorId,
        signal,
      }),
    deleteCoupon: (couponId, operatorId, signal) =>
      request<void>(`/internal/operator/billing/coupons/${encodeURIComponent(couponId)}`, {
        method: 'DELETE',
        operatorId,
        signal,
      }),
    listPromotionCodes: (operatorId, couponId, signal) =>
      request<OperatorPromotionCode[]>(
        `/internal/operator/billing/promotion-codes${
          couponId ? `?coupon=${encodeURIComponent(couponId)}` : ''
        }`,
        { operatorId, signal }
      ),
    createPromotionCode: (input, operatorId, signal) =>
      request<OperatorPromotionCode>('/internal/operator/billing/promotion-codes', {
        method: 'POST',
        body: input,
        operatorId,
        signal,
      }),
    deactivatePromotionCode: (id, operatorId, signal) =>
      request<OperatorPromotionCode>(
        `/internal/operator/billing/promotion-codes/${encodeURIComponent(id)}/deactivate`,
        { method: 'POST', operatorId, signal }
      ),
    getTenantBilling: (tenantId, operatorId, signal) =>
      request<OperatorTenantBillingView>(
        `/internal/operator/tenants/${encodeURIComponent(tenantId)}/billing`,
        { operatorId, signal }
      ),
    refundCharge: (input, operatorId, signal) =>
      request<OperatorRefundResult>('/internal/operator/billing/refund', {
        method: 'POST',
        body: input,
        operatorId,
        signal,
      }),
    createInvoice: (input, operatorId, signal) =>
      request<OperatorInvoiceResult>('/internal/operator/billing/invoice', {
        method: 'POST',
        body: input,
        operatorId,
        signal,
      }),
    listDomains: (params, operatorId, signal) => {
      const qs = new URLSearchParams();
      if (params.q) qs.set('q', params.q);
      if (params.status) qs.set('status', params.status);
      if (params.type) qs.set('type', params.type);
      if (params.tenantId) qs.set('tenantId', params.tenantId);
      if (params.attention) qs.set('attention', '1');
      if (params.limit !== undefined) qs.set('limit', String(params.limit));
      if (params.offset !== undefined) qs.set('offset', String(params.offset));
      const query = qs.toString();
      return request<OperatorDomainListResult>(
        `/internal/operator/domains${query ? `?${query}` : ''}`,
        { operatorId, signal }
      );
    },
    getDomain: (domainId, operatorId, signal) =>
      request<OperatorDomainDetail>(`/internal/operator/domains/${encodeURIComponent(domainId)}`, {
        operatorId,
        signal,
      }),
    reverifyDomain: (domainId, operatorId, signal) =>
      request<OperatorDomainReverifyResult>(
        `/internal/operator/domains/${encodeURIComponent(domainId)}/reverify`,
        { method: 'POST', operatorId, signal }
      ),
    searchOrders: (params, operatorId, signal) => {
      const qs = new URLSearchParams({ q: params.q });
      if (params.page !== undefined) qs.set('page', String(params.page));
      return request<OperatorOrderSearchResult>(
        `/internal/operator/support/orders?${qs.toString()}`,
        { operatorId, signal }
      );
    },
    searchCustomers: (params, operatorId, signal) => {
      const qs = new URLSearchParams({ q: params.q });
      if (params.page !== undefined) qs.set('page', String(params.page));
      return request<OperatorCustomerSearchResult>(
        `/internal/operator/support/customers?${qs.toString()}`,
        { operatorId, signal }
      );
    },
    getSearchIndex: (tenantId, operatorId, signal) =>
      request<OperatorSearchIndexStatus>(
        `/internal/operator/tenants/${encodeURIComponent(tenantId)}/search-index`,
        { operatorId, signal }
      ),
    reindexTenant: (tenantId, input, operatorId, signal) =>
      request<OperatorReindexResult>(
        `/internal/operator/tenants/${encodeURIComponent(tenantId)}/reindex`,
        { method: 'POST', body: input, operatorId, signal }
      ),
    getEmailLog: (tenantId, params, operatorId, signal) => {
      const qs = new URLSearchParams();
      if (params.recipient) qs.set('recipient', params.recipient);
      if (params.type) qs.set('type', params.type);
      if (params.messageId) qs.set('messageId', params.messageId);
      if (params.limit !== undefined) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return request<OperatorEmailLogResult>(
        `/internal/operator/tenants/${encodeURIComponent(tenantId)}/email-log${query ? `?${query}` : ''}`,
        { operatorId, signal }
      );
    },
    resendOrderConfirmation: (tenantId, orderId, operatorId, signal) =>
      request<OperatorResendConfirmationResult>(
        `/internal/operator/tenants/${encodeURIComponent(tenantId)}/orders/${encodeURIComponent(orderId)}/resend-confirmation`,
        { method: 'POST', operatorId, signal }
      ),
    listFeedback: (params, operatorId, signal) => {
      const qs = new URLSearchParams();
      if (params.status) qs.set('status', params.status);
      if (params.category) qs.set('category', params.category);
      if (params.tenantId) qs.set('tenantId', params.tenantId);
      if (params.assigneeStaffId) qs.set('assigneeStaffId', params.assigneeStaffId);
      if (params.tag) qs.set('tag', params.tag);
      if (params.q) qs.set('q', params.q);
      if (params.page !== undefined) qs.set('page', String(params.page));
      const query = qs.toString();
      return request<OperatorFeedbackListResult>(
        `/internal/operator/feedback${query ? `?${query}` : ''}`,
        { operatorId, signal }
      );
    },
    getFeedback: (tenantId, submissionId, operatorId, signal) =>
      request<OperatorFeedbackDetail>(
        `/internal/operator/feedback/${encodeURIComponent(tenantId)}/${encodeURIComponent(submissionId)}`,
        { operatorId, signal }
      ),
    triageFeedback: (tenantId, submissionId, input, operatorId, signal) =>
      request<OperatorFeedbackDetail>(
        `/internal/operator/feedback/${encodeURIComponent(tenantId)}/${encodeURIComponent(submissionId)}`,
        { method: 'PATCH', body: input, operatorId, signal }
      ),
    replyFeedback: (tenantId, submissionId, input, operatorId, signal) =>
      request<OperatorFeedbackDetail>(
        `/internal/operator/feedback/${encodeURIComponent(tenantId)}/${encodeURIComponent(submissionId)}/messages`,
        { method: 'POST', body: input, operatorId, signal }
      ),
    toggleTenantModule: (tenantId, slug, input, operatorId, signal) =>
      request<OperatorModuleToggleResult>(
        `/internal/operator/tenants/${encodeURIComponent(tenantId)}/modules/${encodeURIComponent(slug)}`,
        { method: 'PATCH', body: input, operatorId, signal }
      ),
    setTenantStatus: (tenantId, input, operatorId, signal) =>
      request<OperatorTenantStatusResult>(
        `/internal/operator/tenants/${encodeURIComponent(tenantId)}/status`,
        { method: 'PATCH', body: input, operatorId, signal }
      ),
    setTenantStorageLimit: (tenantId, input, operatorId, signal) =>
      request<OperatorStorageLimitResult>(
        `/internal/operator/tenants/${encodeURIComponent(tenantId)}/storage-limit`,
        { method: 'PATCH', body: input, operatorId, signal }
      ),
    listPartnerApplications: (operatorId, status, signal) =>
      request<OperatorPartnerApplication[]>(
        `/internal/operator/partners/applications${status ? `?status=${encodeURIComponent(status)}` : ''}`,
        { operatorId, signal }
      ),
    approvePartnerApplication: (applicationId, input, operatorId, signal) =>
      request<OperatorPartnerListItem>(
        `/internal/operator/partners/applications/${encodeURIComponent(applicationId)}/approve`,
        { method: 'POST', body: input, operatorId, signal }
      ),
    rejectPartnerApplication: (applicationId, input, operatorId, signal) =>
      request<OperatorPartnerApplication>(
        `/internal/operator/partners/applications/${encodeURIComponent(applicationId)}/reject`,
        { method: 'POST', body: input, operatorId, signal }
      ),
    listPartners: (operatorId, signal) =>
      request<OperatorPartnerListItem[]>('/internal/operator/partners', { operatorId, signal }),
    getPartner: (tenantId, operatorId, signal) =>
      request<OperatorPartnerDetail>(
        `/internal/operator/partners/${encodeURIComponent(tenantId)}`,
        { operatorId, signal }
      ),
    setPartnerTier: (tenantId, input, operatorId, signal) =>
      request<OperatorPartnerListItem>(
        `/internal/operator/partners/${encodeURIComponent(tenantId)}/tier`,
        { method: 'PATCH', body: input, operatorId, signal }
      ),
    setPartnerStatus: (tenantId, input, operatorId, signal) =>
      request<OperatorPartnerListItem>(
        `/internal/operator/partners/${encodeURIComponent(tenantId)}/status`,
        { method: 'PATCH', body: input, operatorId, signal }
      ),
    approvePartnerCommissions: (operatorId, signal) =>
      request<OperatorCommissionApproveResult>('/internal/operator/partners/commissions/approve', {
        method: 'POST',
        operatorId,
        signal,
      }),
    runPartnerPayouts: (operatorId, signal) =>
      request<OperatorPayoutRunResult>('/internal/operator/partners/payouts/run', {
        method: 'POST',
        operatorId,
        signal,
      }),
    listBootcamps: (operatorId, signal) =>
      request<OperatorBootcampListResult>('/internal/operator/bootcamps', { operatorId, signal }),
    listUsers: (params, operatorId, signal) => {
      const qs = new URLSearchParams();
      if (params.q) qs.set('q', params.q);
      if (params.limit !== undefined) qs.set('limit', String(params.limit));
      if (params.offset !== undefined) qs.set('offset', String(params.offset));
      const query = qs.toString();
      return request<OperatorUserListResult>(
        `/internal/operator/users${query ? `?${query}` : ''}`,
        {
          operatorId,
          signal,
        }
      );
    },
    getUser: (userId, operatorId, signal) =>
      request<OperatorUserDetail>(`/internal/operator/users/${encodeURIComponent(userId)}`, {
        operatorId,
        signal,
      }),
    setMembershipStatus: (userId, input, operatorId, signal) =>
      request<OperatorUserMembershipsResult>(
        `/internal/operator/users/${encodeURIComponent(userId)}/membership-status`,
        { method: 'PATCH', body: input, operatorId, signal }
      ),
    setMembershipRole: (userId, input, operatorId, signal) =>
      request<OperatorUserMembershipsResult>(
        `/internal/operator/users/${encodeURIComponent(userId)}/membership-role`,
        { method: 'PATCH', body: input, operatorId, signal }
      ),
    removeMembership: (userId, input, operatorId, signal) =>
      request<OperatorUserMembershipsResult>(
        `/internal/operator/users/${encodeURIComponent(userId)}/membership`,
        { method: 'DELETE', body: input, operatorId, signal }
      ),
    resetUserPassword: (userId, operatorId, signal) =>
      request<OperatorPasswordResetResult>(
        `/internal/operator/users/${encodeURIComponent(userId)}/password-reset`,
        { method: 'POST', operatorId, signal }
      ),
    listSites: (params, operatorId, signal) => {
      const qs = new URLSearchParams();
      if (params.q) qs.set('q', params.q);
      if (params.status) qs.set('status', params.status);
      if (params.limit !== undefined) qs.set('limit', String(params.limit));
      if (params.offset !== undefined) qs.set('offset', String(params.offset));
      const query = qs.toString();
      return request<OperatorSiteListResult>(
        `/internal/operator/sites${query ? `?${query}` : ''}`,
        {
          operatorId,
          signal,
        }
      );
    },
    getSite: (siteId, operatorId, signal) =>
      request<OperatorSiteDetail>(`/internal/operator/sites/${encodeURIComponent(siteId)}`, {
        operatorId,
        signal,
      }),
    setSiteStatus: (siteId, input, operatorId, signal) =>
      request<OperatorSiteStatusResult>(
        `/internal/operator/sites/${encodeURIComponent(siteId)}/status`,
        { method: 'PATCH', body: input, operatorId, signal }
      ),
    listAnnouncements: (params, operatorId, signal) => {
      const qs = new URLSearchParams();
      if (params.brand) qs.set('brand', params.brand);
      if (params.surface) qs.set('surface', params.surface);
      const query = qs.toString();
      return request<OperatorAnnouncementListResult>(
        `/internal/operator/announcements${query ? `?${query}` : ''}`,
        { operatorId, signal }
      );
    },
    createAnnouncement: (input, operatorId, signal) =>
      request<OperatorAnnouncement>('/internal/operator/announcements', {
        method: 'POST',
        body: input,
        operatorId,
        signal,
      }),
    updateAnnouncement: (id, input, operatorId, signal) =>
      request<OperatorAnnouncement>(`/internal/operator/announcements/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: input,
        operatorId,
        signal,
      }),
    deleteAnnouncement: (id, operatorId, signal) =>
      request<void>(`/internal/operator/announcements/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        operatorId,
        signal,
      }),
  };
}

async function safeErrorBody(res: Response): Promise<OperatorApiErrorBody> {
  try {
    const parsed = (await res.json()) as Partial<OperatorApiErrorBody>;
    return {
      code: parsed.code ?? 'UPSTREAM_ERROR',
      message: parsed.message ?? `api-rest returned ${res.status}`,
    };
  } catch {
    return { code: 'UPSTREAM_ERROR', message: `api-rest returned ${res.status}` };
  }
}
