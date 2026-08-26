// "Would creating this contact be refused, and what would I tell them?"
//
// One question, asked by two callers that must never disagree: the CSV import's
// practice run, which promises to show exactly what a real import would do, and
// the import itself, which has to explain a rejected row to the person whose
// spreadsheet it came from.
//
// It lives beside the schema rather than in the importer because the importer is
// in another package. A copy of the rules over there would drift, and drift here
// means the practice run quietly going back to lying: its first outing reported
// 25 rows and no problems, and the import that followed refused ten of them.

import { ZodError } from 'zod';
import { CreateCustomerInput } from '@wizeworks/crm-schemas';

/** What each field is called on the screen someone mapped their columns on. */
const FIELD_LABEL: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  firstName: 'First name',
  lastName: 'Last name',
  company: 'Company',
  companyName: 'Company',
  jobTitle: 'Job title',
  tags: 'Tags',
  type: 'Type',
  doNotContact: 'Email opt-in',
  address1: 'Address line 1',
  city: 'City',
  province: 'State / region',
  zip: 'Postcode',
  country: 'Country',
};

/**
 * A validation failure as a sentence, not as a dump.
 *
 * `ZodError.message` is a JSON array — `"origin": "string"`, `"pattern":
 * "/^[a-zA-Z0-9_-]+$/"` — and it went straight into the import's run report,
 * where a shop owner reads it under "Worth knowing". It has to name the column
 * she recognises and say the thing in words.
 */
export function describeCustomerProblems(error: ZodError): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const issue of error.issues) {
    const field = issue.path[0];
    const label = typeof field === 'string' ? (FIELD_LABEL[field] ?? field) : 'This row';
    const line = `${label}: ${issue.message}`;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines.length > 0 ? lines.join(' ') : 'This row could not be read.';
}

/**
 * Why `customerService.create` would refuse this input, or null if it would not.
 *
 * Parses with the SAME schema the write path parses with, so a preview built on
 * this cannot report a clean row that the import then rejects.
 */
export function checkCustomerInput(candidate: unknown): string | null {
  const parsed = CreateCustomerInput.safeParse(candidate);
  return parsed.success ? null : describeCustomerProblems(parsed.error);
}

/** The same, for an error caught from a write that already happened. */
export function describeCustomerError(err: unknown): string {
  if (err instanceof ZodError) return describeCustomerProblems(err);
  return err instanceof Error ? err.message : String(err);
}
