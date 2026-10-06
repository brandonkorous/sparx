// A tax exemption certificate, said the way the owner would say it.
//
// A leaf module, rendering nothing, so the words can be tested. The section that
// draws them is `tax-exemptions-section.tsx`.
//
// The stored certificate is a reason code ("agricultural"), a place code ("US"
// or "US-UT") and two instants. None of those is something a person running a
// ranch supply or a parts counter should have to read, so each one has a plain
// sentence here, and the standing ("is this covering them today?") is worked
// out by the same rule checkout uses (`exemptionCovers` in
// @wizeworks/commerce's tax-exemption.ts): not yet started, past its end, or in
// force.

import { calendarDateText } from '../../components/calendar-date-words';
import { countryName, regionName } from '../../lib/geo';

/** The reasons the server accepts (`ExemptionReason` in commerce-schemas). */
export type ExemptionReason =
  'resale' | 'manufacturing' | 'agricultural' | 'government' | 'nonprofit' | 'diplomatic' | 'other';

/** What kind of certificate, as the row names it. */
const REASON_LABEL: Record<ExemptionReason, string> = {
  resale: 'Resale',
  manufacturing: 'Manufacturing',
  agricultural: 'Agricultural',
  government: 'Government',
  nonprofit: 'Nonprofit',
  diplomatic: 'Diplomatic',
  other: 'Other',
};

/** The same kinds, with what each one means, for the picker. */
export const REASON_CHOICES: { value: ExemptionReason; label: string }[] = [
  { value: 'resale', label: 'Resale: they sell it on to their own customers' },
  { value: 'agricultural', label: 'Agricultural: used for farming or ranching' },
  { value: 'manufacturing', label: 'Manufacturing: it goes into something they make' },
  { value: 'government', label: 'Government: a government office or agency' },
  { value: 'nonprofit', label: 'Nonprofit: a charity or other nonprofit' },
  { value: 'diplomatic', label: 'Diplomatic: an embassy or a diplomat' },
  { value: 'other', label: 'Some other reason' },
];

/** Countries whose English name is said with "the": "in the United States". */
const SAID_WITH_THE = new Set(['US', 'GB', 'NL', 'PH', 'AE', 'CZ', 'DO', 'BS', 'GM', 'MV', 'SC']);

/** A country as it follows "in": "the United States", "Canada". */
function inCountry(code: string): string {
  return SAID_WITH_THE.has(code) ? `the ${countryName(code)}` : countryName(code);
}

export function reasonLabel(reason: string): string {
  return REASON_LABEL[reason as ExemptionReason] ?? 'Other';
}

/**
 * Where a certificate covers, in words: "Utah", or "Everywhere in the United
 * States" for a country-wide one. A state certificate never covers another
 * state, so the state's name alone is the whole answer.
 */
export function coverageLabel(jurisdiction: string): string {
  const code = jurisdiction.trim().toUpperCase();
  if (code.includes('-')) return regionName(code);
  return `Everywhere in ${inCountry(code)}`;
}

/** The choices for "Where it covers": each country, whole, then its states. */
export function coverageChoices(
  countries: readonly string[],
  regionsOf: (country: string) => { value: string; label: string }[]
): { value: string; label: string }[] {
  const several = countries.length > 1;
  return countries.flatMap((country) => [
    { value: country, label: `Everywhere in ${inCountry(country)}` },
    ...regionsOf(country).map((region) => ({
      value: region.value,
      label: several ? `${region.label}, ${countryName(country)}` : region.label,
    })),
  ]);
}

/** Whether a certificate covers today, by checkout's own rule. */
export type ExemptionStanding =
  { kind: 'in_force' } | { kind: 'starts'; on: string } | { kind: 'expired'; on: string };

export function exemptionStanding(
  certificate: { validFrom: string; validTo: string | null },
  now: Date = new Date()
): ExemptionStanding {
  if (now < new Date(certificate.validFrom)) return { kind: 'starts', on: certificate.validFrom };
  if (certificate.validTo && now > new Date(certificate.validTo)) {
    return { kind: 'expired', on: certificate.validTo };
  }
  return { kind: 'in_force' };
}

/** The badge on a certificate: its color and its words. */
export function standingBadge(standing: ExemptionStanding): {
  tone: 'success' | 'info' | 'warning';
  label: string;
} {
  if (standing.kind === 'starts') {
    return { tone: 'info', label: `Starts ${calendarDateText(standing.on)}` };
  }
  if (standing.kind === 'expired') {
    return { tone: 'warning', label: `Expired ${calendarDateText(standing.on)}` };
  }
  return { tone: 'success', label: 'In force' };
}

