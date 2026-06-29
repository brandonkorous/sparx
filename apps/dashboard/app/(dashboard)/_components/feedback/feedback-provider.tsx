'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@sparx/ui';
import { buildFeedbackContext } from './feedback-context';
import { FeedbackModal } from './feedback-modal';
import { FeedbackPulse } from './feedback-pulse';
import type {
  FeedbackCategory,
  FeedbackContextPayload,
  FeedbackSource,
} from '../../_shell/feedback-types';

// Global feedback controller. Mounted once at the shell so the compose modal,
// the history view, and the pulse are available from anywhere without each
// surface re-implementing them (docs/112 §1 D4/D5). Entry points (header
// button, user menu, ⌘K) call `useFeedback()` to open it; a `sparx:open-feedback`
// window event is also honored so out-of-tree callers can trigger it (mirrors
// the ⌘K palette's `sparx:open-command-palette`).

export interface OpenSendOptions {
  source?: FeedbackSource;
  category?: FeedbackCategory;
  sentiment?: number;
}

interface FeedbackControls {
  openSend: (opts?: OpenSendOptions) => void;
  openHistory: (threadId?: string) => void;
  close: () => void;
  buildContext: () => FeedbackContextPayload;
  activeProperty: { id: string; name: string } | null;
}

const FeedbackContext = React.createContext<FeedbackControls | null>(null);

export function useFeedback(): FeedbackControls {
  const ctx = React.useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within <FeedbackProvider>');
  return ctx;
}

export type FeedbackTab = 'send' | 'history';

export interface FeedbackModalState {
  open: boolean;
  tab: FeedbackTab;
  source: FeedbackSource;
  category: FeedbackCategory;
  sentiment?: number;
  threadId?: string;
}

const CLOSED: FeedbackModalState = {
  open: false,
  tab: 'send',
  source: 'button',
  category: 'idea',
};

const MAX_TRAIL = 8;

export function FeedbackProvider({
  activeProperty = null,
  children,
}: {
  activeProperty?: { id: string; name: string } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const [state, setState] = React.useState<FeedbackModalState>(CLOSED);

  // Track recent generic locations for the context trail. A ref (not state) —
  // it must never trigger a re-render, it's just snapshot fodder.
  const trailRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    if (!pathname) return;
    const trail = trailRef.current;
    if (trail[trail.length - 1] !== pathname) {
      trail.push(pathname);
      if (trail.length > MAX_TRAIL) trail.shift();
    }
  }, [pathname]);

  const buildContext = React.useCallback(
    (): FeedbackContextPayload =>
      buildFeedbackContext({
        pathname: pathname ?? '/',
        theme,
        activeProperty,
        trail: trailRef.current,
      }),
    [pathname, theme, activeProperty]
  );

  const openSend = React.useCallback((opts?: OpenSendOptions) => {
    setState({
      open: true,
      tab: 'send',
      source: opts?.source ?? 'button',
      category: opts?.category ?? 'idea',
      sentiment: opts?.sentiment,
    });
  }, []);

  const openHistory = React.useCallback((threadId?: string) => {
    setState({ ...CLOSED, open: true, tab: 'history', threadId });
  }, []);

  const close = React.useCallback(() => setState((s) => ({ ...s, open: false })), []);

  // Honor the decoupled open event (carries an optional tab/source/sentiment).
  React.useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { tab?: FeedbackTab; source?: FeedbackSource; sentiment?: number }
        | undefined;
      if (detail?.tab === 'history') openHistory();
      else openSend({ source: detail?.source, sentiment: detail?.sentiment });
    }
    window.addEventListener('sparx:open-feedback', handler);
    return () => window.removeEventListener('sparx:open-feedback', handler);
  }, [openSend, openHistory]);

  const value = React.useMemo<FeedbackControls>(
    () => ({ openSend, openHistory, close, buildContext, activeProperty }),
    [openSend, openHistory, close, buildContext, activeProperty]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackModal
        state={state}
        onClose={close}
        onTabChange={(tab) => setState((s) => ({ ...s, tab }))}
        buildContext={buildContext}
      />
      <FeedbackPulse
        currentRoute={pathname ?? '/'}
        onShareMore={(sentiment) => openSend({ source: 'pulse', sentiment })}
      />
    </FeedbackContext.Provider>
  );
}
