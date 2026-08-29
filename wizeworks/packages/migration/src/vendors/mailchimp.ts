// Mailchimp.
//
// An audience export is a mailing list plus a decade of merge fields the tenant added
// themselves, so the shape past the first six columns is entirely theirs. The fixed
// part — `Email Address`, `OPTIN_TIME`, `MEMBER_RATING`, `TAGS` — is what detection
// keys on, and every unrecognised merge field is carried through rather than dropped.
//
// The one thing that must not be lost is consent. `CONFIRM_TIME` being present is the
// record that this person double-opted-in, and a list imported without it is a list
// the tenant cannot legally mail. It lands as a real field, not a note.

import type { CanonicalRow } from '../canonical';
import { clean } from '../coerce';
import type { SourceRow } from '../parse/csv';
import type { VendorAdapter } from '../types';
import { pick, row, tags } from './_helpers';

const MAILCHIMP_SYSTEM = new Set(
  [
    'Email Address',
    'First Name',
    'Last Name',
    'Address',
    'Phone',
    'Birthday',
    'MEMBER_RATING',
    'OPTIN_TIME',
    'OPTIN_IP',
    'CONFIRM_TIME',
    'CONFIRM_IP',
    'LATITUDE',
    'LONGITUDE',
    'GMTOFF',
    'DSTOFF',
    'TIMEZONE',
    'CC',
    'REGION',
    'LAST_CHANGED',
    'LEID',
    'EUID',
    'NOTES',
    'TAGS',
  ].map((header) => header.toLowerCase())
);

function mapMembers(rows: SourceRow[]): CanonicalRow[] {
  return rows.map((source) => {
    const confirmed = pick(source, 'CONFIRM_TIME') !== '';
    const mapped = row({
      email: pick(source, 'Email Address', 'Email'),
      first_name: pick(source, 'First Name', 'FNAME'),
      last_name: pick(source, 'Last Name', 'LNAME'),
      phone: pick(source, 'Phone', 'PHONE'),
      // Mailchimp's Address merge field is one cell: `12 Mill St  Leeds  LS1 1AA  GB`.
      // It is carried whole rather than split on guesswork — a wrong split puts a
      // postcode in the city and the tenant discovers it when a parcel goes missing.
      address1: pick(source, 'Address', 'ADDRESS'),
      province: pick(source, 'REGION'),
      country: pick(source, 'CC'),
      note: pick(source, 'NOTES'),
      tags: tags(pick(source, 'TAGS')),
      // Only a confirmed opt-in is imported as consent. An unconfirmed row lands
      // without marketing permission, which is recoverable; the reverse is not.
      //
      // Said out loud, because `row()` drops empty values and an empty one here read
      // as "this export has no opinion about marketing" rather than "this person
      // never confirmed" — so everybody who signed up and never clicked the link
      // came in as somebody the shop could mail. The two readings need two values.
      accepts_marketing: confirmed ? 'true' : 'false',
      created_at: pick(source, 'OPTIN_TIME', 'CONFIRM_TIME'),
      type: 'person',
    });

    for (const [header, value] of Object.entries(source)) {
      if (MAILCHIMP_SYSTEM.has(header.toLowerCase())) continue;
      const text = clean(value);
      if (text === '') continue;
      mapped[`custom:${header}`] = text;
    }

    return mapped;
  });
}

export const mailchimp: VendorAdapter = {
  slug: 'mailchimp',
  name: 'Mailchimp',
  kind: 'email',
  sources: [
    {
      id: 'mailchimp.members',
      entity: 'customers',
      label: 'Audience',
      file: 'subscribed_members_export_....csv',
      where: 'Audience → All contacts → Export Audience',
      format: 'csv',
      filePattern: /members_export|subscribed_members/i,
      required: ['Email Address', 'OPTIN_TIME'],
      hints: ['MEMBER_RATING', 'CONFIRM_TIME', 'LEID', 'EUID'],
      map: mapMembers,
    },
  ],
};

export const mailchimpInternals = { mapMembers };
