// Live Chat service barrel — namespaced so routes read like the CRM ones
// (`conversationService.list(...)`, `quickReplyService.create(...)`).

export * as conversationService from './conversation-service.js';
export * as analyticsService from './analytics-service.js';
export * as quickReplyService from './quick-reply-service.js';
export { getCustomerContext } from './customer-context.js';
export type { CustomerContextDto, RecentOrderDto } from './customer-context.js';
export { getChatConfig, updateChatConfig, isWithinOperatingHours } from './config.js';
export * from './types.js';