/** "From Oct 2, 2026 · No end date", "From Jan 1, 2026 · Until Dec 31, 2027". */
export function validityText(certificate: { validFrom: string; validTo: string | null }): string {
  const from = `From ${calendarDateText(certificate.validFrom)}`;
  const until = certificate.validTo
    ? `Until ${calendarDateText(certificate.validTo)}`
    : 'No end date';
  return `${from} · ${until}`;
}

/** Where a certificate's orders go, for a sentence: "to Utah", "anywhere in the United States". */
function deliveredWhere(jurisdiction: string): string {
  const code = jurisdiction.trim().toUpperCase();
  if (code.includes('-')) return `to ${regionName(code)}`;
  return `anywhere in ${inCountry(code)}`;
}

interface CertificateFacts {
  id: string;
  jurisdiction: string;
  validFrom: string;
  validTo: string | null;
}

/**
 * What removing one certificate changes at checkout, said before it happens.
 *
 * "They will be charged tax again" is only true when nothing else covers the
 * same place, and a certificate that has expired or not started is not covering
 * anything now. Saying the scary sentence over a removal that changes nothing
 * would be a promise the till does not keep.
 *
 * `others` is every other certificate that applies to the same buyer: their own,
 * and for a customer, their wholesale account's.
 */
export function removalConsequence(
  removed: CertificateFacts,
  others: readonly CertificateFacts[],
  who: string,
  now: Date = new Date()
): string {
  if (exemptionStanding(removed, now).kind !== 'in_force') {
    return 'It is not covering anything today, so nothing changes at checkout.';
  }
  const code = removed.jurisdiction.trim().toUpperCase();
  const country = code.split('-')[0] ?? code;
  const live = others.filter(
    (other) => other.id !== removed.id && exemptionStanding(other, now).kind === 'in_force'
  );
  const stillCovered = live.some((other) => {
    const theirs = other.jurisdiction.trim().toUpperCase();
    return theirs === code || theirs === country;
  });
  if (stillCovered) {
    return `Another certificate still covers orders delivered ${deliveredWhere(code)}, so nothing changes at checkout.`;
  }
  // Not "will be charged sales tax": a business that collects none (Gillett,
  // sparx persona issue 075) charges nothing either way. Losing the exemption is
  // what is true everywhere.
  const partly = !code.includes('-') && live.some((other) => other.jurisdiction.includes('-'));
  return partly
    ? `Orders from ${who} delivered ${deliveredWhere(code)} stop being exempt, except where another certificate covers them: they pay sales tax wherever you collect it.`
    : `Orders from ${who} delivered ${deliveredWhere(code)} stop being exempt: they pay sales tax wherever you collect it.`;
}

/**
 * The one line on a customer whose wholesale account holds a certificate, so
 * the owner does not file the same certificate twice. Null when the account
 * holds none.
 *
 * `accountNoun` is the console's word for the account ("wholesale account" in
 * sparx, "wholesale customer" in Piggles). `alsoOwn` is whether the customer
 * has certificates of their own on file too: then the account's are mentioned
 * as well, not offered as a reason to skip adding one.
 */
export function accountCoverLine(
  account: {
    accountName: string;
    exemptions: { jurisdiction: string; validFrom: string; validTo: string | null }[];
  } | null,
  accountNoun: string,
  alsoOwn = false,
  now: Date = new Date()
): string | null {
  if (!account || account.exemptions.length === 0) return null;
  const subject =
    account.accountName.trim() === ''
      ? `The ${accountNoun} they buy for`
      : `${account.accountName.trim()}, the ${accountNoun} they buy for,`;
  const covering = account.exemptions.filter(
    (certificate) => exemptionStanding(certificate, now).kind === 'in_force'
  );
  if (covering.length === 0) {
    return `${subject} has a certificate on file, but it does not cover them today.`;
  }
  const places = [...new Set(covering.map((c) => coverageLabel(c.jurisdiction)))].join(', ');
  const what =
    covering.length === 1 ? 'a certificate that covers them' : 'certificates that cover them';
  return alsoOwn
    ? `${subject} also holds ${what} (${places}).`
    : `${subject} holds ${what} (${places}), so you do not need to add one here as well.`;
}
