// QuickBooks Online (docs/146 Phase 10.7).
//
// The one an accountant is most likely to already be in. Two things about their
// API shape the code below:
//
//   The company file is called a REALM, and its id arrives as a query parameter
//   on the OAuth callback rather than in the token response. Miss it and every
//   subsequent request 401s with a message about authentication that has nothing
//   to do with the token.
//
//   Their query language is SQL-shaped but is NOT SQL. `SELECT * FROM Account`
//   works; a parameter placeholder does not. Everything interpolated into a
//   query below is either a literal from this file or an id we have escaped,
//   because there is no bind mechanism to use instead.
//
// Sandbox and production are different HOSTS with the same code. The host is an
// environment variable so a tenant on a staging deployment talks to the sandbox
// without a second adapter.

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

const AUTH_HOST = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const MINOR_VERSION = '75';

/** Read-write on accounting is the narrowest grant that can both read a chart of
 *  accounts and post a journal. `openid` is not requested: sparx does not sign
 *  anyone in with Intuit and asking for identity scopes we never read is the
 *  sort of thing that makes an app review take a month. */
const SCOPES = 'com.intuit.quickbooks.accounting';

function clientId(): string | undefined {
  return process.env.SPARX_QBO_CLIENT_ID;
}
function clientSecret(): string | undefined {
  return process.env.SPARX_QBO_CLIENT_SECRET;
}
function apiHost(): string {
  return process.env.SPARX_QBO_API_HOST ?? 'https://quickbooks.api.intuit.com';
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
      accept: 'application/json',
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    throw new AccountingAuthError(
      json.error_description ?? json.error ?? `QuickBooks refused the token request (${res.status})`
    );
  }
  return json;
}

/** Every data call. Splits 401 (reconnect) from 4xx (the request is wrong and
 *  will stay wrong) from 5xx (try again later), because the three want three
 *  different things from the caller. */
