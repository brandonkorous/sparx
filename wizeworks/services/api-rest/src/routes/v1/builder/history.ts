// Builder — ONE document's own history (piggles/docs/features/builder Phase 8.2).
//
//   GET  /v1/builder/history/:ownerKind/:ownerId
//                                     → that document's draft history and its
//                                       published history, newest first. Derived from
//                                       the site-wide snapshots' manifests, so it
//                                       needs no table of its own and cannot disagree
//                                       with them
//   POST /v1/builder/history/:ownerKind/:ownerId/restore
//                                     → put that ONE document's DRAFT back to an
//                                       earlier version. Nothing visitors see changes,
//                                       and the restore is itself sealed as a version
//
// There is deliberately NO per-document published rollback here. The published parts
// are coupled (see `artifact-service`): putting one page back to last week while the
// saved pieces stay at today can leave it standing on a master that release never
// had. Whole-site rollback is `POST /v1/builder/site/releases/:id/restore`.

import type { FastifyPluginAsync } from 'fastify';
import { documentHistoryService, type DocumentOwnerKind } from '@wizeworks/builder';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireBuilderModule, toBuilderContext } from '../../../lib/builder-context.js';

const OWNER_KINDS = new Set<DocumentOwnerKind>(['page', 'layout', 'theme', 'symbol']);

/** The path's owner, or a 400 — an unknown kind would otherwise read every version's
 *  manifest looking for something that can never be in one and report "no history". */
function ownerOf(params: { ownerKind: string; ownerId: string }) {
  const kind = params.ownerKind as DocumentOwnerKind;
  if (!OWNER_KINDS.has(kind)) {
    throw Object.assign(new Error(`Unknown document kind: ${params.ownerKind}`), {
      statusCode: 400,
    });
  }
  return { kind, id: params.ownerId };
}

const historyRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/history/:ownerKind/:ownerId', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const owner = ownerOf(request.params as { ownerKind: string; ownerId: string });
    const { limit } = request.query as { limit?: string };
    const history = await documentHistoryService.listDocumentHistory(
      await toBuilderContext(request),
      owner,
      limit ? Number(limit) : undefined
    );
    return ok(history);
  });

  app.post('/v1/builder/history/:ownerKind/:ownerId/restore', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const owner = ownerOf(request.params as { ownerKind: string; ownerId: string });
    const { versionId } = request.body as { versionId: string };
    const result = await documentHistoryService.restoreDocumentDraft(
      await toBuilderContext(request),
      owner,
      versionId
    );
    return ok(result);
  });

  return Promise.resolve();
};

export default historyRoutes;
