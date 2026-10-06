'use client';

import type { namableApprovers } from '../../../components/approver-choice';
import { ACCOUNT_APPROVERS, ANY_APPROVER, approverName } from '../../../components/approver-choice';

// Your team first, then the customer's own approvers, grouped by which side of the
// counter each stands on (sparx persona issue 087). A named person no longer on the
// team stays listed, so opening the screen never changes who an order waits for.
export function ApproverOptions({
  people,
  named,
  accountOption,
}: {
  people: ReturnType<typeof namableApprovers>;
  named?: { userId: string; name: string | null } | null;
  accountOption: string;
}) {
  const gone = named && !people.some((person) => person.userId === named.userId) ? named : null;
  return (
    <>
      <optgroup label="Your team">
        <option value={ANY_APPROVER}>Anyone who can approve</option>
        {people.map((person) => (
          <option key={person.userId} value={`user:${person.userId}`}>
            {approverName(person)}
          </option>
        ))}
        {gone ? (
          <option value={`user:${gone.userId}`}>{gone.name ?? 'The person this rule names'}</option>
        ) : null}
      </optgroup>
      <optgroup label="The customer">
        <option value={ACCOUNT_APPROVERS}>{accountOption}</option>
      </optgroup>
    </>
  );
}