async function call<T>(
  credentials: AccountingCredentials,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  if (!credentials.externalId) {
    throw new AccountingAuthError(
      'This QuickBooks connection is missing its company file. Disconnect and reconnect it.'
    );
  }
  const url = `${apiHost()}/v3/company/${encodeURIComponent(credentials.externalId)}/${path}${
    path.includes('?') ? '&' : '?'
  }minorversion=${MINOR_VERSION}`;

  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${credentials.accessToken}`,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  if (res.status === 401) {
    throw new AccountingAuthError('QuickBooks no longer accepts this connection — reconnect it.');
  }
  if (res.status >= 400 && res.status < 500) {
    const text = await res.text().catch(() => '');
    throw new AccountingRequestError(
      `QuickBooks rejected the request: ${text.slice(0, 300)}`,
      res.status
    );
  }
  if (!res.ok) {
    throw new Error(`QuickBooks is unavailable (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as T;
}

interface QboAccount {
  Id: string;
  Name: string;
  AcctNum?: string;
  AccountType?: string;
  AccountSubType?: string;
  CurrentBalance?: number;
  CurrencyRef?: { value?: string };
  Active?: boolean;
}

interface QboQueryResponse {
  QueryResponse?: {
    Account?: QboAccount[];
    JournalEntry?: { Id: string }[];
  };
}

export const quickbooksAdapter: AccountingAdapter = {
  provider: 'quickbooks_online',
  name: 'QuickBooks Online',

  isConfigured() {
    return Boolean(clientId() && clientSecret());
  },

  unavailableReason() {
    return 'Direct QuickBooks sync is not switched on for this installation. You can still export a spreadsheet below and import it into QuickBooks today.';
  },

  authorizeUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      client_id: clientId() ?? '',
      response_type: 'code',
      scope: SCOPES,
      redirect_uri: redirectUri,
      state,
    });
    return `${AUTH_HOST}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri, callbackParams }) {
    const json = await token(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      })
    );
    if (!json.access_token) {
      throw new AccountingAuthError('QuickBooks did not return an access token');
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      // The realm id is ONLY on the callback query string. Without it every
      // later call fails with an authentication error that looks like a token
      // problem and is not.
      externalId: callbackParams?.realmId ?? null,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    };
  },

  async refresh(refreshToken): Promise<RefreshedCredentials> {
    const json = await token(
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
    );
    if (!json.access_token) {
      throw new AccountingAuthError('QuickBooks did not return a refreshed access token');
    }
    return {
      accessToken: json.access_token,
      // Intuit rotates the refresh token. Keeping the old one is how a
      // connection dies silently a hundred days later.
      refreshToken: json.refresh_token ?? refreshToken,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    };
  },

  async listAccounts(credentials): Promise<ExternalAccount[]> {
    const query = encodeURIComponent('SELECT * FROM Account MAXRESULTS 1000');
    const json = await call<QboQueryResponse>(credentials, `query?query=${query}`);
    return (json.QueryResponse?.Account ?? []).map((account) => ({
      externalId: account.Id,
      name: account.Name,
      code: account.AcctNum ?? null,
      type: account.AccountSubType ?? account.AccountType ?? null,
      balanceCents: amountToCents(account.CurrentBalance),
      currency: account.CurrencyRef?.value ?? null,
      active: account.Active !== false,
    }));
  },

  async accountBalance(credentials, accountExternalId) {
    // `CurrentBalance` on the account object, not a report call. It is the
    // balance as of NOW, which is what a reconciliation drawn today wants; a
    // historical balance needs their Balance Sheet report and a different
    // permission, and offering a stale-but-precise-looking number would be
    // worse than offering today's.
    const query = encodeURIComponent(
      `SELECT * FROM Account WHERE Id = '${accountExternalId.replace(/'/g, "\\'")}'`
    );
    const json = await call<QboQueryResponse>(credentials, `query?query=${query}`);
    const account = json.QueryResponse?.Account?.[0];
    if (!account) return null;
    const balanceCents = amountToCents(account.CurrentBalance);
    if (balanceCents === null) return null;
    return { balanceCents, currency: account.CurrencyRef?.value ?? 'USD' };
  },

  async postJournal(credentials, request: PostJournalRequest): Promise<PostJournalResult> {
    // Idempotency: look for an entry already carrying our reference before
    // writing one. QuickBooks has no idempotency key, and a timeout on a POST
    // that actually succeeded is the ordinary way a month gets posted twice.
    const existingQuery = encodeURIComponent(
      `SELECT Id FROM JournalEntry WHERE DocNumber = '${request.reference.replace(/'/g, "\\'")}'`
    );
    const existing = await call<QboQueryResponse>(credentials, `query?query=${existingQuery}`);
    const already = existing.QueryResponse?.JournalEntry?.[0];
    if (already) return { externalId: already.Id, alreadyPosted: true };

    const lines = request.journal.lines.flatMap((line) => {
      const accountId = request.accounts[line.role];
      if (!accountId) return [];
      const isDebit = line.debitCents > 0;
      return [
        {
          Description: line.description,
          Amount: Number(centsToAmount(isDebit ? line.debitCents : line.creditCents)),
          DetailType: 'JournalEntryLineDetail',
          JournalEntryLineDetail: {
            PostingType: isDebit ? 'Debit' : 'Credit',
            AccountRef: { value: accountId },
          },
        },
      ];
    });

    const created = await call<{ JournalEntry?: { Id: string } }>(credentials, 'journalentry', {
      method: 'POST',
      body: {
        DocNumber: request.reference,
        TxnDate: request.journal.postingDate.slice(0, 10),
        PrivateNote: request.memo,
        CurrencyRef: { value: request.journal.currency },
        Line: lines,
      },
    });

    const id = created.JournalEntry?.Id;
    if (!id)
      throw new AccountingRequestError('QuickBooks accepted the entry but returned no id', 502);
    return { externalId: id, alreadyPosted: false };
  },
};
