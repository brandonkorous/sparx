// The send and the on-screen count share one recipient rule (piggles persona issue 967).

import { describe, expect, it } from 'vitest';

import { type AudienceMember, sendableRecipients } from './audience-scope';

const member = (
  email: string | null,
  doNotContact = false,
  customerId: string | null = email
): AudienceMember => ({ customerId, customer: { email, doNotContact } });

describe('sendableRecipients', () => {
  it('a group of 40 with one do-not-contact reader reaches 39', () => {
    const members = Array.from({ length: 39 }, (_, i) => member(`reader${i}@example.test`));
    members.push(member('hugh.ashdown@example.test', true));
    expect(sendableRecipients(members, [])).toHaveLength(39);
  });

  it('skips the do-not-email list whatever the capitals', () => {
    const out = sendableRecipients(
      [member('Ada@Example.test'), member('bo@example.test')],
      ['ADA@example.TEST']
    );
    expect(out.map((r) => r.email)).toEqual(['bo@example.test']);
  });

  it('skips a member with no email and sends a repeated address once', () => {
    const out = sendableRecipients(
      [
        member(null),
        member('cy@example.test', false, 'c1'),
        member('CY@example.test', false, 'c2'),
      ],
      []
    );
    expect(out).toEqual([{ email: 'cy@example.test', customerId: 'c1' }]);
  });
});
