// Draft version-history MCP tools (docs/126 §4.6) — the agent's undo.
//
// Every save (human or agent) seals a restorable draft version. These let an assistant
// list that history and roll back — so "undo what you just did" is answerable over MCP,
// not only from the studio drawer. Restore is non-destructive (it seals a new version and
// keeps pages added since) and relays a reload signal to any operator with the site open.

import { z } from 'zod';

import * as draftVersionService from '../services/draft-version-service';
import { toPropertyContext, withSite } from './context';
import { withRelay } from './relay';
import type { McpToolDefinition } from './registry';

const propertyIdArg = z
  .string()
  .uuid()
  .optional()
  .describe(
    'Target site (web property) id. Omit to target the tenant’s PRIMARY site. Call list_sites ' +
      'first to get each site’s id.'
  );

export const listDraftVersions: McpToolDefinition = {
  name: 'list_draft_versions',
  description:
    'List the site’s DRAFT save history, newest first — every save (yours and the owner’s) is a ' +
    'restorable version. Use it to find a point to roll back to before calling restore_draft_version. ' +
    'Each entry has an `id`, when it was saved, who saved it (`source`: save = the owner, agent = you, ' +
    'restore = a prior rollback), and how many pages it held. Draft-only; publish history is separate.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { propertyId } = input as { propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    const versions = await draftVersionService.listDraftVersions(pctx, 50);
    return withSite(pctx, { versions });
  },
};

export const restoreDraftVersion: McpToolDefinition = {
  name: 'restore_draft_version',
  description:
    'Roll the site’s DRAFT back to an earlier version (from list_draft_versions). NON-DESTRUCTIVE: it ' +
    'brings back that version’s page content, keeps any pages added since, and seals itself as a new ' +
    'version so it can be undone in turn. Saves to DRAFT — the live site is unchanged until publish. ' +
    'Confirmation-gated.',
  scope: 'write:builder',
  confirmation: true,
  input: z.object({ versionId: z.string().uuid(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { versionId, propertyId } = input as { versionId: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    const result = await draftVersionService.restoreDraftVersion(pctx, versionId);
    // A restore is a bulk draft rewrite with no faithful per-node op, so an operator with the
    // studio open is prompted to reload rather than have it force-applied over their edits.
    return withRelay(withSite(pctx, result), {
      propertyId: pctx.site.id,
      relay: null,
      reloadHints: ['*'],
    });
  },
};

export const silicaVersionTools = [listDraftVersions, restoreDraftVersion];
