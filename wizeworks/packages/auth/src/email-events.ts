// Auth-side email event publisher. Wraps @wizeworks/events so Better Auth
// callbacks (sendResetPassword, sendVerificationEmail when wired) can
// emit typed `email.send` events with one call.
//
// Logger: we don't have a request-scoped Fastify logger here (Better
// Auth runs inside the dashboard Next.js process, not Fastify), so this
// uses console as a minimal shim. The actual rendering + send happens
// inside email-worker, which has its own pino logger.

import {
  createPublisher,
  publishEvent,
  type EmailSendPayload,
  type PublisherLogger,
} from '@wizeworks/events';

const logger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', ...obj, msg })),
  error: (obj, msg) => console.error(JSON.stringify({ level: 'error', ...obj, msg })),
};

export interface PublishAuthEmailInput {
  tenantId: string;
  actorId: string | null;
  /** Restricted to the templates auth flows actually trigger today. */
  template:
    | 'password-reset'
    | 'welcome-merchant'
    | 'partner-welcome'
    | 'email-verification'
    | 'team-invitation'
    | 'magic-link'
    | 'login-otp'
    // Security notices emitted from better-auth lifecycle hooks.
    | 'password-changed'
    | 'new-device-signin'
    | 'two-factor-changed'
    // The inviter's "someone accepted" notice (workbench accept-invite action).
    | 'invitation-accepted';
  to: string;
  /** Template-specific props — shape enforced at render time by @wizeworks/email. */
  props: Record<string, unknown>;
  from?: string;
  replyTo?: string;
}

/**
 * Templates where the email IS the person's next step — they are looking at a
 * screen that will say "check your email" and they have no other way forward.
 *
 * The rest are notices about something that already happened (a password
 * changed, a new device, an invitation accepted). Those must never fail the
 * action they are reporting on, so they publish and move on regardless.
 */
const AWAITED = new Set<PublishAuthEmailInput['template']>([
  'password-reset',
  'magic-link',
  'email-verification',
  'login-otp',
]);

export async function publishAuthEmail(input: PublishAuthEmailInput): Promise<void> {
  const publisher = createPublisher({
    logger,
  });

  // Do not promise a delivery that provably will not happen.
  //
  // `publishEvent` resolves successfully on every transport, including the
  // logging stub that discards what it is handed — so "Check your email, we
  // have sent a link" was printed identically whether the event was queued or
  // dropped on the floor. On a machine with no `EVENT_BROKER` set, every
  // passwordless route into the product is a dead end that reports success,
  // and the only trace is one startup line in a terminal nobody is reading at
  // the moment they are locked out.
  //
  // Throwing here reaches the screen: the sign-in form already handles the
  // error and says it could not send the link, which is true.
  if (publisher.discards && AWAITED.has(input.template)) {
    throw new Error(
      `Cannot send the ${input.template} email: EVENT_BROKER is unset, so events are discarded ` +
        'rather than delivered. Set EVENT_BROKER=nats (with EVENT_BROKER_URL) for local ' +
        'development — see .env.example.'
    );
  }

  const payload: EmailSendPayload = {
    to: input.to,
    template: input.template,
    props: input.props,
    from: input.from,
    replyTo: input.replyTo,
  };

  await publishEvent(publisher, 'email.send', input.tenantId, input.actorId, payload, logger);
}
