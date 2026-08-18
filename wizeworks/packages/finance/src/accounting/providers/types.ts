// The accounting adapter contract (docs/148 §6, docs/146 Phase 10.7–10.8).
//
// One interface, two live implementations (QuickBooks Online, Xero), and the
// deliberate absence of a third. Everything above this line — the connection,
// the mapping table, the sync-run log — is provider-agnostic and already
// existed; this is the part that actually talks to somebody else's server.
//
// ── What an adapter must be able to do, and why each one is here ─────────────
//
//   authorizeUrl / exchangeCode / refresh
//     OAuth 2. The tenant's own grant, never a platform credential.
//
//   listAccounts
//     THE most important call in the file, and the one an integration that
//     "supports QuickBooks" usually skips. docs/148 §6 rule 2: map before you
//     sync. Without their real chart of accounts the mapping screen is a
//     free-text box, and a free-text box means somebody types "COGS" and the
//     first sync posts to a suspense account.
//
//   accountBalance
//     What the inventory account actually holds, which is the other half of the
//     reconciliation in 10.9. sparx keeps no ledger, so this is the only way to
//     get that number without a person reading a trial balance aloud.
//
//   postJournal
//     The entry itself. Idempotent by an external reference the adapter sets, so
//     a retry after a timeout finds the existing entry rather than posting the
//     month twice.
//
// ── Availability is a deployment fact, not a code fact ───────────────────────
//
// Both adapters are complete. Whether a tenant can CONNECT one depends on
// whether this deployment has an OAuth app registered with that vendor, which is
// an environment variable, not a feature. `isConfigured()` reports it honestly
// so the panel can say "not switched on here" rather than offering a button that
// fails at the redirect.

// ── Why the journal is described here and not imported ──────────────────────
//
// The obvious move is to import `InventoryJournal` from @wizeworks/commerce-schemas,
// where the arithmetic that builds it lives. That would make @wizeworks/finance
// depend on commerce, and finance is explicitly for a business with no store —
// a repair shop, a bakery, a consultancy (docs/148 §1). An adapter also does not
// need to know it is posting an INVENTORY journal; it needs a balanced set of
// debits and credits with an account role on each line.
//
// So the shape is described structurally. Anything satisfying it can be posted,
// which is what makes this the accounting transport rather than the inventory
// module's private plumbing.

export interface JournalDocumentLine {
  /** Which mapped account this line posts to. A string, not a union: the roles
   *  are the caller's vocabulary, and `accounts` below is keyed by the same. */
  role: string;
  /** Positive cents. A line is a debit or a credit, never a signed amount. */
  debitCents: number;
  creditCents: number;
  description: string;
}

export interface JournalDocument {
  /** ISO. The day the entry posts. */
  postingDate: string;
  currency: string;
  lines: JournalDocumentLine[];
  /** Debits minus credits. An adapter refuses anything non-zero rather than
   *  letting the provider half-write it. */
  imbalanceCents: number;
}

export interface AccountingCredentials {
  accessToken: string;
  refreshToken: string | null;
  /** The connected company file, as the vendor identifies it. QuickBooks calls
   *  it a realm id; Xero calls it a tenant id. */
  externalId: string | null;
  expiresAt: Date | null;
}

export interface RefreshedCredentials {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

/** One line of their chart of accounts, normalised. */
export interface ExternalAccount {
  externalId: string;
  name: string;
  code: string | null;
  /** Their type string, verbatim. Not normalised into our own vocabulary: the
   *  mapping screen shows it so a person can tell two accounts apart, and an
   *  imperfect translation would make that harder rather than easier. */
  type: string | null;
  /** Present where the provider returns it on the account list. */
  balanceCents: number | null;
  currency: string | null;
  active: boolean;
}

export interface PostJournalRequest {
  journal: JournalDocument;
  /** role → their account id (QuickBooks) or account code (Xero), from the
   *  mapping table. A line whose role is absent is not posted, which is why the
   *  caller gates on a complete mapping before getting here. */
  accounts: Record<string, string>;
  /** Ours. Sent as their document number / narration reference so a retry is
   *  detectable and an accountant can trace an entry back. */
  reference: string;
  memo: string;
}

export interface PostJournalResult {
  externalId: string;
  /** True when the provider already had this reference and nothing new was
   *  written — the retry case, and a success rather than an error. */
  alreadyPosted: boolean;
}

export class AccountingAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountingAuthError';
  }
}

/** Their server said the request itself is wrong. Never retried — a redelivery
 *  of the same payload fails identically, and retrying a rejected journal is how
 *  a queue fills with something nobody will ever fix by waiting. */
export class AccountingRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'AccountingRequestError';
  }
}

export interface AccountingAdapter {
  provider: 'quickbooks_online' | 'xero';
  name: string;
  /** False when this deployment has no OAuth app for the vendor. The panel says
   *  so plainly instead of offering a connect button that dies at the redirect. */
  isConfigured(): boolean;
  /** Why not, in the owner's language, when `isConfigured()` is false. */
  unavailableReason(): string;
  authorizeUrl(input: { state: string; redirectUri: string }): string;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    /** QuickBooks returns the company file id as a query param on the callback
     *  rather than in the token response; Xero needs a second call. The route
     *  passes whatever the callback carried and the adapter uses what it needs. */
    callbackParams?: Record<string, string>;
  }): Promise<AccountingCredentials>;
  refresh(refreshToken: string): Promise<RefreshedCredentials>;
  listAccounts(credentials: AccountingCredentials): Promise<ExternalAccount[]>;
  accountBalance(
    credentials: AccountingCredentials,
    accountExternalId: string,
    asOf: Date
  ): Promise<{ balanceCents: number; currency: string } | null>;
  postJournal(
    credentials: AccountingCredentials,
    request: PostJournalRequest
  ): Promise<PostJournalResult>;
}

/** Cents → the decimal string every accounting API wants. Kept here rather than
 *  in each adapter because a rounding difference between two providers would be
 *  a rounding difference between two sets of the same books. */
export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Their amount → cents, tolerant of a string or a number. Rounds rather than
 *  truncates: 12.005 arriving as a float must not become 1200. */
export function amountToCents(amount: string | number | null | undefined): number | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
