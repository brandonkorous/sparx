'use client';

// The feedback controller — mounted once, reachable from anywhere.
//
// It owns the send dialog and nothing else. That split is the point: WRITING is
// a transient chrome action that must leave the workspace exactly as it found it
// (a modal), while READING and REPLYING are places you return to (panes —
// `platform.feedback.list` / `.thread`), opened with plain `controller.open`,
// the same call every other screen in this app uses. No bespoke open-event: a
// workbench already has a universal way to put something in front of someone.
//
// It also captures the TRAIL — the panes recently focused — because "where were
// you when it broke" is usually answered by the two panes before the current
// one, and nobody thinks to mention them.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type {
  FeedbackCategory,
  FeedbackContextPayload,
  FeedbackSource,
} from '../../lib/api/feedback';
import { descriptorKey } from '../../lib/surfaces/descriptor';
import { useWorkbench } from '../../lib/workbench/context';
import { buildFeedbackContext } from './context';
import { FeedbackComposeDialog } from './compose-dialog';

export interface OpenSendOptions {
  source?: FeedbackSource;
  category?: FeedbackCategory;
  /** Carried from the sentiment chip so a rating and its explanation are one record. */
  sentiment?: number;
}

export interface ComposeState {
  open: boolean;
  source: FeedbackSource;
  category: FeedbackCategory;
  sentiment?: number;
}

const CLOSED: ComposeState = { open: false, source: 'button', category: 'idea' };

interface FeedbackControls {
  /** Raise the send dialog. Disturbs no panes — that is why it is a dialog. */
  openSend: (options?: OpenSendOptions) => void;
  /** Open the conversation list as a pane. */
  openList: (options?: { beside?: boolean }) => void;
  /** Open one conversation as a pane. */
  openThread: (id: string, options?: { beside?: boolean }) => void;
}

const FeedbackControlsContext = createContext<FeedbackControls | null>(null);

export function useFeedback(): FeedbackControls {
  const controls = useContext(FeedbackControlsContext);
  if (!controls) throw new Error('useFeedback must be used within <FeedbackProvider>');
  return controls;
}

const MAX_TRAIL = 8;

export function FeedbackProvider({
  theme,
  activeSite = null,
  children,
}: {
  theme: 'light' | 'dark';
  activeSite?: { id: string; name: string } | null;
  children: ReactNode;
}) {
  const { controller } = useWorkbench();
  const [compose, setCompose] = useState<ComposeState>(CLOSED);

  // The focused pane, live — the same store the toolbar's star reads.
  const activeDescriptor = useSyncExternalStore(
    controller.subscribe,
    () => controller.getActiveDescriptor(),
    () => null
  );

  // A ref, never state: the trail is snapshot fodder for a submission, and
  // re-rendering the shell every time focus moves between panes to maintain it
  // would be a real cost for something nobody ever sees.
  const trailRef = useRef<string[]>([]);
  useEffect(() => {
    if (!activeDescriptor) return;
    const key = descriptorKey(activeDescriptor);
    const trail = trailRef.current;
    if (trail[trail.length - 1] === key) return;
    trail.push(key);
    if (trail.length > MAX_TRAIL) trail.shift();
  }, [activeDescriptor]);

  const buildContext = useCallback(
    (): FeedbackContextPayload =>
      buildFeedbackContext({
        descriptor: activeDescriptor,
        theme,
        activeSite,
        trail: trailRef.current,
      }),
    [activeDescriptor, theme, activeSite]
  );

  const controls = useMemo<FeedbackControls>(
    () => ({
      openSend: (options) => {
        setCompose({
          open: true,
          source: options?.source ?? 'button',
          category: options?.category ?? 'idea',
          sentiment: options?.sentiment,
        });
      },
      openList: (options) => {
        controller.open(
          'platform.feedback.list',
          undefined,
          options?.beside ? { target: 'beside' } : undefined
        );
      },
      openThread: (id, options) => {
        controller.open(
          'platform.feedback.thread',
          { id },
          options?.beside ? { target: 'beside' } : undefined
        );
      },
    }),
    [controller]
  );

  return (
    <FeedbackControlsContext.Provider value={controls}>
      {children}
      <FeedbackComposeDialog
        state={compose}
        buildContext={buildContext}
        onClose={() => {
          setCompose(CLOSED);
        }}
      />
    </FeedbackControlsContext.Provider>
  );
}
