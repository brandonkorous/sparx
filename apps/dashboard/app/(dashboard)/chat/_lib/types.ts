// Live Chat dashboard — client/server DTO mirror (docs/56, docs/69 A-5).
// Matches the api-rest chat DTOs (services/api-rest/src/lib/chat).

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'spam';
export type SenderType = 'customer' | 'staff' | 'ai';

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderId: string | null;
  body: string;
  attachments: unknown;
  aiGenerated: boolean;
  aiConfidence: number | null;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationSummaryDto {
  id: string;
  status: ConversationStatus;
  source: string;
  subject: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  assignedToId: string | null;
  unreadStaff: number;
  lastMessageAt: string | null;
  lastMessageSnippet: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetailDto extends ConversationSummaryDto {
  messages: ChatMessageDto[];
}

export interface CustomerContextDto {
  linked: boolean;
  customerId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  type: string | null;
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt: string | null;
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    placedAt: string;
  }[];
}

export interface QuickReplyDto {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  createdAt: string;
  updatedAt: string;
}
