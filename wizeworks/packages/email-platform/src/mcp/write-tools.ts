// Write email MCP tools. send_broadcast is confirmation-gated (it sends real
// mail).

import { z } from 'zod';

import * as broadcastService from '../services/broadcast-service';
import type { McpToolDefinition } from './registry';

export const sendBroadcast: McpToolDefinition = {
  name: 'send_broadcast',
  description:
    'Create and immediately send a broadcast to a CRM segment using a PUBLISHED designed email (built in the Email Builder). Sends real email — always confirm the segment + recipient count first. Tenant-level dynamic data (products, promotions) renders; per-recipient personalization resolves at dispatch.',
  scope: 'write:email_bulk',
  confirmation: true,
  input: z.object({
    name: z.string().min(1).max(160),
    subject: z.string().min(1).max(255),
    builderEmailId: z.string().uuid(),
    segmentId: z.string().uuid(),
    preheader: z.string().max(255).optional(),
  }),
  run: async (ctx, input) => {
    const args = input as {
      name: string;
      subject: string;
      builderEmailId: string;
      segmentId: string;
      preheader?: string;
    };
    const broadcast = await broadcastService.create(ctx, args);
    return broadcastService.sendNow(ctx, broadcast.id);
  },
};

export const writeTools: McpToolDefinition[] = [sendBroadcast];
