'use client';

// The channel a tool uses to hand its computed output to the page frame
// (docs/152 A3).
//
// WHY A CONTEXT RATHER THAN A PROP
//
// `ToolShell` is one server-rendered frame shared by every tool page, and the
// result lives inside each tool's own client state. Threading it out would mean
// every page component becoming a client component just to hold a value it does
// not use. The provider sits between the frame and the tool instead, so the
// capture card can read what the tool computed while the tool keeps owning it.
//
// WHAT MAY BE REPORTED
//
// Values the tool COMPUTED — a calculated margin, generated markup, a built URL.
// Never a file the visitor supplied and never bytes derived from one. Several
// tool pages promise the visitor's own file never leaves their browser, and this
// is the boundary that keeps that promise true, so the type is label/value text
// and there is deliberately no way to express a file here.

import * as React from 'react';

export interface ToolResultLine {
  label: string;
  value: string;
}

/**
 * The longest a single value may be.
 *
 * This mirrors the cap on `/v1/public/tools/deliver` and the email worker's
 * delivery gate. It is repeated here so a tool that can produce a genuinely long
 * output decides for itself what to do about it — and says so in its note —
 * rather than the visitor getting "something went wrong" from a 400 they had no
 * way to see coming. Never truncate generated markup to fit: a snippet cut in
 * half looks valid and is not.
 */
export const MAX_LINE_VALUE = 4000;

export interface ToolResult {
  lines: ToolResultLine[];
  /** A closing caveat or next step, when the tool has one. */
  note?: string;
}

interface ToolResultChannel {
  result: ToolResult | null;
  report: (result: ToolResult | null) => void;
}

const ToolResultContext = React.createContext<ToolResultChannel | null>(null);

export function ToolResultProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = React.useState<ToolResult | null>(null);
  const value = React.useMemo<ToolResultChannel>(() => ({ result, report: setResult }), [result]);
  return <ToolResultContext.Provider value={value}>{children}</ToolResultContext.Provider>;
}

/** What the tool has computed, or null when it has not computed anything yet.
 *  Null is a real state the capture card renders differently — it is the
 *  difference between "nothing to send yet" and "we sent you nothing". */
export function useToolResult(): ToolResult | null {
  return React.useContext(ToolResultContext)?.result ?? null;
}

/**
 * Called by a tool to publish its current output.
 *
 * Pass `null` while the inputs are incomplete so the card says "fill in the tool
 * first" rather than offering to send an empty email.
 *
 * The lines are serialized for the dependency comparison so a tool can build a
 * fresh array on every render — which every one of them does — without this
 * looping. Outside a provider it is a no-op, so a tool stays renderable on its
 * own in a test or a preview.
 *
 * ── IT RE-REPORTS WHENEVER THE CHANNEL DISAGREES WITH IT ────────────────────
 *
 * The obvious version depends only on the value being reported, which means one
 * report per change and no more. That is one lost update away from a card
 * offering to send nothing while the results sit on the screen beside it — and
 * the update CAN be lost, because the provider owns `useState` and a provider
 * that remounts starts at null while the tool, whose inputs never changed, has
 * nothing new to say. Watching the channel's own value closes that: the tool is
 * already a consumer, so a reset re-renders it, the comparison fails, and it
 * says its piece again. Observed live on 2026-08-25 — a Fast Refresh remount
 * emptied the channel and it never recovered until a keystroke.
 */
export function useReportToolResult(result: ToolResult | null): void {
  const channel = React.useContext(ToolResultContext);
  const report = channel?.report;
  const serialized = result ? JSON.stringify(result) : null;
  // What the channel is holding right now, in the same form, so the comparison
  // is between two values rather than between two object identities.
  const live = channel?.result ? JSON.stringify(channel.result) : null;

  React.useEffect(() => {
    if (!report || live === serialized) return;
    report(serialized ? (JSON.parse(serialized) as ToolResult) : null);
  }, [report, serialized, live]);
}
