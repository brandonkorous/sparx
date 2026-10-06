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
//
// IT SAYS ONLY WHAT IT KNOWS. The one fact here is whether the owner has said
// they reviewed the page. It used to claim the page was "still the starter
// wording", and kept claiming it after an owner pasted his own policy over every
// word of it (sparx persona issue 033). So it names the review, not the words,
// and offers the review right here: the owner who just wrote his own policy
// should not have to go to another screen to say so.

import Link from 'next/link';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  useToast,
} from '@wizeworks/silicaui-react';
import { useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { contentKeys } from './data';
import { legalKindTitle, useAcknowledgeLegalPage } from './legal-data';

interface Props {
  entryId: string;
  legalKind: string;
  /** Whether the owner has already said they have read it. */
  reviewed: boolean;
  published: boolean;
}

export function PolicyPageNotice({ entryId, legalKind, reviewed, published }: Props) {
  const acknowledge = useAcknowledgeLegalPage();
  const queryClient = useQueryClient();
  const toast = useToast();
  if (reviewed) return null;
  const title = legalKindTitle(legalKind);

  const markReviewed = () => {
    acknowledge.mutate(entryId, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: contentKeys.detail(entryId) });
        toast.add({ title: `${title} marked reviewed`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not mark it reviewed',
          description: apiErrorMessage(error, 'Nothing was changed. Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>
          {published
            ? `Your ${title} is live and not marked reviewed yet`
            : `Your ${title} is not marked reviewed yet`}
        </AlertTitle>
        <AlertDescription>
          It began as the Piggles starter wording, which is a starting point, not legal advice. Read
          it through and make it fit your business and where you trade, then mark it reviewed.{' '}
          <Link href="/content/legal" className="link">
            Legal pages
          </Link>{' '}
          is where you check it is linked in your footer.
        </AlertDescription>
      </AlertContent>
      <Button
        size="sm"
        color="warning"
        variant="soft"
        loading={acknowledge.isPending}
        onClick={markReviewed}
      >
        Mark reviewed
      </Button>
    </Alert>
  );
}
