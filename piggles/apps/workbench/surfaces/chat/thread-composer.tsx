'use client';

// The reply box at the foot of a conversation. Moved out of thread.tsx (sparx
// persona issue 234) unchanged.

import { useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { faMessage, faPaperPlane } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { CANVAS_CORNER_CLEARANCE } from '../../components/canvas-corner';
import { afterPaneChange } from '../../lib/defer';
import { useDirtySource } from '../../lib/workbench/dirty';
import { chatErrorMessage, useQuickReplies, useSendMessage } from './data';
import { emitTyping } from './live';

function useComposer(id: string) {
  const toast = useToast();
  const send = useSendMessage(id);
  const [body, setBody] = useState('');

  // The typed-but-unsent reply is real work: closing or tearing off the pane
  // with it in the box should ask first.
  useDirtySource(
    body.trim() !== '' && !send.isPending,
    "You've typed a reply but haven't sent it. Close anyway?"
  );

  const submit = () => {
    const text = body.trim();
    if (text === '' || send.isPending) return;
    send.mutate(text, {
      onSuccess: () => {
        setBody('');
      },
      // Deferred out of the mutation's commit: the same write invalidates the
      // thread this pane is showing, and a toast in that flush trips React.
      onError: (error) => {
        afterPaneChange(() => {
          toast.add({
            title: 'Could not send your reply',
            description: chatErrorMessage(error, 'Nothing was sent. Try again in a moment.'),
            type: 'error',
          });
        });
      },
    });
  };
  const insert = (text: string) => {
    setBody((current) => (current.trim() === '' ? text : `${current.trimEnd()}\n\n${text}`));
  };
  return { body, setBody, submit, insert, sending: send.isPending };
}

function QuickRepliesMenu({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  const replies = useQuickReplies().data ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button size="sm" variant="ghost" color="neutral" disabled={disabled}>
          <Icon glyph={faMessage} className="size-4" aria-hidden />
          Quick replies
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {replies.length === 0 ? (
          <DropdownMenuItem disabled>
            No saved replies yet. Add them in Chat settings
          </DropdownMenuItem>
        ) : (
          replies.map((reply) => (
            <DropdownMenuItem
              key={reply.id}
              onClick={() => {
                onPick(reply.body);
              }}
            >
              <span className="font-medium">{reply.title}</span>
              {reply.shortcut ? (
                <span className="ml-auto font-mono text-xs">/{reply.shortcut}</span>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Send ends this row, at the pane's foot: the corner the workspace tools float
 *  in. It was under them (sparx persona issue 166). */
function ComposerFoot(props: {
  disabled: boolean;
  sending: boolean;
  empty: boolean;
  onPick: (text: string) => void;
}) {
  const { disabled, sending, empty, onPick } = props;
  return (
    <div className={`mt-2 flex items-center gap-2 ${CANVAS_CORNER_CLEARANCE}`}>
      <QuickRepliesMenu disabled={disabled} onPick={onPick} />
      <Text as="span" className="hidden text-xs @md:inline">
        Enter to send · Shift+Enter for a new line
      </Text>
      <Button
        type="submit"
        color="module"
        size="sm"
        className="ml-auto"
        loading={sending}
        disabled={disabled || empty}
      >
        <Icon glyph={faPaperPlane} className="size-4" aria-hidden />
        Send
      </Button>
    </div>
  );
}

export function Composer({ id, disabled }: { id: string; disabled: boolean }) {
  const { body, setBody, submit, insert, sending } = useComposer(id);
  return (
    <form
      className="border-base-300 bg-base-100 shrink-0 rounded-lg border p-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Textarea
        value={body}
        rows={3}
        maxLength={8000}
        aria-label="Write a reply"
        placeholder={disabled ? 'This conversation is marked spam' : 'Write a reply…'}
        disabled={disabled}
        onChange={(event) => {
          setBody(event.target.value);
          // Let the visitor's widget show "Agent is typing", throttled in live.ts.
          if (event.target.value.trim() !== '') emitTyping(id);
        }}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter is a new line: the chat convention.
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <ComposerFoot
        disabled={disabled}
        sending={sending}
        empty={body.trim() === ''}
        onPick={insert}
      />
    </form>
  );
}
