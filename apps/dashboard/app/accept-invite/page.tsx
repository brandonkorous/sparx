import Link from 'next/link';
import { Badge, Button } from 'silicaui-react';
import { getInvitationDetail, getSession, type InvitationDetail } from '@sparx/auth';
import { AuthScreen } from '../(auth)/_components/auth-screen';
import { roleLabel } from '../(dashboard)/settings/team/_lib/roles';
import { AcceptInviteButton, SwitchAccountButton } from './_components/accept-invite-client';

// Team-invitation acceptance (docs/114 §A.4). The invite email links here with
// `?invitation=<id>`. This page lives OUTSIDE the (dashboard) group so it isn't
// gated by the session/onboarding guards — it must render for logged-out
// recipients too. It resolves the invitation, then branches on auth state:
// signed-out → prompt to sign in/up (returning here); wrong account or
// unverified email → explain; matched + verified → the accept button.

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
  const now = Date.now();
  const isLive = invite?.status === 'pending' && invite.expiresAt.getTime() > now;

  if (!invite || !isLive) {
    return (
      <InviteMessage
        title="This invitation is no longer valid"
        body={
          invite?.status === 'accepted'
            ? 'It looks like this invitation was already accepted. Sign in to reach the workspace.'
            : 'It may have expired or been revoked. Ask whoever invited you to send a fresh invitation.'
        }
        footer={
          <Button variant="outline" render={<Link href="/sign-in" />}>
            Go to sign in
          </Button>
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
          <p className="text-base-content/70 text-sm">
            Use {invite.email} so the invitation matches your account.
          </p>
        </div>
      </InviteFrame>
    );
  }

  // Signed in as a different address than the one invited.
  if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <InviteFrame invite={invite}>
        <div className="flex flex-col gap-3">
          <p className="text-base-content/70 text-sm">
            You&apos;re signed in as <strong>{session.user.email}</strong>, but this invitation was
            sent to <strong>{invite.email}</strong>. Sign in with that address to accept it.
          </p>
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
          <p className="text-base-content/70 text-sm">
            Verify your email address ({invite.email}) before accepting. Check your inbox for the
            verification link, then come back to this page.
          </p>
          <Button variant="outline" className="w-full" render={<Link href="/verify-email" />}>
            Resend verification email
          </Button>
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

// Branded frame with the invite summary; children carry the state-specific CTA.
function InviteFrame({
  invite,
  children,
}: {
  invite: InvitationDetail;
  children: React.ReactNode;
}) {
  return (
    <AuthScreen
      lede={{
        title: `Join ${invite.orgName}.`,
        blurb: 'Accept your invitation to collaborate on sparx.',
      }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">You&apos;re invited</h2>
          <p className="text-base-content/70">
            {invite.inviterName} invited you to join <strong>{invite.orgName}</strong>.
          </p>
        </div>
        <div className="flex flex-row items-center gap-2">
          <p className="text-base-content/70 text-sm">Role</p>
          <Badge color="neutral" variant="soft" size="sm">
            {roleLabel(invite.role)}
          </Badge>
        </div>
        {children}
      </div>
    </AuthScreen>
  );
}

// Standalone message (no invite context — bad/expired link).
function InviteMessage({
  title,
  body,
  footer,
}: {
  title: string;
  body: string;
  footer?: React.ReactNode;
}) {
  return (
    <AuthScreen lede={{ title: 'Invitation', blurb: 'Join a workspace on sparx.' }}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="text-base-content/70">{body}</p>
        </div>
        {footer ?? (
          <Button variant="outline" render={<Link href="/sign-in" />}>
            Go to sign in
          </Button>
        )}
      </div>
    </AuthScreen>
  );
}
