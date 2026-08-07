// Merchandising MCP tools — the customer-facing content around products and
// the site's own configuration: product reviews + Q&A moderation and
// responses, and the commerce site's settings + theme. Thin wrappers over the
// service layer (locked decision #7). moderate_review (single) lives in
// ./write-tools.ts; this adds responses, bulk moderation, Q&A, and site config.

import { z } from 'zod';

import {
  ModerateReviewInput,
  RespondToReviewInput,
  SubmitAnswerInput,
  UpdateCommerceSiteSettingsInput,
  UpdateCommerceSiteThemeInput,
} from '@sparx/commerce-schemas';

import { commerceSiteService, reviewService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const uuid = () => z.string().uuid();
const questionStatus = () => z.enum(['published', 'rejected']);

// ─── Reviews ──────────────────────────────────────────────────────────────

const respondToReview: McpToolDefinition = {
  name: 'respond_to_review',
  description: 'Post the merchant’s public response to a product review.',
  scope: 'write:commerce',
  confirmation: true,
  input: RespondToReviewInput,
  run: (ctx, input) => reviewService.respond(ctx, input),
};

const moderateReviews: McpToolDefinition = {
  name: 'moderate_reviews',
  description:
    'Bulk-moderate reviews — set the same moderation status (approved / rejected / pending / flagged) on many reviews at once, with an optional note.',
  scope: 'write:commerce_bulk',
  confirmation: true,
  input: ModerateReviewInput.omit({ reviewId: true }).extend({
    reviewIds: z.array(uuid()).min(1).max(500),
  }),
  run: (ctx, input) =>
    reviewService.moderateMany(ctx, input as Parameters<typeof reviewService.moderateMany>[1]),
};

const deleteReview: McpToolDefinition = {
  name: 'delete_review',
  description: 'Delete a single product review.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ reviewId: uuid() }),
  run: (ctx, input) => reviewService.deleteReview(ctx, (input as { reviewId: string }).reviewId),
};

const deleteReviews: McpToolDefinition = {
  name: 'delete_reviews',
  description: 'Bulk-delete product reviews by id.',
  scope: 'write:commerce_bulk',
  confirmation: true,
  input: z.object({ reviewIds: z.array(uuid()).min(1).max(500) }),
  run: (ctx, input) =>
    reviewService.deleteReviews(ctx, (input as { reviewIds: string[] }).reviewIds),
};

// ─── Product Q&A ──────────────────────────────────────────────────────────

const answerQuestion: McpToolDefinition = {
  name: 'answer_question',
  description: 'Post an answer to a customer’s product question.',
  scope: 'write:commerce',
  confirmation: true,
  input: SubmitAnswerInput,
  run: (ctx, input) => reviewService.submitAnswer(ctx, input),
};

const moderateQuestion: McpToolDefinition = {
  name: 'moderate_question',
  description: 'Publish or reject a single customer product question.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ questionId: uuid(), status: questionStatus() }),
  run: (ctx, input) =>
    reviewService.moderateQuestion(
      ctx,
      input as { questionId: string; status: 'published' | 'rejected' }
    ),
};

const moderateQuestions: McpToolDefinition = {
  name: 'moderate_questions',
  description: 'Bulk publish or reject customer product questions.',
  scope: 'write:commerce_bulk',
  confirmation: true,
  input: z.object({ questionIds: z.array(uuid()).min(1).max(500), status: questionStatus() }),
  run: (ctx, input) =>
    reviewService.moderateQuestionMany(
      ctx,
      input as { questionIds: string[]; status: 'published' | 'rejected' }
    ),
};

// ─── Commerce site settings + theme ───────────────────────────────────────
//
// Both are per-SITE (a tenant can own several). Pass the target site's
// propertyId — get it from list_sites. There is no implicit "primary" here so
// an edit can never silently land on the wrong site.

const updateCommerceSiteSettings: McpToolDefinition = {
  name: 'update_commerce_site_settings',
  description:
    'Update a site’s commerce settings (currency, checkout, catalog display, and related options) for one site. Pass the site’s propertyId (from list_sites) and only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateCommerceSiteSettingsInput.extend({ propertyId: uuid() }),
  run: (ctx, input) => {
    const { propertyId, ...patch } = input as { propertyId: string } & Record<string, unknown>;
    return commerceSiteService.updateSettings(ctx, propertyId, patch);
  },
};

const updateCommerceTheme: McpToolDefinition = {
  name: 'update_commerce_theme',
  description:
    'Update a site’s commerce theme settings for one site. Pass the site’s propertyId (from list_sites) and only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateCommerceSiteThemeInput.extend({ propertyId: uuid() }),
  run: (ctx, input) => {
    const { propertyId, ...patch } = input as { propertyId: string } & Record<string, unknown>;
    return commerceSiteService.updateTheme(ctx, propertyId, patch);
  },
};

export const merchandisingWriteTools: AnyMcpTool[] = [
  respondToReview,
  moderateReviews,
  deleteReview,
  deleteReviews,
  answerQuestion,
  moderateQuestion,
  moderateQuestions,
  updateCommerceSiteSettings,
  updateCommerceTheme,
];
