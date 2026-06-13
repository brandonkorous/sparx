// Email-platform service layer — the single source of truth shared by REST,
// MCP, and Server Actions. One service module per surface, each re-exported as
// a namespace so callers write `settingsService.get(ctx)` etc.
//
// Surfaces land per delivery phase (docs/13 build plan):
//   P2 — settingsService, domainService          (done)
//   P3 — suppressionService, webhookService       (done)
//   P6 — broadcastService                          (done)
//   P7 — analyticsService                          (done)
//
// Built-in transactional template customization (the old templateService +
// BUILTIN_TEMPLATES) was removed in docs/93 — every tenant→customer email is now
// Builder-authored (builderEmailService + @sparx/builder's emailService).

export * as settingsService from './settings-service';
export * as domainService from './domain-service';
export * as suppressionService from './suppression-service';
export * as webhookService from './webhook-service';
export * as brandService from './brand-service';
export * as broadcastService from './broadcast-service';
export * as analyticsService from './analytics-service';
export * as builderEmailService from './builder-email-service';
