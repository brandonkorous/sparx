// Xero (docs/146 Phase 10.8).
//
// The same contract as QuickBooks and a genuinely different shape underneath,
// which is why this is a second adapter rather than a configuration of the
// first:
//
//   The company file is a TENANT, identified by a `xero-tenant-id` HEADER on
//   every request rather than a path segment, and it is discovered by calling
//   `/connections` AFTER the token exchange. One grant can carry several
//   organisations; sparx connects one, and which one is a decision the tenant
//   makes at connect time.
//
//   Accounts are addressed by CODE, not by id, in a journal — `AccountCode`,
//   their "200", "620". So the mapping table stores the code for Xero where it
//   stores an opaque id for QuickBooks, and `ExternalAccount.externalId` is the
//   code here on purpose. Mapping to their internal `AccountID` would produce a
//   mapping screen that looks right and journals that Xero rejects.
//
//   A journal is a `ManualJournal`, and it is posted in DRAFT unless told
//   otherwise. Draft is the right default and is kept: an accountant reviewing
//   sparx's first month before it hits the books is exactly the cautious
//   behaviour docs/148 §6 asks for.

import {
  AccountingAuthError,
  AccountingRequestError,
  amountToCents,
  centsToAmount,
  type AccountingAdapter,
  type AccountingCredentials,
  type ExternalAccount,
  type PostJournalRequest,
  type PostJournalResult,
  type RefreshedCredentials,
} from './types';

const AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const API_HOST = 'https://api.xero.com/api.xro/2.0';
const CONNECTIONS_URL = 'https://api.xero.com/connections';

/** `offline_access` is what makes the refresh token exist at all — without it
 *  the connection dies in thirty minutes and nobody can work out why. */
const SCOPES = 'offline_access accounting.transactions accounting.settings';

function clientId(): string | undefined {
  return process.env.SPARX_XERO_CLIENT_ID;
}
function clientSecret(): string | undefined {
  return process.env.SPARX_XERO_CLIENT_SECRET;
}
function basicAuth(): string {
  return Buffer.from(`${clientId() ?? ''}:${clientSecret() ?? ''}`).toString('base64');
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function token(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basicAuth()}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    throw new AccountingAuthError(
      json.error_description ?? json.error ?? `Xero refused the token request (${res.status})`
    );
  }
  return json;
}

