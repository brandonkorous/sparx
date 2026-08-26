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
// Values the tool COMPUTED — a worked-out margin, generated markup, a built
// link. Never a file somebody picked off their own machine, and never bytes
// derived from one. Every tool page here promises that what you give it stays on
// your own computer, and this is the boundary that keeps that promise true: the
// type is label/value text, and there is deliberately no way to express a file.

import * as React from 'react';

export interface ToolResultLine {
  label: string;
  value: string;
}

export interface ToolResult {
  lines: ToolResultLine[];
  /** A closing caveat or next step, when the tool has one. */
  note?: string;
}

/**
 * The longest a single value may be.
 *
 * This mirrors the cap on `/v1/public/tools/deliver` and the email worker's
 * delivery gate. It is repeated here so a tool that can produce a genuinely long
 * output decides for itself what to do about it — and says so in its note —
 * rather than somebody getting "that did not send" from a rejection they had no
 * way to see coming. Never truncate generated markup to fit: a snippet cut in
 * half looks valid and is not.
 */
export const MAX_LINE_VALUE = 4000;

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

/** What the tool has worked out, or null when it has not worked out anything
 *  yet. Null is a real state the capture card renders differently — it is the
 *  difference between "nothing to send yet" and "we sent you nothing". */
export function useToolResult(): ToolResult | null {
  return React.useContext(ToolResultContext)?.result ?? null;
}

/**
 * Called by a tool to publish its current output.
 *
 * Pass `null` while the fields are still empty so the card says "fill it in
 * first" rather than offering to send an empty email.
 *
 * The lines are serialized for the dependency comparison so a tool can build a
 * fresh array on every render — which every one of them does — without this
 * looping. Outside a provider it is a no-op, so a tool stays renderable on its
 * own in a test or a preview.
 *
 * It re-reports whenever the channel disagrees with it, rather than once per
 * change. A provider that remounts starts at null while the tool, whose inputs
 * never changed, has nothing new to say — and the card would then offer to send
 * nothing with the results sitting beside it. Watching the channel's own value
 * makes that self-correcting.
 */
export function useReportToolResult(result: ToolResult | null): void {
  const channel = React.useContext(ToolResultContext);
  const report = channel?.report;
  const serialized = result ? JSON.stringify(result) : null;
  const live = channel?.result ? JSON.stringify(channel.result) : null;

  React.useEffect(() => {
    if (!report || live === serialized) return;
    report(serialized ? (JSON.parse(serialized) as ToolResult) : null);
  }, [report, serialized, live]);
}
