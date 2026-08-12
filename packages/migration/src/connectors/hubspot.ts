// HubSpot, live.
//
// The CSV path works and is the one most people take, but it has a specific hole this
// closes. HubSpot's export writes a deal's stage and a ticket's status as the LABEL a
// human sees ("Closed Won"), while the API writes the internal id (`closedwon`) — and
// a portal that renamed its stages, which is most of them, exports labels that mean
// nothing to anyone else. So this connector reads the pipeline definitions first and
// translates ids back into that portal's own words. Without that step every deal
// would land as `open`, including the ones that were won.
//
// The other thing the API gives us that a CSV cannot: associations. A deal's company
// and contact come back as ids, and one batch-read per page turns them into the name
// and the email address the CRM processors match on. In the CSV those columns are
// only populated if the person exporting remembered to add them.
//
// Everything else routes through the same mappers as the CSV, so a portal that
// spells a property oddly is handled once rather than twice.

import type { CanonicalEntity, CanonicalRow } from '../canonical';
import { hubspotInternals } from '../vendors/hubspot';
import type { SourceRow } from '../parse/csv';
import {
  ConnectorError,
  asArray,
  asRecord,
  asText,
  dig,
  digText,
  firstText,
  query,
  requestJson,
} from './http';
import type { Connector, Credentials, FetchLike, PullPage } from './types';

const API = 'https://api.hubapi.com';
const PAGE_SIZE = 100;

function token(credentials: Credentials): string {
  const value = (credentials.accessToken ?? '').trim();
  if (value === '') {
    throw new ConnectorError('We need the access token from your HubSpot private app.', {
      hint: 'Settings → Integrations → Private apps → your app → Auth.',
    });
  }
  return value;
}

function get(
  fetchLike: FetchLike,
  credentials: Credentials,
  path: string,
  params: Record<string, string | number | undefined>,
  what: string
): Promise<unknown> {
  return requestJson(fetchLike, `${API}${path}${query(params)}`, {
    headers: { Authorization: `Bearer ${token(credentials)}`, Accept: 'application/json' },
    what,
  });
}

