// Pipedrive.
//
// Pipedrive prefixes every header with the object it came from — `Person - Name`,
// `Deal - Title`, `Organization - Address` — which is unusually helpful: the prefix
// alone identifies the file, so detection is exact rather than probabilistic.
//
// Deal status is a real column here (`open` / `won` / `lost`), which makes Pipedrive
// the one CRM on the roster whose pipeline history imports without inference.

import type { CanonicalRow } from '../canonical';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { pick, row, tags } from './_helpers';

function mapPersons(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const name = pick(source, 'Person - Name', 'Name');
    const [first = '', ...rest] = name.split(' ');
    return row({
      email: pick(source, 'Person - Email', 'Person - Email - Work', 'Email'),
      name,
      first_name: pick(source, 'Person - First name') || first,
      last_name: pick(source, 'Person - Last name') || rest.join(' '),
      phone: pick(source, 'Person - Phone', 'Person - Phone - Work', 'Phone'),
      company: pick(source, 'Person - Organization', 'Organization'),
      tags: tags(pick(source, 'Person - Label', 'Person - Labels')),
      created_at: pick(source, 'Person - Person created', 'Person - Created'),
      type: 'person',
    });
  });
}

function mapOrganizations(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      name: pick(source, 'Organization - Name', 'Name'),
      address1: pick(source, 'Organization - Address'),
      city: pick(source, 'Organization - Address - City', 'Organization - City'),
      province: pick(source, 'Organization - Address - State', 'Organization - State'),
      country: pick(source, 'Organization - Address - Country', 'Organization - Country'),
      zip: pick(source, 'Organization - Address - Postal code'),
      owner_email: pick(source, 'Organization - Owner', 'Organization - Owner email'),
      created_at: pick(source, 'Organization - Organization created'),
    })
  );
}

function mapDeals(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const status = pick(source, 'Deal - Status', 'Status').toLowerCase();
    return row({
      name: pick(source, 'Deal - Title', 'Title'),
      pipeline: pick(source, 'Deal - Pipeline', 'Pipeline'),
      stage: pick(source, 'Deal - Stage', 'Stage'),
      amount: pick(source, 'Deal - Value', 'Value'),
      currency: pick(source, 'Deal - Currency of Value', 'Deal - Currency'),
      close_date: pick(source, 'Deal - Expected close date', 'Deal - Won time', 'Deal - Lost time'),
      status: status === 'won' ? 'won' : status === 'lost' ? 'lost' : 'open',
      probability: pick(source, 'Deal - Probability'),
      owner_email: pick(source, 'Deal - Owner', 'Deal - Owner email'),
      company: pick(source, 'Deal - Organization', 'Organization'),
      contact_email: pick(source, 'Deal - Contact person email', 'Deal - Contact person'),
      source: pick(source, 'Deal - Source', 'Deal - Source channel'),
      created_at: pick(source, 'Deal - Deal created', 'Deal - Created'),
    });
  });
}

export const pipedrive: VendorAdapter = {
  slug: 'pipedrive',
  name: 'Pipedrive',
  kind: 'crm',
  sources: [
    {
      id: 'pipedrive.persons',
      entity: 'customers',
      label: 'People',
      file: 'persons.csv',
      where: 'Contacts → People → ⋯ → Export data',
      format: 'csv',
      required: ['Person - Name'],
      hints: ['Person - Organization', 'Person - Label', 'Person - Owner'],
      map: mapPersons,
    },
    {
      id: 'pipedrive.organizations',
      entity: 'companies',
      label: 'Organisations',
      file: 'organizations.csv',
      where: 'Contacts → Organizations → ⋯ → Export data',
      format: 'csv',
      required: ['Organization - Name'],
      hints: ['Organization - Address', 'Organization - Owner'],
      map: mapOrganizations,
    },
    {
      id: 'pipedrive.deals',
      entity: 'deals',
      label: 'Deals',
      file: 'deals.csv',
      where: 'Deals → ⋯ → Export data',
      format: 'csv',
      required: ['Deal - Title'],
      hints: ['Deal - Stage', 'Deal - Value', 'Deal - Status', 'Deal - Pipeline'],
      map: mapDeals,
    },
  ],
};

export const pipedriveInternals = { mapPersons, mapOrganizations, mapDeals };
