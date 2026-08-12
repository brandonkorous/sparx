// Klaviyo.
//
// Klaviyo's profile export is the cleanest list export on the roster — explicit,
// separate email and SMS consent columns, and real ISO timestamps. That makes the
// consent mapping exact rather than inferred, which matters more here than anywhere
// else: Klaviyo tenants are usually running real marketing programmes and a wrongly
// imported opt-out is a complaint, not an inconvenience.
//
// `Email Marketing Consent` reads `SUBSCRIBED` / `UNSUBSCRIBED` / `NEVER_SUBSCRIBED`,
// and only the first is imported as permission.

import type { CanonicalRow } from '../canonical';
import { clean } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { pick, row } from './_helpers';

const KLAVIYO_SYSTEM = new Set(
  [
    'Klaviyo ID',
    'Email',
    'Phone Number',
    'First Name',
    'Last Name',
    'Organization',
    'Title',
    'Address 1',
    'Address 2',
    'City',
    'Region',
    'Country',
    'Zip',
    'Latitude',
    'Longitude',
    'Source',
    'IP Address',
    'Email Marketing Consent',
    'Email Marketing Consent Timestamp',
    'SMS Marketing Consent',
    'SMS Marketing Consent Timestamp',
    'Profile Created On',
    'Date Added',
    'Last Active',
    'Historic Customer Lifetime Value',
    'Predicted Customer Lifetime Value',
    'Total Customer Lifetime Value',
  ].map((header) => header.toLowerCase())
);

function mapProfiles(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const emailConsent = pick(source, 'Email Marketing Consent').toUpperCase();
    const smsConsent = pick(source, 'SMS Marketing Consent').toUpperCase();

    const mapped = row({
      email: pick(source, 'Email'),
      first_name: pick(source, 'First Name'),
      last_name: pick(source, 'Last Name'),
      phone: pick(source, 'Phone Number'),
      company: pick(source, 'Organization'),
      address1: pick(source, 'Address 1'),
      address2: pick(source, 'Address 2'),
      city: pick(source, 'City'),
      province: pick(source, 'Region'),
      country: pick(source, 'Country'),
      zip: pick(source, 'Zip'),
      accepts_marketing: emailConsent === 'SUBSCRIBED' ? 'true' : 'false',
      accepts_sms: smsConsent === 'SUBSCRIBED' ? 'true' : 'false',
      total_spent: pick(source, 'Historic Customer Lifetime Value'),
      created_at: pick(source, 'Profile Created On', 'Date Added'),
      type: 'person',
    });

    for (const [header, value] of Object.entries(source)) {
      if (KLAVIYO_SYSTEM.has(header.toLowerCase())) continue;
      const text = clean(value);
      if (text === '') continue;
      mapped[`custom:${header}`] = text;
    }

    return mapped;
  });
}

/** Klaviyo list exports carry the list name in the filename, not a column, so the
 *  segment is built from the profiles themselves. */
function mapSegment(rows: SourceRow[]): CanonicalRow[] {
  const members = rows.map((source) => pick(source, 'Email')).filter((email) => email !== '');
  if (members.length === 0) return [];
  return [row({ name: 'Imported from Klaviyo', members: members.join(', ') })];
}

export const klaviyo: VendorAdapter = {
  slug: 'klaviyo',
  name: 'Klaviyo',
  kind: 'email',
  sources: [
    {
      id: 'klaviyo.profiles',
      entity: 'customers',
      label: 'Profiles',
      file: 'klaviyo-profiles-....csv',
      where: 'Audience → Profiles → Manage Profiles → Export Profiles to CSV',
      format: 'csv',
      filePattern: /klaviyo/i,
      required: ['Klaviyo ID', 'Email Marketing Consent'],
      hints: ['SMS Marketing Consent', 'Historic Customer Lifetime Value', 'Profile Created On'],
      map: mapProfiles,
    },
    {
      id: 'klaviyo.segment',
      entity: 'segments',
      label: 'The list itself',
      file: 'klaviyo-list-....csv',
      where: 'The same profiles export — everyone in it becomes one segment',
      format: 'csv',
      required: ['Klaviyo ID', 'Email'],
      map: mapSegment,
    },
  ],
};

export const klaviyoInternals = { mapProfiles, mapSegment };
