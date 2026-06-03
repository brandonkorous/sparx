// ChatBubble — a conversation message row (docs/46 §3.6). Compound (Avatar /
// Header / Message / Footer). `placement` puts it on the start or end side; the
// Message is color-bearing (reads `--c-bg`/`--c-fg` when a color is set). SERVER
// component.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey } from './_recipes/variants';

export type ChatPlacement = 'start' | 'end';

export interface ChatBubbleProps {
  /** Side of the row. Defaults to `start`. */
  placement?: ChatPlacement;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface ChatSlotProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface ChatMessageProps extends ChatSlotProps {
  /** Bubble color slot. Omit for the default neutral bubble. */
  color?: ColorKey | (string & {});
}

function ChatBubbleRoot({
  placement = 'start',
  className,
  style,
  id,
  children,
}: ChatBubbleProps): React.ReactElement {
  return (
    <div className={cx('sf-chat', `sf-chat--${placement}`, className)} style={style} id={id}>
      {children}
    </div>
  );
}
ChatBubbleRoot.displayName = 'ChatBubble';

function ChatAvatar({ className, style, children }: ChatSlotProps): React.ReactElement {
  return (
    <div className={cx('sf-chat__avatar', className)} style={style}>
      {children}
    </div>
  );
}
ChatAvatar.displayName = 'ChatAvatar';

function ChatHeader({ className, style, children }: ChatSlotProps): React.ReactElement {
  return (
    <div className={cx('sf-chat__header', className)} style={style}>
      {children}
    </div>
  );
}
ChatHeader.displayName = 'ChatHeader';

function ChatMessage({ color, className, style, children }: ChatMessageProps): React.ReactElement {
  return (
    <div
      className={cx(
        'sf-chat__bubble',
        color && colorClass(color),
        color && 'sf-chat__bubble--colored',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}
ChatMessage.displayName = 'ChatMessage';

function ChatFooter({ className, style, children }: ChatSlotProps): React.ReactElement {
  return (
    <div className={cx('sf-chat__footer', className)} style={style}>
      {children}
    </div>
  );
}
ChatFooter.displayName = 'ChatFooter';

const ChatBubble = Object.assign(ChatBubbleRoot, {
  Avatar: ChatAvatar,
  Header: ChatHeader,
  Message: ChatMessage,
  Footer: ChatFooter,
});

export { ChatBubble, ChatAvatar, ChatHeader, ChatMessage, ChatFooter };
