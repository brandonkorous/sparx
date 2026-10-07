import type { Metadata } from 'next';
import * as React from 'react';
import Link from 'next/link';
import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { getInvitationDetail, getSession, type InvitationDetail } from '@wizeworks/auth';
import { InviteShell } from './invite-shell';
import { roleDescription, roleLabel } from '../../surfaces/team/roles';
import {
  AcceptInviteButton,
  ResendVerificationButton,
  SwitchAccountButton,
} from './accept-invite-client';

export const metadata: Metadata = { title: 'Accept invitation · sparx Workbench' };
export const dynamic = 'force-dynamic';

// Team-invitation acceptance (docs/114 §A.4). The invite email links here with
// `?invitation=<id>` (built by wizeworks/services/api-rest team routes + the Better Auth
// org-plugin invite email, both on the app.sparx.works origin). It renders for
// logged-out recipients too, so it lives at the app root — never behind the shell
// session gate. It resolves the invitation, then branches on auth state:
// signed-out → sign in/up (returning here); wrong account → switch; matched but
// unverified → verify; matched + verified → the accept button.
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string }>;
}) {
  const { invitation: invitationId } = await searchParams;

  if (!invitationId) {
    return (
      <InviteMessage
        title="Invalid invitation link"
        body="This link is missing its invitation code. Ask whoever invited you to resend it."
      />
    );
  }

  const invite = await getInvitationDetail(invitationId);
  const isLive = invite?.status === 'pending' && invite.expiresAt.getTime() > Date.now();

  if (!invite || !isLive) {
    return (
      <InviteMessage
        title="This invitation is no longer valid"
        body={
          invite?.status === 'accepted'
            ? 'It looks like this invitation was already accepted. Sign in to reach the workspace.'
            : 'It may have expired or been revoked. Ask whoever invited you to send a fresh invitation.'
        }
      />
    );
  }

  const session = await getSession();
  const callbackURL = `/accept-invite?invitation=${encodeURIComponent(invitationId)}`;

  // Signed out → let them authenticate as the invited address and return here.
  if (!session) {
    return (
      <InviteFrame invite={invite}>
        <div className="flex flex-col gap-3">
          <Button
            color="primary"
            className="w-full"
            render={<Link href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`} />}
          >
            Sign in to accept
          </Button>
          <Button
            variant="outline"
            className="w-full"
            render={<Link href={`/sign-up?callbackURL=${encodeURIComponent(callbackURL)}`} />}
          >
            Create an account
          </Button>
          <Text className="text-sm">
            Use {invite.email} so the invitation matches your account.
          </Text>
        </div>
      </InviteFrame>
    );
  }

  // Signed in as a different address than the one invited.
  if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <InviteFrame invite={invite}>
        <div className="flex flex-col gap-3">
          <Text className="text-sm">
            You&rsquo;re signed in as <strong>{session.user.email}</strong>, but this invitation was
            sent to <strong>{invite.email}</strong>. Sign out, then sign in or create an account
            with that address.
          </Text>
          <SwitchAccountButton callbackURL={callbackURL} />
        </div>
      </InviteFrame>
    );
  }

  // Matched address, but email not yet verified — accepting an invite is a
  // sensitive action, so it gates on a verified email (CLAUDE.md).
  if (!session.user.emailVerified) {
    return (
      <InviteFrame invite={invite}>
        <div className="flex flex-col gap-3">
          <Text className="text-sm">
            Verify your email address ({invite.email}) before accepting. Open the link we sent you,
            then you&rsquo;ll return here to accept.
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

// The workbench auth chrome (canvas + pane + wordmark), with the invite summary
// above the state-specific CTA the caller passes as children.
function InviteFrame({
  invite,
  children,
}: {
  invite: InvitationDetail;
  children: React.ReactNode;
}) {
  return (
    <InviteShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">You&rsquo;re invited</h1>
          <Text>
            {invite.inviterName} invited you to join <strong>{invite.orgName}</strong>
            {/* "Gillett Diesel Service Inc." already ends the sentence. */}
            {invite.orgName.trim().endsWith('.') ? '' : '.'}
          </Text>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Text className="text-sm">Role</Text>
            <Badge variant="outline" size="sm">
              {roleLabel(invite.role)}
            </Badge>
          </div>
          {/* What the role can and cannot do, the same sentence the person who
              invited them read when choosing it (issue 120). */}
          <Text className="text-sm">{roleDescription(invite.role)}</Text>
        </div>
        {children}
      </div>
    </InviteShell>
  );
}

// Standalone message (no invite context — bad/expired link).
function InviteMessage({ title, body }: { title: string; body: string }) {
  return (
    <InviteShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <Text>{body}</Text>
        </div>
        <Button variant="outline" className="w-full" render={<Link href="/sign-in" />}>
          Go to sign in
        </Button>
      </div>
    </InviteShell>
  );
}
