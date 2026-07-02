import Link from 'next/link';
import { Badge, Button, Heading, Stack, Text } from '@sparx/ui';
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
          <Button variant="outline" asChild>
            <Link href="/sign-in">Go to sign in</Link>
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
        <Stack gap={3}>
          <Button asChild className="w-full">
            <Link href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`}>
              Sign in to accept
            </Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href={`/sign-up?callbackURL=${encodeURIComponent(callbackURL)}`}>
              Create an account
            </Link>
          </Button>
          <Text size="sm" variant="muted">
            Use {invite.email} so the invitation matches your account.
          </Text>
        </Stack>
      </InviteFrame>
    );
  }

  // Signed in as a different address than the one invited.
  if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <InviteFrame invite={invite}>
        <Stack gap={3}>
          <Text size="sm" variant="muted">
            You&apos;re signed in as <strong>{session.user.email}</strong>, but this invitation was
            sent to <strong>{invite.email}</strong>. Sign in with that address to accept it.
          </Text>
          <SwitchAccountButton callbackURL={callbackURL} />
        </Stack>
      </InviteFrame>
    );
  }

  // Matched address, but email not yet verified — accepting an invite is a
  // sensitive action, so it gates on a verified email (CLAUDE.md).
  if (!session.user.emailVerified) {
    return (
      <InviteFrame invite={invite}>
        <Stack gap={3}>
          <Text size="sm" variant="muted">
            Verify your email address ({invite.email}) before accepting. Check your inbox for the
            verification link, then come back to this page.
          </Text>
          <Button variant="outline" asChild className="w-full">
            <Link href="/verify-email">Resend verification email</Link>
          </Button>
        </Stack>
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
      <Stack gap={6}>
        <Stack gap={2}>
          <Heading level={2}>You&apos;re invited</Heading>
          <Text variant="muted">
            {invite.inviterName} invited you to join <strong>{invite.orgName}</strong>.
          </Text>
        </Stack>
        <Stack direction="row" align="center" gap={2}>
          <Text size="sm" variant="muted">
            Role
          </Text>
          <Badge color="neutral" variant="soft" size="sm">
            {roleLabel(invite.role)}
          </Badge>
        </Stack>
        {children}
      </Stack>
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
      <Stack gap={6}>
        <Stack gap={2}>
          <Heading level={2}>{title}</Heading>
          <Text variant="muted">{body}</Text>
        </Stack>
        {footer ?? (
          <Button variant="outline" asChild>
            <Link href="/sign-in">Go to sign in</Link>
          </Button>
        )}
      </Stack>
    </AuthScreen>
  );
}