async function call<T>(
  credentials: AccountingCredentials,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  if (!credentials.externalId) {
    throw new AccountingAuthError(
      'This Xero connection is missing its organisation. Disconnect and reconnect it.'
    );
  }
  const res = await fetch(`${API_HOST}/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${credentials.accessToken}`,
      'xero-tenant-id': credentials.externalId,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  if (res.status === 401) {
    throw new AccountingAuthError('Xero no longer accepts this connection — reconnect it.');
  }
  if (res.status >= 400 && res.status < 500) {
    const text = await res.text().catch(() => '');
    throw new AccountingRequestError(
      `Xero rejected the request: ${text.slice(0, 300)}`,
      res.status
    );
  }
  if (!res.ok) {
    throw new Error(`Xero is unavailable (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as T;
}

interface XeroAccount {
  AccountID: string;
  Code?: string;
  Name: string;
  Type?: string;
  Class?: string;
  Status?: string;
  CurrencyCode?: string;
}

interface XeroReportCell {
  Value?: string;
}
interface XeroReportRow {
  RowType?: string;
  Cells?: XeroReportCell[];
  Rows?: XeroReportRow[];
}

export const xeroAdapter: AccountingAdapter = {
  provider: 'xero',
  name: 'Xero',

  isConfigured() {
    return Boolean(clientId() && clientSecret());
  },

  unavailableReason() {
    return 'Direct Xero sync is not switched on for this installation. You can still export a spreadsheet below and import it into Xero today.';
  },

  authorizeUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId() ?? '',
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const json = await token(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      })
    );
    if (!json.access_token) throw new AccountingAuthError('Xero did not return an access token');

    // The organisation is not in the token response. One extra call, and the
    // FIRST connection is taken: a tenant with several organisations picks the
    // one they want by authorising only that one at the consent screen, which is
    // how Xero's own flow expects this to be handled.
    const res = await fetch(CONNECTIONS_URL, {
      headers: { authorization: `Bearer ${json.access_token}`, accept: 'application/json' },
    });
    const connections = res.ok
      ? ((await res.json()) as { tenantId?: string; tenantName?: string }[])
      : [];
    const organisation = connections[0]?.tenantId ?? null;
    if (!organisation) {
      throw new AccountingAuthError(
        'That Xero login is not connected to an organisation sparx can use.'
      );
    }

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      externalId: organisation,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    };
  },

  async refresh(refreshToken): Promise<RefreshedCredentials> {
    const json = await token(
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
    );
    if (!json.access_token) {
      throw new AccountingAuthError('Xero did not return a refreshed access token');
    }
    return {
      accessToken: json.access_token,
      // Xero rotates the refresh token on every use and expires the old one
      // immediately. Failing to store the new one breaks the connection on the
      // NEXT refresh, not this one, which is what makes it hard to spot.
      refreshToken: json.refresh_token ?? refreshToken,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    };
  },

  async listAccounts(credentials): Promise<ExternalAccount[]> {
    const json = await call<{ Accounts?: XeroAccount[] }>(credentials, 'Accounts');
    return (json.Accounts ?? [])
      .filter((account) => account.Code)
      .map((account) => ({
        // The CODE, deliberately — a Xero journal addresses accounts by code,
        // so mapping to the internal id would produce journals Xero refuses.
        externalId: account.Code ?? account.AccountID,
        name: account.Name,
        code: account.Code ?? null,
        type: account.Type ?? account.Class ?? null,
        // Not on the account list. Null rather than 0 — the balance exists and
        // this call does not know it, which is not the same as it being nothing.
        balanceCents: null,
        currency: account.CurrencyCode ?? null,
        active: account.Status !== 'ARCHIVED',
      }));
  },

  async accountBalance(credentials, accountExternalId, asOf) {
    // Xero's trial balance IS available as of a date, which is better than
    // QuickBooks manages — so the reconciliation against Xero can be drawn for
    // a month that closed, not only for today.
    const date = asOf.toISOString().slice(0, 10);
    const json = await call<{ Reports?: { Rows?: XeroReportRow[] }[] }>(
      credentials,
      `Reports/TrialBalance?date=${date}`
    );
    const rows = json.Reports?.[0]?.Rows ?? [];
    for (const section of rows) {
      for (const row of section.Rows ?? []) {
        const cells = row.Cells ?? [];
        const label = cells[0]?.Value ?? '';
        // Their trial-balance rows label as "Name (CODE)".
        if (!label.includes(`(${accountExternalId})`)) continue;
        // Debit column, then credit — an asset account carries a debit balance
        // and a credit there means the account is negative, which is a real and
        // reportable state rather than an error.
        const debit = amountToCents(cells[1]?.Value ?? null);
        const credit = amountToCents(cells[2]?.Value ?? null);
        const balanceCents = (debit ?? 0) - (credit ?? 0);
        if (debit === null && credit === null) return null;
        return { balanceCents, currency: 'USD' };
      }
    }
    return null;
  },

  async postJournal(credentials, request: PostJournalRequest): Promise<PostJournalResult> {
    // Idempotency by narration: Xero has no idempotency key on manual journals,
    // so the reference is written into the narration and looked for first.
    const existing = await call<{ ManualJournals?: { ManualJournalID: string }[] }>(
      credentials,
      `ManualJournals?where=${encodeURIComponent(`Narration.Contains("${request.reference}")`)}`
    );
    const already = existing.ManualJournals?.[0];
    if (already) return { externalId: already.ManualJournalID, alreadyPosted: true };

    const lines = request.journal.lines.flatMap((line) => {
      const accountCode = request.accounts[line.role];
      if (!accountCode) return [];
      // Xero signs the amount instead of naming a posting type: positive is a
      // debit, negative a credit.
      const signedCents = line.debitCents > 0 ? line.debitCents : -line.creditCents;
      return [
        {
          Description: line.description,
          LineAmount: Number(centsToAmount(signedCents)),
          AccountCode: accountCode,
        },
      ];
    });

    const created = await call<{ ManualJournals?: { ManualJournalID: string }[] }>(
      credentials,
      'ManualJournals',
      {
        method: 'POST',
        body: {
          ManualJournals: [
            {
              Narration: `${request.memo} [${request.reference}]`,
              Date: request.journal.postingDate.slice(0, 10),
              // DRAFT on purpose. An accountant reviewing sparx's first month
              // before it reaches the books is the cautious first month
              // docs/148 §6 asks for, and posting straight to the ledger takes
              // that choice away from them.
              Status: 'DRAFT',
              LineAmountTypes: 'NoTax',
              JournalLines: lines,
            },
          ],
        },
      }
    );

    const id = created.ManualJournals?.[0]?.ManualJournalID;
    if (!id) throw new AccountingRequestError('Xero accepted the entry but returned no id', 502);
    return { externalId: id, alreadyPosted: false };
  },
};
