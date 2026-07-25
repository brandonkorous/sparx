// Email management MCP tools — broadcasts (create/edit/schedule/cancel), sending
// domains, suppression list, and email settings. Thin wrappers over the
// email-platform service layer (one service, many transports). Immediate send
// (send_broadcast) lives in ./write-tools.ts.
//
// Deliberately NOT here (file / provisioning): CSV suppression import,
// Mailgun webhook ingest, test-send is a builder-preview concern.

import { z } from 'zod';

import {
  AddSuppressionInput,
  CreateBroadcastInput,
  CreateSendingDomainInput,
  ScheduleBroadcastInput,
  UpdateBroadcastInput,
  UpdateEmailSettingsInput,
} from '../schemas';
import { broadcastService, domainService, settingsService, suppressionService } from '../services';

import type { McpToolDefinition } from './registry';

const uuid = () => z.string().uuid();
type Rec = Record<string, unknown>;

// ─── Broadcasts ────────────────────────────────────────────────────────────

const createBroadcast: McpToolDefinition = {
  name: 'create_broadcast',
  description:
    'Create a broadcast (a one-off marketing email to a CRM segment) as a DRAFT, using a published Email-Builder design. Does not send — schedule_broadcast or send_broadcast dispatches it.',
  scope: 'write:email',
  confirmation: true,
  input: CreateBroadcastInput,
  run: (ctx, input) => broadcastService.create(ctx, input),
};

const updateBroadcast: McpToolDefinition = {
  name: 'update_broadcast',
  description:
    'Edit a draft broadcast — name, subject, preheader, design, or target segment. Send only the fields to change.',
  scope: 'write:email',
  confirmation: true,
  input: UpdateBroadcastInput.extend({ broadcastId: uuid() }),
  run: (ctx, input) => {
    const { broadcastId, ...patch } = input as { broadcastId: string } & Rec;
    return broadcastService.update(ctx, broadcastId, patch);
  },
};

const scheduleBroadcast: McpToolDefinition = {
  name: 'schedule_broadcast',
  description:
    'Schedule a draft broadcast to send at a future time (ISO-8601). Sends real email at that time to the whole segment — confirm the segment + timing first.',
  scope: 'write:email_bulk',
  confirmation: true,
  input: ScheduleBroadcastInput.extend({ broadcastId: uuid() }),
  run: (ctx, input) => {
    const { broadcastId, ...body } = input as { broadcastId: string } & Rec;
    return broadcastService.schedule(ctx, broadcastId, body);
  },
};

const cancelBroadcast: McpToolDefinition = {
  name: 'cancel_broadcast',
  description: 'Cancel a scheduled broadcast before it sends.',
  scope: 'write:email',
  confirmation: true,
  input: z.object({ broadcastId: uuid() }),
  run: (ctx, input) => broadcastService.cancel(ctx, (input as { broadcastId: string }).broadcastId),
};

// ─── Sending domains ──────────────────────────────────────────────────────

const createEmailDomain: McpToolDefinition = {
  name: 'create_email_domain',
  description:
    'Add a sending domain to send email from your own domain. Returns the DNS records to add; verify it with verify_email_domain once they propagate.',
  scope: 'write:email',
  confirmation: true,
  input: CreateSendingDomainInput,
  run: (ctx, input) => domainService.create(ctx, input),
};

const verifyEmailDomain: McpToolDefinition = {
  name: 'verify_email_domain',
  description: 'Check a sending domain’s DNS records and mark it verified if they are in place.',
  scope: 'write:email',
  confirmation: true,
  input: z.object({ domainId: uuid() }),
  run: (ctx, input) => domainService.verify(ctx, (input as { domainId: string }).domainId),
};

const setDefaultEmailDomain: McpToolDefinition = {
  name: 'set_default_email_domain',
  description:
    'Make a verified sending domain the default for a site. Pass the site’s propertyId (from list_sites) and the domain id.',
  scope: 'write:email',
  confirmation: true,
  input: z.object({ propertyId: uuid(), domainId: uuid() }),
  run: (ctx, input) => {
    const { propertyId, domainId } = input as { propertyId: string; domainId: string };
    return domainService.setDefault(ctx, propertyId, domainId);
  },
};

const deleteEmailDomain: McpToolDefinition = {
  name: 'delete_email_domain',
  description: 'Remove a sending domain.',
  scope: 'write:email',
  confirmation: true,
  input: z.object({ domainId: uuid() }),
  run: (ctx, input) => domainService.remove(ctx, (input as { domainId: string }).domainId),
};

// ─── Suppressions ─────────────────────────────────────────────────────────

const addSuppression: McpToolDefinition = {
  name: 'add_email_suppression',
  description:
    'Add an email address to the suppression list so it is never emailed (a manual unsubscribe / bounce / complaint entry).',
  scope: 'write:email',
  confirmation: true,
  input: AddSuppressionInput,
  run: (ctx, input) => suppressionService.add(ctx, input),
};

const deleteSuppression: McpToolDefinition = {
  name: 'delete_email_suppression',
  description: 'Remove an address from the suppression list so it can be emailed again.',
  scope: 'write:email',
  confirmation: true,
  input: z.object({ suppressionId: uuid() }),
  run: (ctx, input) =>
    suppressionService.remove(ctx, (input as { suppressionId: string }).suppressionId),
};

// ─── Settings ─────────────────────────────────────────────────────────────

const updateEmailSettings: McpToolDefinition = {
  name: 'update_email_settings',
  description:
    'Update a site’s email settings (from name/address, reply-to, physical address, default sending domain). Pass the site’s propertyId (from list_sites) and only the fields to change.',
  scope: 'write:email',
  confirmation: true,
  input: UpdateEmailSettingsInput.extend({ propertyId: uuid() }),
  run: (ctx, input) => {
    const { propertyId, ...patch } = input as { propertyId: string } & Rec;
    return settingsService.update(ctx, propertyId, patch);
  },
};

export const managementWriteTools: McpToolDefinition[] = [
  createBroadcast,
  updateBroadcast,
  scheduleBroadcast,
  cancelBroadcast,
  createEmailDomain,
  verifyEmailDomain,
  setDefaultEmailDomain,
  deleteEmailDomain,
  addSuppression,
  deleteSuppression,
  updateEmailSettings,
];
