// Telling the business something went wrong (docs/social-audit GAP 2).
//
// The module used to fail silently. A post scheduled for 6am Sunday would fail, the row
// would go red in a list nobody had open, and the first anyone knew was days later when
// they wondered why engagement had dropped. An automated poster that cannot say "this
// didn't go out" is not automation — it is a thing you have to check.
//
// Two notices, and only two, because a notification you get for something routine stops
// being read:
//   · a post did not reach an account it was meant to reach
//   · an account stopped working and needs reconnecting
//
// Both publish `email.send` rather than sending directly, per the house rule — email-worker
// renders and delivers. Both are best-effort: a notification failure must NEVER fail the
// drain that triggered it, so everything here swallows its own errors after logging. The
// post already published (or didn't); making the worker 500 over an email would replay the
// whole drain for no reason.

import { withTenant } from '@sparx/db';
import { createPublisher, publishEvent } from '@sparx/events';
import { appLink, appOrigin } from '@sparx/links/server';
import { getSocialDescriptor, type SocialPlatform } from '@sparx/social';
import type { Logger } from 'pino';

/** The tenant's own contact address — who hears about this — and which product
 *  they hear about it on. A worker has no request and therefore no hostname, so
 *  the brand can only come from the row; it rides the read that was happening
 *  anyway. */
async function tenantEmail(
  tenantId: string
): Promise<{ email: string; name: string; brand: string } | null> {
  const tenant = await withTenant({ tenantId }, (tx) =>
    tx.tenant.findUnique({
      where: { id: tenantId },
      select: { email: true, name: true, platformBrand: true },
    })
  );
  if (!tenant?.email) return null;
  return { email: tenant.email, name: tenant.name, brand: tenant.platformBrand };
}

// These two were DEAD. They emitted `/?surface=social.composer&id=<id>` — a query
// parameter the workbench has never read; it reads `?open=`, and now an address.
// So every "your post didn't go out" and "reconnect your account" email landed on
// a bare workbench with no post in sight, which is the worst possible moment for
// a link to do nothing. Built from the address table now, like everything else.
function composerUrl(postId: string, brand: string): string {
  return appLink('social.composer', { id: postId }, { brand }) ?? appOrigin(brand);
}

function connectionsUrl(brand: string): string {
  return appLink('social.connections', undefined, { brand }) ?? appOrigin(brand);
}

/** A post's opening words — enough to recognize it in a subject line. */
function excerptOf(body: string): string {
  const line = body.trim().split('\n')[0] ?? '';
  return line.length > 120 ? `${line.slice(0, 119)}…` : line || 'Untitled post';
}

/**
 * "Your post didn't go out" — or "only some accounts got it".
 *
 * Called after a drain settles on `failed` or `partially_published`. The partial case is
 * the one that most needs saying: it reads as a success everywhere else in the UI until
 * someone opens the post and looks at the per-destination rows.
 */
export async function notifyPostFailure(
  tenantId: string,
  postId: string,
  logger: Logger
): Promise<void> {
  try {
    const [recipient, post] = await Promise.all([
      tenantEmail(tenantId),
      withTenant({ tenantId }, (tx) =>
        tx.socialPost.findUnique({
          where: { id: postId },
          select: {
            body: true,
            scheduledAt: true,
            targets: { select: { targetName: true, status: true, error: true } },
          },
        })
      ),
    ]);
    if (!recipient || !post) return;

    const failed = post.targets
      .filter((t) => t.status === 'failed')
      .map((t) => ({ name: t.targetName, ...(t.error ? { reason: t.error } : {}) }));
    // Nothing actually failed (a re-drain fixed it between the status flip and here) —
    // then there is nothing to say, and saying it anyway would be noise.
    if (failed.length === 0) return;

    const succeeded = post.targets.filter((t) => t.status === 'published').map((t) => t.targetName);

    const publisher = createPublisher({ logger });
    await publishEvent(
      publisher,
      'email.send',
      tenantId,
      null,
      {
        template: 'social-post-failed',
        to: recipient.email,
        props: {
          excerpt: excerptOf(post.body),
          failed,
          succeeded,
          postUrl: composerUrl(postId, recipient.brand),
          ...(post.scheduledAt
            ? {
                scheduledFor: new Intl.DateTimeFormat('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(post.scheduledAt),
              }
            : {}),
        },
      },
      logger
    );
  } catch (err) {
    // Best-effort by design — see this file's header.
    logger.error({ err, postId }, 'could not send the post-failure notification');
  }
}

/**
 * "Reconnect this account."
 *
 * Sent once, when a grant flips to `expired`. The count of posts already queued against
 * the dead account rides along, because "3 posts are waiting on this" is what turns a
 * notice into something someone acts on today rather than next week.
 */
export async function notifyConnectionExpired(
  tenantId: string,
  connectionId: string,
  logger: Logger
): Promise<void> {
  try {
    const [recipient, connection] = await Promise.all([
      tenantEmail(tenantId),
      withTenant({ tenantId }, (tx) =>
        tx.socialConnection.findUnique({
          where: { id: connectionId },
          select: { platform: true, displayName: true, targets: { select: { id: true } } },
        })
      ),
    ]);
    if (!recipient || !connection) return;

    const targetIds = connection.targets.map((t) => t.id);
    const scheduledCount =
      targetIds.length === 0
        ? 0
        : await withTenant({ tenantId }, (tx) =>
            tx.socialPostTarget.count({
              where: {
                socialTargetId: { in: targetIds },
                status: 'pending',
                post: { status: { in: ['scheduled', 'pending_approval'] } },
              },
            })
          );

    const descriptor = getSocialDescriptor(connection.platform as SocialPlatform);
    const publisher = createPublisher({ logger });
    await publishEvent(
      publisher,
      'email.send',
      tenantId,
      null,
      {
        template: 'social-connection-expired',
        to: recipient.email,
        props: {
          platformName: descriptor?.name ?? connection.platform.replace(/_/g, ' '),
          ...(connection.displayName ? { accountName: connection.displayName } : {}),
          scheduledCount,
          reconnectUrl: connectionsUrl(recipient.brand),
        },
      },
      logger
    );
  } catch (err) {
    logger.error({ err, connectionId }, 'could not send the reconnect notification');
  }
}
