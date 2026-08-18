// HubSpot.
//
// The CRM most of our CRM tenants are leaving, and the one whose export is closest to
// a real relational model: four files that reference each other by name (`Associated
// Company`, `Associated Contact`), which is enough to rebuild the graph on our side.
//
// HubSpot's export writes header labels, not internal property names, and those labels
// change with the portal's language and with whether the user exported a view or the
// whole object. Every column is therefore read through an alias list — the difference
// between `Email` and `Email Address` has cost more migrations than any parsing bug.
//
// docs/144 tracked our CRM to HubSpot parity, so the target shapes here (companies,
// deals with pipeline + stage, tickets) all exist already.

import type { CanonicalRow } from '../canonical';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { pick, row, tags } from './_helpers';

function mapContacts(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      email: pick(source, 'Email', 'Email Address'),
      first_name: pick(source, 'First Name'),
      last_name: pick(source, 'Last Name'),
      phone: pick(source, 'Phone Number', 'Phone', 'Mobile Phone Number'),
      company: pick(source, 'Company Name', 'Associated Company', 'Company name'),
      address1: pick(source, 'Street Address'),
      city: pick(source, 'City'),
      province: pick(source, 'State/Region', 'State'),
      country: pick(source, 'Country/Region', 'Country'),
      zip: pick(source, 'Postal Code'),
      note: pick(source, 'Notes', 'Message'),
      tags: tags(
        [pick(source, 'Lifecycle Stage'), pick(source, 'Lead Status')]
          .filter((value) => value !== '')
          .join(', ')
      ),
      accepts_marketing:
        pick(source, 'Marketing contact status') === 'Non-marketing contact' ? 'false' : '',
      created_at: pick(source, 'Create Date', 'Created Date'),
      type: 'person',
    })
  );
}

function mapCompanies(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      name: pick(source, 'Company name', 'Company Name', 'Name'),
      domain: pick(source, 'Company Domain Name', 'Website URL', 'Domain'),
      phone: pick(source, 'Phone Number', 'Phone'),
      industry: pick(source, 'Industry'),
      employees: pick(source, 'Number of Employees', 'Employees'),
      annual_revenue: pick(source, 'Annual Revenue'),
      address1: pick(source, 'Street Address'),
      city: pick(source, 'City'),
      province: pick(source, 'State/Region', 'State'),
      country: pick(source, 'Country/Region', 'Country'),
      zip: pick(source, 'Postal Code'),
      owner_email: pick(source, 'Company owner', 'Company Owner'),
      description: pick(source, 'Description', 'About Us'),
      created_at: pick(source, 'Create Date'),
    })
  );
}

function mapDeals(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const stage = pick(source, 'Deal Stage', 'Deal stage');
    const normalized = stage.toLowerCase();
    return row({
      name: pick(source, 'Deal Name', 'Deal name'),
      pipeline: pick(source, 'Pipeline', 'Deal Pipeline'),
      stage,
      amount: pick(source, 'Amount', 'Amount in company currency'),
      currency: pick(source, 'Currency', 'Deal Currency Code'),
      close_date: pick(source, 'Close Date'),
      // HubSpot has no status column: won and lost are stage names, and every portal
      // renames them. Matching on the word is the only portable read, and anything
      // unrecognised stays open rather than being guessed into a loss.
      status: normalized.includes('closed won')
        ? 'won'
        : normalized.includes('closed lost')
          ? 'lost'
          : 'open',
      probability: pick(source, 'Deal probability', 'Probability'),
      owner_email: pick(source, 'Deal owner', 'Deal Owner'),
      company: pick(source, 'Associated Company', 'Associated Companies'),
      contact_email: pick(source, 'Associated Contact', 'Associated Contacts'),
      source: pick(source, 'Original Source', 'Deal Type'),
      created_at: pick(source, 'Create Date'),
    });
  });
}

function mapTickets(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const priority = pick(source, 'Priority', 'Ticket priority').toLowerCase();
    return row({
      subject: pick(source, 'Ticket name', 'Ticket Name', 'Subject'),
      description: pick(source, 'Ticket description', 'Ticket Description', 'Description'),
      status: pick(source, 'Ticket status', 'Ticket Status', 'Status'),
      pipeline: pick(source, 'Pipeline', 'Ticket Pipeline'),
      stage: pick(source, 'Ticket status', 'Ticket Stage'),
      priority:
        priority === 'high'
          ? 'high'
          : priority === 'low'
            ? 'low'
            : priority === 'urgent'
              ? 'urgent'
              : 'normal',
      contact_email: pick(source, 'Associated Contact', 'Contact email'),
      company: pick(source, 'Associated Company'),
      owner_email: pick(source, 'Ticket owner', 'Ticket Owner'),
      created_at: pick(source, 'Create date', 'Create Date'),
      closed_at: pick(source, 'Close date', 'Close Date'),
    });
  });
}

export const hubspot: VendorAdapter = {
  slug: 'hubspot',
  name: 'HubSpot',
  kind: 'crm',
  connector: 'hubspot',
  sources: [
    {
      id: 'hubspot.contacts',
      entity: 'customers',
      label: 'Contacts',
      file: 'hubspot-crm-exports-all-contacts-....csv',
      where: 'Contacts → Actions → Export → All contacts',
      format: 'csv',
      filePattern: /hubspot.*contact/i,
      required: ['Lifecycle Stage'],
      hints: ['Contact owner', 'Lead Status', 'Associated Company', 'Marketing contact status'],
      map: mapContacts,
    },
    {
      id: 'hubspot.companies',
      entity: 'companies',
      label: 'Companies',
      file: 'hubspot-crm-exports-all-companies-....csv',
      where: 'Companies → Actions → Export → All companies',
      format: 'csv',
      filePattern: /hubspot.*compan/i,
      required: ['Company Domain Name'],
      hints: ['Company owner', 'Number of Employees', 'Annual Revenue'],
      map: mapCompanies,
    },
    {
      id: 'hubspot.deals',
      entity: 'deals',
      label: 'Deals',
      file: 'hubspot-crm-exports-all-deals-....csv',
      where: 'Deals → Actions → Export → All deals',
      format: 'csv',
      filePattern: /hubspot.*deal/i,
      required: ['Deal Stage'],
      hints: ['Deal owner', 'Pipeline', 'Close Date', 'Amount'],
      map: mapDeals,
    },
    {
      id: 'hubspot.tickets',
      entity: 'tickets',
      label: 'Tickets',
      file: 'hubspot-crm-exports-all-tickets-....csv',
      where: 'Tickets → Actions → Export → All tickets',
      format: 'csv',
      filePattern: /hubspot.*ticket/i,
      required: ['Ticket name'],
      hints: ['Ticket status', 'Ticket owner', 'Ticket description'],
      map: mapTickets,
    },
  ],
};

export const hubspotInternals = { mapContacts, mapCompanies, mapDeals, mapTickets };
