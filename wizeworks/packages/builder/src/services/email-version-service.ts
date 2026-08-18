// emailVersionService — a restorable snapshot of a PUBLISHED email (docs/impl
// transactional-email Slice 5). The email twin of artifact/draft-version-service.
//
// `publishSilica` used to be a one-way overwrite: `silica_published_document` held exactly
// the last publish, so there was no answer to "what did this email look like before I
// published that change", and no way back from a bad publish except re-authoring by hand.
// For a non-technical owner who has just published a mistake to a LIVE transactional email,
// that is the worst possible moment to have no undo.
//
// One append-only row per PUBLISH (`builder_email_versions`), holding the full silica
// `EmailDocument` snapshot, content-addressed by `hash` (reusing artifact-service's
// `hashTree`/`canonicalJson`) so a no-op republish — a draft byte-identical to the last
// published version — does not add a duplicate row.
//
// Simpler than the SITE version machinery: a site publish is atomic across many coupled
// trees (pages + layout + symbols + theme), so it needs a manifest of content-addressed
// artifacts. An email is ONE self-contained document, so the whole document is the unit and
// is hashed directly — no manifest, no shared artifact table.
//
// Restore lives in `emailService.restoreEmailVersion` (it returns a full email DTO, and
// keeping it there avoids an import cycle with this module's capture): it is deliberately
// NON-DESTRUCTIVE and restores to the DRAFT, so the author reviews the reinstated version in
// the studio and re-publishes rather than a version silently going live to inboxes.

import { withTenant, type Prisma, type TxClient } from '@wizeworks/db';
import type { SilicaEmailDocument } from '@wizeworks/builder-schemas';

import type { ServiceContext } from '../errors';
import { hashTree } from './artifact-service';

/**
 * Seal the email's just-published document as a version, inside the caller's transaction
 * (it rides `publishSilica`'s transaction, so a rolled-back publish leaves no orphan
 * version). Returns the new version, or null when the published document is byte-identical
 * to the latest version — a no-op republish, which should not add a duplicate row.
 */
export async function captureEmailVersionTx(
  tx: TxClient,
  ctx: ServiceContext,
  emailId: string,
  doc: SilicaEmailDocument,
  actorId: string | null
): Promise<{ id: string; hash: string } | null> {
  const hash = hashTree(doc);

  const latest = await tx.builderEmailVersion.findFirst({
    where: { emailId },
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  });
  // Nothing changed since the last published version — don't add a duplicate row (an author
  // pressing Publish twice with no edits between).
  if (latest?.hash === hash) return null;

  const row = await tx.builderEmailVersion.create({
    data: {
      tenantId: ctx.tenantId,
      emailId,
      document: doc as unknown as Prisma.InputJsonValue,
      hash,
      subject: doc.subject ?? '',
      actorId: actorId ?? null,
    },
    select: { id: true, hash: true },
  });
  return row;
}

/** One published version as the history list shows it. The document is omitted — the list
 *  only needs the summary; the restore reads the full document by id. */
export interface EmailVersionSummary {
  id: string;
  subject: string;
  /** Better Auth user id of who published it (null for a system path). The UI resolves it
   *  to "You" / a name; unresolved, the timestamp still identifies the version. */
  actorId: string | null;
  createdAt: string;
  /** True for the version matching what is published right now — the newest one. */
  current: boolean;
}

/** An email's publish history, newest first. */
export function listEmailVersions(
  ctx: ServiceContext,
  emailId: string,
  limit = 50
): Promise<EmailVersionSummary[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderEmailVersion.findMany({
      where: { emailId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: { id: true, subject: true, actorId: true, createdAt: true },
    });
    return rows.map((r, i) => ({
      id: r.id,
      subject: r.subject,
      actorId: r.actorId,
      createdAt: r.createdAt.toISOString(),
      current: i === 0,
    }));
  });
}