function post(
  fetchLike: FetchLike,
  credentials: Credentials,
  path: string,
  body: unknown,
  what: string
): Promise<unknown> {
  return requestJson(fetchLike, `${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token(credentials)}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    what,
  });
}

// ── Which properties to ask for ──────────────────────────────────────────────
//
// HubSpot returns almost nothing unless each property is named, so these lists ARE
// the import. A property missing here is a column silently absent from the migration,
// which is why they mirror the alias lists in vendors/hubspot.ts rather than being
// picked freshly.

const PROPERTIES: Record<string, string[]> = {
  contacts: [
    'email',
    'firstname',
    'lastname',
    'phone',
    'mobilephone',
    'company',
    'address',
    'city',
    'state',
    'country',
    'zip',
    'lifecyclestage',
    'hs_lead_status',
    'hs_marketable_status',
    'createdate',
  ],
  companies: [
    'name',
    'domain',
    'phone',
    'industry',
    'numberofemployees',
    'annualrevenue',
    'address',
    'city',
    'state',
    'country',
    'zip',
    'description',
    'createdate',
    'hubspot_owner_id',
  ],
  deals: [
    'dealname',
    'pipeline',
    'dealstage',
    'amount',
    'deal_currency_code',
    'closedate',
    'hs_deal_stage_probability',
    'dealtype',
    'hs_analytics_source',
    'createdate',
    'hubspot_owner_id',
  ],
  tickets: [
    'subject',
    'content',
    'hs_pipeline',
    'hs_pipeline_stage',
    'hs_ticket_priority',
    'createdate',
    'closed_date',
    'hubspot_owner_id',
  ],
};

// ── Lookups that make the ids mean something ─────────────────────────────────

interface Pipelines {
  /** Pipeline id → the name the portal calls it. */
  pipeline: Map<string, string>;
  /** Stage id → the label. Stage ids are unique across pipelines. */
  stage: Map<string, string>;
}

/**
 * Read a portal's pipelines so `closedwon` can become "Closed Won".
 *
 * One call per page of deals. It could be cached across pages, but a pull is
 * deliberately stateless between HTTP requests — and one small request against a list
 * that is never longer than a few dozen rows is a cheaper thing to carry than a cache
 * with an invalidation story.
 */
async function readPipelines(
  fetchLike: FetchLike,
  credentials: Credentials,
  objectType: 'deals' | 'tickets'
): Promise<Pipelines> {
  const pipeline = new Map<string, string>();
  const stage = new Map<string, string>();

  // A portal whose token lacks the pipelines scope still migrates — it just keeps
  // the raw ids, which is worse but not broken. Failing the whole pull over a label
  // lookup would be the wrong trade.
  const body = await get(
    fetchLike,
    credentials,
    `/crm/v3/pipelines/${objectType}`,
    {},
    'your pipelines'
  ).catch(() => null);

  for (const raw of asArray(dig(body, 'results'))) {
    const entry = asRecord(raw);
    pipeline.set(asText(entry.id), asText(entry.label));
    for (const rawStage of asArray(entry.stages)) {
      const stageEntry = asRecord(rawStage);
      stage.set(asText(stageEntry.id), asText(stageEntry.label));
    }
  }

  return { pipeline, stage };
}

/** Owner id → email, so "assigned to" survives the move as a person rather than a
 *  number. The owner list is small enough to read whole. */
async function readOwners(
  fetchLike: FetchLike,
  credentials: Credentials
): Promise<Map<string, string>> {
  const owners = new Map<string, string>();
  const body = await get(
    fetchLike,
    credentials,
    '/crm/v3/owners',
    { limit: 500 },
    'your team'
  ).catch(() => null);

  for (const raw of asArray(dig(body, 'results'))) {
    const owner = asRecord(raw);
    const email = asText(owner.email);
    if (email !== '') owners.set(asText(owner.id), email);
  }
  return owners;
}

/** Ids on THIS page → the one property that names them. Batch-read, so a page of a
 *  hundred deals costs one extra request rather than a hundred. */
async function readNames(
  fetchLike: FetchLike,
  credentials: Credentials,
  objectType: 'companies' | 'contacts',
  ids: Set<string>,
  property: string
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.size === 0) return names;

  // HubSpot's batch read caps at 100 inputs.
  const list = [...ids].slice(0, 100);
  const body = await post(
    fetchLike,
    credentials,
    `/crm/v3/objects/${objectType}/batch/read`,
    { properties: [property], inputs: list.map((id) => ({ id })) },
    objectType === 'companies' ? 'the companies these belong to' : 'the contacts these belong to'
  ).catch(() => null);

  for (const raw of asArray(dig(body, 'results'))) {
    const record = asRecord(raw);
    const value = digText(record, 'properties', property);
    if (value !== '') names.set(asText(record.id), value);
  }
  return names;
}

/** The association ids of one kind on a record. */
function associationIds(record: Record<string, unknown>, kind: string): string[] {
  return asArray(dig(record, 'associations', kind, 'results'))
    .map((entry) => asText(asRecord(entry).id))
    .filter((id) => id !== '');
}

/**
 * The first association of a kind, named.
 *
 * HubSpot lets a deal belong to several companies; our deal has one. Taking the first
 * that resolved is the honest simplification — the alternative is inventing a
 * relationship model on the way in, which is a decision for the CRM and not for an
 * importer.
 */
function associatedName(
  record: Record<string, unknown>,
  kind: string,
  names: Map<string, string>
): string {
  for (const id of associationIds(record, kind)) {
    const name = names.get(id);
    if (name !== undefined && name !== '') return name;
  }
  return '';
}

// ── Object → the CSV column names the mappers read ───────────────────────────

function properties(record: Record<string, unknown>): Record<string, unknown> {
  return asRecord(record.properties);
}

function contactRows(body: unknown[], companies: Map<string, string>): SourceRow[] {
  return body.map((raw) => {
    const record = asRecord(raw);
    const property = properties(record);
    const company = firstText(
      asText(property.company),
      associatedName(record, 'companies', companies)
    );

    return {
      Email: asText(property.email),
      'First Name': asText(property.firstname),
      'Last Name': asText(property.lastname),
      'Phone Number': firstText(asText(property.phone), asText(property.mobilephone)),
      'Company Name': company,
      'Street Address': asText(property.address),
      City: asText(property.city),
      'State/Region': asText(property.state),
      'Country/Region': asText(property.country),
      'Postal Code': asText(property.zip),
      'Lifecycle Stage': asText(property.lifecyclestage),
      'Lead Status': asText(property.hs_lead_status),
      // The mapper reads this exact phrase, because it is what HubSpot's own export
      // writes; the API says true/false for the same fact.
      'Marketing contact status':
        asText(property.hs_marketable_status) === 'false'
          ? 'Non-marketing contact'
          : 'Marketing contact',
      'Create Date': asText(property.createdate),
    };
  });
}

function companyRows(body: unknown[], owners: Map<string, string>): SourceRow[] {
  return body.map((raw) => {
    const property = properties(asRecord(raw));
    return {
      'Company name': asText(property.name),
      'Company Domain Name': asText(property.domain),
      'Phone Number': asText(property.phone),
      Industry: asText(property.industry),
      'Number of Employees': asText(property.numberofemployees),
      'Annual Revenue': asText(property.annualrevenue),
      'Street Address': asText(property.address),
      City: asText(property.city),
      'State/Region': asText(property.state),
      'Country/Region': asText(property.country),
      'Postal Code': asText(property.zip),
      'Company owner': owners.get(asText(property.hubspot_owner_id)) ?? '',
      Description: asText(property.description),
      'Create Date': asText(property.createdate),
    };
  });
}

function dealRows(
  body: unknown[],
  pipelines: Pipelines,
  owners: Map<string, string>,
  companies: Map<string, string>,
  contacts: Map<string, string>
): SourceRow[] {
  return body.map((raw) => {
    const record = asRecord(raw);
    const property = properties(record);
    const stageId = asText(property.dealstage);
    const pipelineId = asText(property.pipeline);

    return {
      'Deal Name': asText(property.dealname),
      // Fall back to the id when the label lookup was not permitted — an unlabelled
      // stage still names something the tenant will recognise, and it is what the
      // pipeline processor creates the stage from.
      Pipeline: pipelines.pipeline.get(pipelineId) ?? pipelineId,
      'Deal Stage': pipelines.stage.get(stageId) ?? stageId,
      Amount: asText(property.amount),
      Currency: asText(property.deal_currency_code),
      'Close Date': asText(property.closedate),
      'Deal probability': asText(property.hs_deal_stage_probability),
      'Deal owner': owners.get(asText(property.hubspot_owner_id)) ?? '',
      'Associated Company': associatedName(record, 'companies', companies),
      'Associated Contact': associatedName(record, 'contacts', contacts),
      'Original Source': firstText(asText(property.hs_analytics_source), asText(property.dealtype)),
      'Create Date': asText(property.createdate),
    };
  });
}

function ticketRows(
  body: unknown[],
  pipelines: Pipelines,
  owners: Map<string, string>,
  companies: Map<string, string>,
  contacts: Map<string, string>
): SourceRow[] {
  return body.map((raw) => {
    const record = asRecord(raw);
    const property = properties(record);
    const stageId = asText(property.hs_pipeline_stage);
    const pipelineId = asText(property.hs_pipeline);
    const stage = pipelines.stage.get(stageId) ?? stageId;

    return {
      'Ticket name': asText(property.subject),
      'Ticket description': asText(property.content),
      // Status and stage are the same column in HubSpot; the mapper reads both names.
      'Ticket status': stage,
      'Ticket Stage': stage,
      Pipeline: pipelines.pipeline.get(pipelineId) ?? pipelineId,
      Priority: asText(property.hs_ticket_priority),
      'Ticket owner': owners.get(asText(property.hubspot_owner_id)) ?? '',
      'Associated Company': associatedName(record, 'companies', companies),
      'Associated Contact': associatedName(record, 'contacts', contacts),
      'Create date': asText(property.createdate),
      'Close date': asText(property.closed_date),
    };
  });
}

// ── Pulling ──────────────────────────────────────────────────────────────────

const OBJECT_FOR: Partial<Record<CanonicalEntity, 'contacts' | 'companies' | 'deals' | 'tickets'>> =
  {
    customers: 'contacts',
    companies: 'companies',
    deals: 'deals',
    tickets: 'tickets',
  };

const WHAT: Record<string, string> = {
  contacts: 'your contacts',
  companies: 'your companies',
  deals: 'your deals',
  tickets: 'your tickets',
};

function collectIds(body: unknown[], kind: string): Set<string> {
  const ids = new Set<string>();
  for (const raw of body) for (const id of associationIds(asRecord(raw), kind)) ids.add(id);
  return ids;
}

export const hubspotConnector: Connector = {
  slug: 'hubspot',
  label: 'HubSpot',
  vendors: ['hubspot'],
  instructions: [
    'In HubSpot, go to Settings (the cog, top right) → Integrations → Private apps.',
    'Click "Create a private app" and name it anything — "sparx migration" is fine.',
    'On the Scopes tab, tick the read boxes for crm.objects.contacts, crm.objects.companies, crm.objects.deals, tickets, crm.objects.owners and crm.pipelines.',
    'Create the app, then copy the access token from the Auth tab. It starts with pat-.',
    'Everything requested is read-only. Nothing here can change anything in HubSpot.',
  ],
  fields: [
    {
      key: 'accessToken',
      label: 'Private app access token',
      help: 'From the Auth tab of the private app you just made. It starts with pat-.',
      placeholder: 'pat-na1-…',
      secret: true,
      required: true,
      pattern: '^pat-[a-z0-9-]{5,}',
      patternHint:
        'HubSpot private app tokens start with pat-. The developer API key and the app id are different things.',
    },
  ],
  resources: [
    { entity: 'customers', label: 'Contacts', pageSize: PAGE_SIZE },
    { entity: 'companies', label: 'Companies', pageSize: PAGE_SIZE },
    {
      entity: 'deals',
      label: 'Deals, with their pipeline and stage',
      pageSize: PAGE_SIZE,
      note: 'Stage names come across as your team wrote them, not as HubSpot spells them internally.',
    },
    { entity: 'tickets', label: 'Tickets', pageSize: PAGE_SIZE },
  ],

  async verify({ credentials, fetch }) {
    // Account details is the nicer answer because it names the portal, but the scope
    // for it is not one anybody thinks to tick. A token that can read contacts can
    // do the migration, so that is the real test and this is the label.
    const details = await get(
      fetch,
      credentials,
      '/account-info/v3/details',
      {},
      'your account'
    ).catch(() => null);

    const portal = asText(asRecord(details).portalId);
    const domain = asText(asRecord(details).uiDomain);
    if (portal !== '') {
      return { account: `HubSpot account ${portal}`, detail: domain === '' ? undefined : domain };
    }

    await get(fetch, credentials, '/crm/v3/objects/contacts', { limit: 1 }, 'your contacts');
    return {
      account: 'Your HubSpot account',
      detail: 'Connected. Add the account-info scope if you want us to name the portal.',
    };
  },

  async pull(input): Promise<PullPage> {
    const objectType = OBJECT_FOR[input.entity];
    if (objectType === undefined) {
      throw new ConnectorError(`We do not read ${input.entity} from HubSpot.`);
    }

    const associate =
      objectType === 'deals' || objectType === 'tickets'
        ? 'companies,contacts'
        : objectType === 'contacts'
          ? 'companies'
          : undefined;

    const body = await get(
      input.fetch,
      input.credentials,
      `/crm/v3/objects/${objectType}`,
      {
        limit: PAGE_SIZE,
        after: input.cursor ?? undefined,
        properties: (PROPERTIES[objectType] ?? []).join(','),
        associations: associate,
        archived: 'false',
      },
      WHAT[objectType] ?? 'your records'
    );

    const results = asArray(dig(body, 'results'));
    const nextCursor = digText(body, 'paging', 'next', 'after');

    const page: PullPage = {
      entity: input.entity,
      rows: [],
      fetched: results.length,
      nextCursor: nextCursor === '' ? null : nextCursor,
    };

    if (results.length === 0) return page;

    // Everything below is per-page and independent, so it goes out together rather
    // than one after another — four sequential lookups per page would double the
    // wall-clock of a big CRM.
    const [owners, companies, contacts, pipelines] = await Promise.all([
      objectType === 'contacts'
        ? Promise.resolve(new Map<string, string>())
        : readOwners(input.fetch, input.credentials),
      readNames(
        input.fetch,
        input.credentials,
        'companies',
        collectIds(results, 'companies'),
        'name'
      ),
      objectType === 'deals' || objectType === 'tickets'
        ? readNames(
            input.fetch,
            input.credentials,
            'contacts',
            collectIds(results, 'contacts'),
            'email'
          )
        : Promise.resolve(new Map<string, string>()),
      objectType === 'deals' || objectType === 'tickets'
        ? readPipelines(input.fetch, input.credentials, objectType)
        : Promise.resolve<Pipelines>({ pipeline: new Map(), stage: new Map() }),
    ]);

    const rows: CanonicalRow[] =
      objectType === 'contacts'
        ? hubspotInternals.mapContacts(contactRows(results, companies))
        : objectType === 'companies'
          ? hubspotInternals.mapCompanies(companyRows(results, owners))
          : objectType === 'deals'
            ? hubspotInternals.mapDeals(dealRows(results, pipelines, owners, companies, contacts))
            : hubspotInternals.mapTickets(
                ticketRows(results, pipelines, owners, companies, contacts)
              );

    return { ...page, rows };
  },
};
