import type { Metadata } from 'next';
import * as React from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Text } from '@wizeworks/silicaui-react';
import { PRODUCT } from '@piggles/config';
import { getInvitationDetail, getSession, type InvitationDetail } from '@sparx/auth';
import { AuthShell } from '@/components/auth-shell';
import {
  AcceptInviteButton,
  ResendVerificationButton,
  SwitchAccountButton,
} from './accept-invite-client';

export const metadata: Metadata = { title: `You've been invited · ${PRODUCT.name}` };
export const dynamic = 'force-dynamic';

// "Someone has invited you to help run their business."
//
// The invitation email links here with `?invitation=<id>`, built by api-rest's
// team routes and by the Better Auth org plugin — both against this app's
// origin, because an invitee is not signed in yet and this is the only Piggles
// app with a sign-in page.
//
// It renders for logged-OUT visitors, so it must never sit behind a session
// gate. It resolves the invitation first, then branches on who is holding the
// browser: signed out → sign in or sign up and come back · signed in as somebody
// else → switch · right person, unverified email → verify · right person,
// verified → join.

/** The role, said the way somebody hiring a bookkeeper would say it. The
 *  platform's role KEYS are not up for reinterpretation; how they read is. */
const ROLE_WORDS: Record<string, string> = {
  owner: 'Owner — full run of the business',
  admin: 'Manager — everything except billing',
  editor: 'Editor — can add and change things',
  builder: 'Website — the site and its pages',
  marketing: 'Marketing — messages and campaigns',
  support: 'Support — customers and conversations',
  partner: 'Partners — suppliers and orders',
  scanner: 'Stockroom — scanning and stock counts',
  viewer: 'Viewer — can look, cannot change',
};

const roleWords = (role: string): string => ROLE_WORDS[role] ?? role;

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string }>;
}) {
  const { invitation: invitationId } = await searchParams;

  if (!invitationId) {
    return (
      <InviteMessage
        heading="That link is incomplete"
        body="It is missing the part that says which invitation it is. Ask whoever invited you to send it again."
      />
    );
  }

  const invite = await getInvitationDetail(invitationId);
  const isLive = invite?.status === 'pending' && invite.expiresAt.getTime() > Date.now();

  if (!invite || !isLive) {
    return (
      <InviteMessage
        heading={
          invite?.status === 'accepted' ? 'You have already joined' : 'That invitation has expired'
        }
        body={
          invite?.status === 'accepted'
            ? 'This invitation was accepted already. Sign in and you will find the business waiting.'
            : 'Invitations last a week, and this one is past it — or it was withdrawn. Ask whoever invited you for a fresh one.'
        }
      />
    );
  }

  const session = await getSession();
  const callbackURL = `/accept-invite?invitation=${encodeURIComponent(invitationId)}`;

  // Signed out — authenticate as the invited address and come back.
  if (!session) {
    return (
      <InviteFrame invite={invite}>
        <div className="flex flex-col gap-3">
          <Button
            color="primary"
            className="w-full"
            render={<Link href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`} />}
          >
            Sign in to join
          </Button>
          <Button
            variant="outline"
            className="w-full"
            render={<Link href={`/signup?callbackURL=${encodeURIComponent(callbackURL)}`} />}
          >
            I&rsquo;m new — create an account
          </Button>
          {/* The one instruction that prevents the most common dead end: joining
              with a different address silently creates a second account and the
              invitation stays unaccepted. */}
          <Text className="text-sm">
            Use <strong>{invite.email}</strong> — the invitation is tied to that address.
          </Text>
        </div>
      </InviteFrame>
    );
  }

  // Signed in as somebody other than the invited address.
  if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <InviteFrame invite={invite}>
        <div className="flex flex-col gap-3">
          <Text className="text-sm">
            You are signed in as <strong>{session.user.email}</strong>, and this invitation went to{' '}
            <strong>{invite.email}</strong>. Sign in with that address to accept it.
          </Text>
          <SwitchAccountButton callbackURL={callbackURL} />
        </div>
      </InviteFrame>
    );
  }

  // Right address, email not confirmed. Joining a business is a sensitive
  // action, so it waits on a verified address.
  if (!session.user.emailVerified) {
    return (
      <InviteFrame invite={invite}>
        <div className="flex flex-col gap-3">
          <Text className="text-sm">
            First, confirm <strong>{invite.email}</strong> is yours. Open the link we emailed you
            and you will come straight back here.
          </Text>
          <ResendVerificationButton email={invite.email} invitationId={invite.id} />
        </div>
      </InviteFrame>
    );
  }

  return (
    <InviteFrame invite={invite}>
      <AcceptInviteButton invitationId={invite.id} orgName={invite.orgName} />
    </InviteFrame>
  );
}

/** The invitation summary, above whichever action this visitor needs. */
function InviteFrame({
  invite,
  children,
}: {
  invite: InvitationDetail;
  children: React.ReactNode;
}) {
  return (
    <AuthShell
      heading="You&rsquo;ve been invited"
      lede={`${invite.inviterName} would like you to help run ${invite.orgName}.`}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Text className="text-sm">You would join as</Text>
          {/* `primary`, not neutral: this badge is the single most consequential
              fact on the screen — it says what this person will be able to see
              and change — and a grey chip says none of that. */}
          <Badge color="primary" variant="soft">
            {roleWords(invite.role)}
          </Badge>
        </div>
        {children}
      </div>
    </AuthShell>
  );
}

/** No invitation to show — a broken, spent or expired link. */
function InviteMessage({ heading, body }: { heading: string; body: string }) {
  return (
    <AuthShell heading={heading}>
      <div className="flex flex-col gap-6">
        <Alert color="warning" variant="soft" role="status">
          {body}
        </Alert>
        <Button variant="outline" className="w-full" render={<Link href="/sign-in" />}>
          Go to sign in
        </Button>
      </div>
    </AuthShell>
  );
}
