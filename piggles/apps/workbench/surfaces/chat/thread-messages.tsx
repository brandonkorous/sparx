'use client';

// The messages in a conversation. Moved out of thread.tsx (sparx persona issue
// 234), which also gave the list a floor: the card above used to squeeze it to
// one line.

import type { RefObject } from 'react';
import { Badge, ChatTypingIndicator, Text } from '@wizeworks/silicaui-react';
import { faSparkles } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import {
  conversationName,
  formatMessageTime,
  senderLabel,
  type ChatMessage,
  type ConversationDetail,
} from './data';

function MessageBubble({
  message,
  customerName,
  viewerId,
}: {
  message: ChatMessage;
  customerName: string | null;
  /** Who is reading, so their own reply says "You" rather than "Your team". */
  viewerId: string | null;
}) {
  const fromCustomer = message.senderType === 'customer';
  const isAi = message.senderType === 'ai' || message.aiGenerated;

  return (
    <li className={`flex flex-col ${fromCustomer ? 'items-start' : 'items-end'}`}>
      <div
        className={`flex max-w-[85%] flex-col gap-1 rounded-lg border px-3 py-2 ${
          fromCustomer ? 'border-base-300 bg-module bg-soft' : 'border-base-300 bg-base-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <Text as="span" className="text-sm font-semibold">
            {senderLabel(message, customerName, viewerId)}
          </Text>
          {isAi ? (
            <Badge color="info" variant="soft" size="sm">
              <Icon glyph={faSparkles} className="size-3" aria-hidden />
              AI
            </Badge>
          ) : null}
          <Text as="span" className="text-xs whitespace-nowrap">
            {formatMessageTime(message.createdAt)}
          </Text>
        </div>
        <p className="text-base whitespace-pre-wrap">{message.body}</p>
      </div>
    </li>
  );
}

export function ThreadMessages(props: {
  scrollRef: RefObject<HTMLOListElement | null>;
  conversation: ConversationDetail;
  viewerId: string | null;
  otherTyping: boolean;
}) {
  const { scrollRef, conversation, viewerId, otherTyping } = props;
  // The conversation is what the pane is for: it keeps a floor (sparx persona
  // issue 234).
  return (
    <ol ref={scrollRef} className="min-h-48 flex-1 space-y-3 overflow-y-auto p-1">
      {conversation.messages.length === 0 ? (
        <li>
          <Text className="text-sm">
            No messages yet. Send the first one below to start the conversation.
          </Text>
        </li>
      ) : (
        conversation.messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            customerName={conversation.customerName}
            viewerId={viewerId}
          />
        ))
      )}
      {otherTyping ? (
        <li>
          <ChatTypingIndicator side="start" name={`${conversationName(conversation)} is typing`} />
        </li>
      ) : null}
    </ol>
  );
}
