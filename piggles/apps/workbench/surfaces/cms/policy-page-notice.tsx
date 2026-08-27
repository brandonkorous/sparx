'use client';

// Said in the console, because it must never be said on the page.
//
// This is a policy page, and Publish here puts it in front of customers. The
// warning used to live INSIDE the body — "This is starter wording, not legal
// advice … take your own advice on it before you publish this page" — which
// meant one click sent it to shoppers in the shop's own voice (issue 267).
//
// The Legal pages surface already tells an owner who goes there. This is for the
// owner who does not: the generic content list lists policy pages beside blog
// posts, and from here Publish had nothing to say about what it was publishing.

import Link from 'next/link';
import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';
import { legalKindTitle } from './legal-data';

interface Props {
  legalKind: string;
  /** Whether the owner has already said they have read it. */
  reviewed: boolean;
  published: boolean;
}

export function PolicyPageNotice({ legalKind, reviewed, published }: Props) {
  if (reviewed) return null;
  const title = legalKindTitle(legalKind);
  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>
          {published
            ? `Your ${title} is live and still the starter wording`
            : `This is your ${title}, and it is still the starter wording`}
        </AlertTitle>
        <AlertDescription>
          It is a starting point, not legal advice. Read it through and make it fit your business
          and where you trade before {published ? 'you leave it up' : 'you publish it'} —{' '}
          <Link href="/content/legal" className="link">
            Legal pages
          </Link>{' '}
          is where you say you have, and where you check it is linked in your footer.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
