// Salesforce.
//
// Salesforce exports are report exports: the tenant picks an object, picks a view, and
// gets that view's columns — so the header set varies enormously between two exports
// of the same object. What does NOT vary is the object's core field labels, which is
// what detection and mapping key on.
//
// Leads and Contacts both become customers here, tagged with which they were. That is
// a deliberate simplification of Salesforce's model rather than an oversight: a lead
// is a person you have not qualified yet, and our CRM expresses that as lifecycle on
// one record instead of two tables that have to be converted between.

import type { CanonicalRow } from '../canonical';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { pick, row } from './_helpers';

function person(source: SourceRow, kind: 'contact' | 'lead'): CanonicalRow {
  return row({
    email: pick(source, 'Email', 'Email Address'),
    first_name: pick(source, 'First Name'),
    last_name: pick(source, 'Last Name'),
    phone: pick(source, 'Phone', 'Business Phone', 'Mobile'),
    company: pick(source, 'Account Name', 'Company', 'Company / Account'),
    address1: pick(source, 'Mailing Street', 'Street', 'Address'),
    city: pick(source, 'Mailing City', 'City'),
    province: pick(source, 'Mailing State/Province', 'State/Province', 'State'),
    country: pick(source, 'Mailing Country', 'Country'),
    zip: pick(source, 'Mailing Zip/Postal Code', 'Zip/Postal Code'),
    note: pick(source, 'Description'),
    tags: kind === 'lead' ? `lead, ${pick(source, 'Lead Status')}`.replace(/,\s*$/, '') : 'contact',
    created_at: pick(source, 'Created Date'),
    type: 'person',
  });
}

function mapContacts(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => person(source, 'contact'));
}

function mapLeads(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => person(source, 'lead'));
}

function mapAccounts(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) =>
    row({
      name: pick(source, 'Account Name', 'Name'),
      domain: pick(source, 'Website'),
      phone: pick(source, 'Phone', 'Account Phone'),
      industry: pick(source, 'Industry'),
      employees: pick(source, 'Employees', 'Number of Employees'),
      annual_revenue: pick(source, 'Annual Revenue'),
      address1: pick(source, 'Billing Street'),
      city: pick(source, 'Billing City'),
      province: pick(source, 'Billing State/Province'),
      country: pick(source, 'Billing Country'),
      zip: pick(source, 'Billing Zip/Postal Code'),
      owner_email: pick(source, 'Account Owner'),
      description: pick(source, 'Description'),
      created_at: pick(source, 'Created Date'),
    })
  );
}

function mapOpportunities(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const stage = pick(source, 'Stage', 'Opportunity Stage');
    const normalized = stage.toLowerCase();
    return row({
      name: pick(source, 'Opportunity Name', 'Name'),
      stage,
      pipeline: pick(source, 'Type', 'Record Type'),
      amount: pick(source, 'Amount'),
      close_date: pick(source, 'Close Date'),
      probability: pick(source, 'Probability (%)', 'Probability'),
      status: normalized.includes('closed won')
        ? 'won'
        : normalized.includes('closed lost') || normalized === 'closed lost'
          ? 'lost'
          : 'open',
      owner_email: pick(source, 'Opportunity Owner', 'Owner'),
      company: pick(source, 'Account Name'),
      source: pick(source, 'Lead Source'),
      created_at: pick(source, 'Created Date'),
    });
  });
}

function mapCases(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const priority = pick(source, 'Priority').toLowerCase();
    return row({
      subject: pick(source, 'Subject', 'Case Subject'),
      description: pick(source, 'Description'),
      status: pick(source, 'Status'),
      priority: priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'normal',
      contact_email: pick(source, 'Contact Email', 'Email'),
      company: pick(source, 'Account Name'),
      owner_email: pick(source, 'Case Owner', 'Owner'),
      created_at: pick(source, 'Date/Time Opened', 'Created Date'),
      closed_at: pick(source, 'Date/Time Closed', 'Closed Date'),
    });
  });
}

export const salesforce: VendorAdapter = {
  slug: 'salesforce',
  name: 'Salesforce',
  kind: 'crm',
  sources: [
    {
      id: 'salesforce.accounts',
      entity: 'companies',
      label: 'Accounts',
      file: 'accounts.csv',
      where: 'Accounts → pick a list view → Printable View or Export',
      format: 'csv',
      required: ['Account Name', 'Account Owner'],
      hints: ['Billing Street', 'Annual Revenue', 'Industry'],
      map: mapAccounts,
    },
    {
      id: 'salesforce.contacts',
      entity: 'customers',
      label: 'Contacts',
      file: 'contacts.csv',
      where: 'Contacts → pick a list view → Export',
      format: 'csv',
      required: ['Contact Owner'],
      hints: ['Mailing Street', 'Account Name', 'Title'],
      map: mapContacts,
    },
    {
      id: 'salesforce.leads',
      entity: 'customers',
      label: 'Leads',
      file: 'leads.csv',
      where: 'Leads → pick a list view → Export',
      format: 'csv',
      required: ['Lead Status'],
      hints: ['Lead Source', 'Lead Owner', 'Company'],
      map: mapLeads,
    },
    {
      id: 'salesforce.opportunities',
      entity: 'deals',
      label: 'Opportunities',
      file: 'opportunities.csv',
      where: 'Opportunities → pick a list view → Export',
      format: 'csv',
      required: ['Opportunity Name', 'Close Date'],
      hints: ['Stage', 'Probability (%)', 'Opportunity Owner'],
      map: mapOpportunities,
    },
    {
      id: 'salesforce.cases',
      entity: 'tickets',
      label: 'Cases',
      file: 'cases.csv',
      where: 'Cases → pick a list view → Export',
      format: 'csv',
      required: ['Case Number'],
      hints: ['Date/Time Opened', 'Case Owner', 'Case Origin'],
      map: mapCases,
    },
  ],
};

export const salesforceInternals = {
  mapAccounts,
  mapContacts,
  mapLeads,
  mapOpportunities,
  mapCases,
};
