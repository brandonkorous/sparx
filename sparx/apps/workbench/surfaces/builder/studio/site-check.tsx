'use client';

// The pre-publish check — what a visitor will run into, before they run into it.
//
// ADVISORY, AND THE CODE HAS TO KEEP IT THAT WAY. Nothing here can stop a publish and
// nothing here should try. The site belongs to the person who built it: they may be
// publishing a link to a page that goes live in an hour, or an image whose description
// is someone else's job this afternoon. The panel says what happens; the decision is
// theirs. The only moment it interrupts is a publish with ERRORS outstanding — a
// question whose primary answer is "Publish anyway", asked once, never repeated.
//
// ── WHY THIS IS A POPOVER AND A ONE-LINE LIST (rebuilt 2026-07-30) ──────────────────
//
// It was a right-hand DRAWER whose every finding carried a four-line paragraph. Brandon,
// looking at thirty of them: "it feels like a wall of text that will never get a user to
// engage" — and separately, the platform rule: a drawer breaks the workbench's MDI flow.
// Both are right, and they are different problems:
//
//   1. THE CONTAINER. A drawer is a place you GO, and it covers the very thing the
//      findings are about. It is now a popover anchored to the Check button: no scrim,
//      nothing hidden, dismissed by looking away. `PopoverContent` reads
//      `usePortalContainer`, so inside `PaneScope` it stays in this pane — and in a
//      torn-off window it opens on the right monitor.
//
//   2. THE PROSE. The explanations are not wrong — they are written for someone who does
//      not know what a `gap` is, which is the audience. They were never DESIGNED for
//      thirty at once. An explanatory paragraph is right for the ONE finding a person
//      already cares about and is a wall when it is the list format. So the list is one
//      line per finding — what it is, where it is — and the paragraph sits behind a
//      disclosure on the row that earns it. Nothing was deleted; it stopped being the
//      first thing you meet.
//
// THE WHOLE THING LIVES IN THE STATUS BAR NOW, and the count IS the trigger.
//
// It was split across two floors for a version: `CheckCount` in silica's `statusBarSlot`
// so "3 broken" was ambient — the only version of this a busy person actually reads — and
// the button that opened the list up in the toolbar, because §14 documented that slot as
// carrying nothing interactive. Defensible, and still wrong in the way that matters:
// Brandon's instinct on seeing the number was to click it, and the thing that answered
// was somewhere else entirely.
//
// silicaui 0.45 answered docs/silicaui/01 §18 with `StatusItem` rather than by softening the
// sentence, which is the better shape: an item with an `onClick` becomes a ghost `btn-xs`
// sized so the 28px strip never changes height, and carries `aria-expanded` /
// `aria-controls`. The rule it preserves is that a status item may DISCLOSE its own
// detail but never ACT — so Run is still inside the panel, beside the list it refreshes,
// and there is no Check button in the toolbar at all.
//
// The item reads the counts while the report is still true and the plain word "Check"
// otherwise, so there is ONE target whether or not a check has ever been run.
//
// IT NO LONGER RUNS ON OPEN. Opening cost a save plus a full walk of every page's
// composed document, to re-read a list the author had just read. There is a Run button
// instead; the studio marks the report stale on the next edit and the status bar drops
// the count rather than showing one that has stopped being true.
//
// CLICK-TO-NODE IS THE POINT. A list of problems nobody can find is a list nobody
// reads. THE ROW ITSELF is the button now — "Show me" was a second target for the thing
// clicking a row obviously does — and it opens the tree the finding lives in (the page,
// the header and footer, or the saved piece) and selects it.
//
// AND "OPENS THE TREE IT LIVES IN" MEANS `setActiveTree`, NOT JUST A PAGE SWITCH.
// silica's selection is TREE-SCOPED — an id in one tree means nothing in the other — so
// handing `select` a header node while the editor is on a page body selects nothing at
// all: no canvas ring, no Navigator row, no Inspector. This file used to reason that "the
// frame is part of every page's canvas, so a frame node needs no navigation at all",
// which is true of what you SEE and false of what you can select — and the header/footer
// is where a young site's findings mostly are (an unfinished nav link, a logo with no
// description), so the button did nothing on the most common finding there is.
//
// `goTo` points the spine at the tree the finding names, in BOTH directions: a page
// finding clicked while the author is in Layout needs the same correction as a frame
// finding clicked from a page. silicaui 0.41 syncs its own mode toggle off `activeTree`
// (docs/silicaui/01 §15), so the whole editor — canvas, rail, Navigator, chip — follows.
// VERIFIED in a browser on 2026-07-30: a header finding switches the mode chip to Layout,
// swaps the Navigator to the frame tree, selects the block, and retitles the pane.
//
// AND THE OUTCOME IS CHECKED, because it can still legitimately fail. `select` returns
// whether it LANDED as of 0.41 (also §15): a stale id — the block was deleted between the
// check running and this click, by the author or by a co-editor — is refused rather than
// stored. That boolean is the only way to tell "gone" apart from "wrong tree", so the
// toast below is raised on a real answer instead of on a `catch` that never fired.
//
// PAGE WEIGHT IS NOT A FINDING, and it is now COLLAPSED. Above: something is wrong.
// Below: what each page weighs — nothing is wrong, here is what a visitor downloads.
// Mixing them would rank a deliberate trade as a defect; leaving it expanded made it most
// of the panel's length, for a section an author opens once.

import { useCallback, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useToast,
} from '@wizeworks/silicaui-react';
import { StatusItem, useEditor } from '@wizeworks/silicaui-builder/react';
import type { Node } from '@wizeworks/silicaui-html';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Gauge,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { PaneScope } from '../../../lib/dock/window-boundary';
import {
  builderErrorMessage,
  type CheckBudget,
  type CheckFinding,
  type CheckSeverity,
  type CheckWeightBand,
  type SiteCheckReport,
} from './data';

/* ── How each severity reads ────────────────────────────────────────────────── */

interface SeverityMeta {
  /** Plural heading for the group. */
  heading: string;
  color: 'error' | 'warning' | 'info';
  icon: typeof CircleAlert;
  /** One line saying what this group MEANS, so the ranking is not just color. ONE per
   *  GROUP — three sentences in the whole panel, never one per finding. */
  meaning: string;
  /** The dot on every row in this group. A background utility on an 8px span: a signal,
   *  not a control, so it is not the re-skinning RULE #1 bans. */
  dot: string;
}

const SEVERITY: Record<CheckSeverity, SeverityMeta> = {
  error: {
    heading: 'Broken for visitors',
    color: 'error',
    icon: CircleAlert,
    meaning: 'Someone visiting your site right now would hit this and it would not work.',
    dot: 'bg-error',
  },
  warning: {
    heading: 'Worth fixing',
    color: 'warning',
    icon: TriangleAlert,
    meaning: 'The page still works, but it is harder to use, harder to read, or harder to find.',
    dot: 'bg-warning',
  },
  suggestion: {
    heading: 'Suggestions',
    color: 'info',
    icon: Lightbulb,
    meaning: 'Nothing is wrong. These are the things that make a good site a bit better.',
    dot: 'bg-info',
  },
};

const ORDER: CheckSeverity[] = ['error', 'warning', 'suggestion'];

/* ── How weight reads ───────────────────────────────────────────────────────── */

/**
 * WEIGHT IS NOT A SEVERITY, and the wording has to keep saying so. A photographer's
 * portfolio is meant to be full of large pictures; a page being heavy is a trade its
 * owner may have made deliberately. So every label below describes what a VISITOR
 * experiences — how long they wait — and never whether the page is right or wrong.
 */
const BAND: Record<CheckWeightBand, { label: string; color: 'success' | 'warning' | 'error' }> = {
  light: { label: 'Opens fast', color: 'success' },
  heavy: { label: 'Slower on a phone', color: 'warning' },
  'very-heavy': { label: 'Slow on a phone', color: 'error' },
};

/** Bytes as a person reads them. Whole numbers below a megabyte — nobody needs
 *  "0.24 MB" — and one decimal above it, where the difference is worth seeing. */
function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${String(bytes)} bytes`;
  if (bytes < 1_000_000) return `${String(Math.round(bytes / 1000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** The node with this id in a tree, or null. Local rather than the engine's `walk`
 *  because the shape is three lines and a traversal helper's contract is one more thing
 *  to keep in step across a version bump.
 *
 *  An Outlet is excluded from the RETURN TYPE, not just skipped: it carries no `class`,
 *  so a caller reaching for one should not have to re-narrow what this already knows. */
function findById(node: Node, id: string): Exclude<Node, { kind: 'outlet' }> | null {
  if (node.kind === 'outlet') return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    if (typeof child === 'string') continue;
    const hit = findById(child, id);
    if (hit) return hit;
  }
  return null;
}

/** Where a finding says the fix happens, as a phrase that goes after "in". */
function placeOf(finding: CheckFinding): string {
  const { scope, ownerName, seenOn } = finding.location;
  if (scope === 'frame') {
    return seenOn.length > 1
      ? `your header & footer — on all ${String(seenOn.length)} pages`
      : 'your header & footer';
  }
  if (scope === 'symbol') {
    return seenOn.length > 1
      ? `the saved piece “${ownerName}” — used on ${String(seenOn.length)} pages`
      : `the saved piece “${ownerName}”`;
  }
  if (scope === 'site') return ownerName;
  return ownerName;
}

/* ── What the status item says ──────────────────────────────────────────────── */

/**
 * The label on the strip: the counts while the report is still true, and the plain word
 * otherwise.
 *
 * SUGGESTIONS ARE NOT COUNTED. They are things that would make a good site better, and a
 * permanent "+14" against them reads as a debt an author can never clear — which is how a
 * count stops being information and starts being noise you learn to ignore.
 *
 * A STALE REPORT SHOWS NO NUMBER AT ALL, and there is deliberately no greyed-out
 * treatment for one: a faded number is still a number people read, RULE #3 reserves
 * fading for text nobody is meant to read, and a count that has stopped being true is
 * worse than no count. Fix three broken links, and a strip still reading "3 broken" is
 * the one number the author was meant to trust telling them the one lie that matters.
 */
function CheckLabel({ report, stale }: { report: SiteCheckReport | null; stale: boolean }) {
  const counts = !stale && report ? report.counts : null;
  if (!counts || (counts.error === 0 && counts.warning === 0)) {
    return (
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
        Check
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      {counts.error > 0 ? (
        <span className="flex items-center gap-1">
          <span className="bg-error size-2 shrink-0 rounded-full" aria-hidden />
          {String(counts.error)} broken
        </span>
      ) : null}
      {counts.warning > 0 ? (
        <span className="flex items-center gap-1">
          <span className="bg-warning size-2 shrink-0 rounded-full" aria-hidden />
          {String(counts.warning)} to fix
        </span>
      ) : null}
    </span>
  );
}

/** `aria-controls` target, so the item announces what it opens. */
const CHECK_PANEL_ID = 'sparx-site-check-panel';

/* ── The panel ──────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The last report, or null when the check has not been run in this session. */
  report: SiteCheckReport | null;
  /** True once the document has changed since `report` was produced. */
  stale: boolean;
  running: boolean;
  error: unknown;
  /**
   * Save the draft, then run.
   *
   * THE SAVE IS THE PRECONDITION, which is why this lives in the studio rather than
   * here: the endpoint reads the SAVED draft and would otherwise describe a version the
   * author has already edited past — a check one save behind says "clean" about work it
   * has never seen. The publish flow needs the same ordering, so it is stated once.
   */
  onRun: () => void;
}

export function SiteCheck({ open, onOpenChange, report, stale, running, error, onRun }: Props) {
  const editor = useEditor();
  const toast = useToast();
  // Which rows this session has already fixed. LOCAL, and deliberately not derived from
  // a re-run: applying a fix makes the whole report stale, and re-running after each one
  // would mean a save plus a full site walk per click. Marking the row done is the honest
  // middle — it says what THIS click did without claiming anything about the other rows.
  const [fixed, setFixed] = useState<ReadonlySet<string>>(() => new Set());

  /**
   * Open the thing a finding lives in and select the block.
   *
   * `exitSymbol` first, unconditionally: the author may currently be editing a saved
   * piece, and `setActivePage` while inside one leaves the canvas showing the master
   * with the page switched underneath it — the selection lands somewhere the author
   * cannot see. Leaving first is a no-op when they are not in one.
   *
   * Then the SPINE moves before the selection does — see the note at the top of the
   * file. `enterSymbol` carries its own tree; `page` and `frame` need saying out loud.
   *
   * The panel closes only on a selection that LANDED. Closing regardless would drop the
   * author on a canvas with nothing selected and no list to go back to, which is how the
   * original bug read even once the cause was elsewhere.
   */
  /** Say the block has gone, rather than leaving a click looking broken. */
  const missing = useCallback((): void => {
    toast.add({
      title: 'That block is not there any more',
      description: 'Run the check again to see the current list.',
      type: 'warning',
    });
  }, [toast]);

  /**
   * Point the editor's spine at the tree a finding lives in, WITHOUT selecting anything.
   *
   * Split out of `goTo` because applying a fix needs the same correction for a different
   * reason: `activeRootNode` is the tree the spine is on, so reading a header node's
   * classes while the spine is on a page body finds nothing — the same tree-scoping that
   * made `select` silently fail, one call earlier.
   */
  const pointSpineAt = useCallback(
    (finding: CheckFinding) => {
      const { scope, ownerId } = finding.location;
      editor.exitSymbol();
      if (scope === 'symbol' && ownerId) editor.enterSymbol(ownerId);
      else if (scope === 'frame') editor.setActiveTree('frame');
      else {
        // Stated rather than inherited. `exitSymbol` happens to land on the page body
        // already, so this is a no-op today — but "which tree does a page finding
        // open?" should be answered here, not two lines up in a call whose job is
        // leaving a symbol. A `site`-scoped finding (the theme's colors) has no tree
        // of its own and the page body is where an author acts on it.
        editor.setActiveTree('page');
        if (scope === 'page' && ownerId) editor.setActivePage(ownerId);
      }
    },
    [editor]
  );

  const goTo = useCallback(
    (finding: CheckFinding) => {
      const { nodeId } = finding.location;
      try {
        pointSpineAt(finding);
        // No node to select — a whole-page finding. The navigation above IS the answer.
        if (!nodeId) {
          onOpenChange(false);
          return;
        }
        if (editor.select(nodeId)) onOpenChange(false);
        else missing();
      } catch {
        // A bad page/symbol id throws before the selection is even attempted; same news.
        missing();
      }
    },
    [editor, missing, onOpenChange, pointSpineAt]
  );

  /**
   * Apply a finding's fix to the author's document.
   *
   * THE SERVER DECIDED THIS WAS OFFERABLE, and it is the only thing that could: whether
   * a replacement is unambiguous is a vocabulary question, and whether applying it is
   * SAFE is an ancestor question (`site-lint`'s `fixFor`). This function's job is to
   * carry out a decision already made, not to make one — so there is no cleverness here
   * and there should never be any.
   *
   * IT GOES THROUGH `setClass`, which means it is an op, which means CTRL+Z UNDOES IT
   * like any other edit. That was the condition for building this at all: a check that
   * silently rewrites a page is worse than one that only complains, and the difference
   * between the two is entirely whether the author can take it back.
   *
   * READ-MODIFY-WRITE, because `setClass` takes a whole replacement string. The read has
   * to come from the tree the finding lives in — hence `pointSpineAt` first — and the
   * token has to still be there: a stale report naming a class the author has already
   * changed must not have its old value written back over the new one.
   */
  const applyFix = useCallback(
    (finding: CheckFinding): boolean => {
      const { nodeId } = finding.location;
      const fix = finding.fix;
      if (!fix || !nodeId) return false;
      try {
        pointSpineAt(finding);
        const node = findById(editor.activeRootNode, nodeId);
        if (!node) {
          missing();
          return false;
        }
        const tokens = (node.class ?? '').split(/\s+/).filter(Boolean);
        if (!tokens.includes(fix.from)) {
          toast.add({
            title: 'That styling has already changed',
            description: 'Run the check again to see the current list.',
            type: 'warning',
          });
          return false;
        }
        // Replace in place rather than filter-and-append: class order is not meaningful
        // to CSS, but it IS meaningful to the person who opens the Classes field next,
        // and shuffling their list on every fix is a gratuitous diff.
        const next = tokens.map((t) => (t === fix.from ? fix.to : t)).join(' ');
        const result = editor.setClass(nodeId, next);
        if (!result.ok) {
          toast.add({
            title: 'That change was not allowed',
            description: result.reason,
            type: 'error',
          });
          return false;
        }
        return true;
      } catch {
        missing();
        return false;
      }
    },
    [editor, missing, pointSpineAt, toast]
  );

  /** Open a page from the weight list. Same `exitSymbol` precaution as `goTo`, and the
   *  same reason for naming the tree: switching pages while the spine is on the frame
   *  changes which body the Outlet previews and nothing the author is editing, so the
   *  click would appear to do nothing here too. */
  const goToPage = useCallback(
    (pageId: string) => {
      try {
        editor.exitSymbol();
        editor.setActiveTree('page');
        editor.setActivePage(pageId);
        onOpenChange(false);
      } catch {
        toast.add({
          title: 'That page is not there any more',
          description: 'Run the check again to see the current list.',
          type: 'warning',
        });
      }
    },
    [editor, onOpenChange, toast]
  );

  return (
    // Scoped to the pane, like every other overlay this app owns (window-boundary.tsx):
    // portalled to `document.body`, a torn-off window would open this on the wrong monitor.
    <PaneScope>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger>
          {/* THE NUMBER IS THE TARGET (silicaui 0.45 `StatusItem` / docs/silicaui/01 §18).
              Brandon's instinct on first seeing "3 broken · 15 to fix" in the strip was
              to click it, and for a while he could not: §14 documented this slot as
              non-interactive, so the count sat here and the control that opened the list
              sat in the toolbar, two floors from the number that motivates pressing it.

              `StatusItem` is what closed that without repealing the rule. With an
              `onClick` it renders a ghost `btn-xs` — 24px inside the 28px strip, so the
              row height never moves — and carries `aria-expanded`/`aria-controls`. The
              line it keeps is that a status item may DISCLOSE its own detail but never
              ACT: Run still lives inside the panel, beside the list it refreshes. */}
          <StatusItem
            onClick={() => onOpenChange(!open)}
            expanded={open}
            controls={CHECK_PANEL_ID}
            title="Check for broken links, unreadable text and missing descriptions"
          >
            <CheckLabel report={report} stale={stale} />
          </StatusItem>
        </PopoverTrigger>
        <PopoverContent
          id={CHECK_PANEL_ID}
          // Opens UPWARD now that it hangs off the footer rather than the header.
          side="top"
          align="end"
          className="flex max-h-[34rem] w-[30rem] max-w-[calc(100vw-2rem)] flex-col p-0"
        >
          <div className="border-base-300 flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-lg font-semibold">Check before you publish</h2>
            <Button size="sm" variant="outline" color="neutral" onClick={onRun} disabled={running}>
              <RefreshCw className="size-4" aria-hidden />
              {running ? 'Checking…' : report ? 'Check again' : 'Run check'}
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {error ? (
              <Alert color="error">
                <AlertContent>
                  <AlertTitle>Could not run the check</AlertTitle>
                  <AlertDescription>
                    {builderErrorMessage(
                      error,
                      'Your work is saved. Try the Check button again in a moment.'
                    )}
                  </AlertDescription>
                </AlertContent>
              </Alert>
            ) : !report ? (
              <p className="text-base">
                {running
                  ? 'Checking every page…'
                  : 'This looks over every page, your header and footer, and everything inside ' +
                    'your saved pieces — for links that go nowhere, words that cannot be read, ' +
                    'and pictures with nothing in them. Nothing it finds can stop you publishing.'}
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {stale ? (
                  <Alert color="warning">
                    <AlertContent>
                      <AlertDescription>
                        You have changed the site since this ran, so it may not still be true.
                      </AlertDescription>
                    </AlertContent>
                  </Alert>
                ) : null}

                {report.findings.length === 0 ? (
                  <Alert color="success" variant="soft">
                    <AlertContent>
                      <AlertTitle>
                        <CheckCircle2 className="size-4" aria-hidden /> Nothing to flag
                      </AlertTitle>
                      <AlertDescription>
                        All {report.pagesChecked} page{report.pagesChecked === 1 ? '' : 's'} came
                        back clean — every link goes somewhere, every image is described, and the
                        words can be read against what is behind them.
                      </AlertDescription>
                    </AlertContent>
                  </Alert>
                ) : (
                  <FindingGroups
                    report={report}
                    onGoTo={goTo}
                    onFix={applyFix}
                    fixed={fixed}
                    onFixed={(key) => setFixed((prev) => new Set(prev).add(key))}
                  />
                )}
                <PageWeights budget={report.budget} onGoToPage={goToPage} />
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </PaneScope>
  );
}

/** One row's identity, stable across a re-render and unique within a report — the same
 *  tuple `mergeFindings` keys on server-side. */
function keyOf(finding: CheckFinding, index: number): string {
  return `${finding.rule}-${finding.location.nodePath}-${String(index)}`;
}

function FindingGroups({
  report,
  onGoTo,
  onFix,
  fixed,
  onFixed,
}: {
  report: SiteCheckReport;
  onGoTo: (finding: CheckFinding) => void;
  onFix: (finding: CheckFinding) => boolean;
  fixed: ReadonlySet<string>;
  onFixed: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {ORDER.map((severity) => {
        const group = report.findings.filter((f) => f.severity === severity);
        if (group.length === 0) return null;
        const meta = SEVERITY[severity];
        const Icon = meta.icon;
        return (
          <section key={severity} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Icon className="size-4" aria-hidden />
              {meta.heading}
              <Badge color={meta.color} variant="soft" size="sm">
                {group.length}
              </Badge>
            </h3>
            <p className="text-base">{meta.meaning}</p>
            <ul className="border-base-300 divide-base-300 divide-y rounded-lg border">
              {group.map((finding, i) => {
                const key = keyOf(finding, i);
                return (
                  <FindingRow
                    key={key}
                    finding={finding}
                    onGoTo={onGoTo}
                    fixed={fixed.has(key)}
                    onFix={() => {
                      if (onFix(finding)) onFixed(key);
                    }}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * ONE LINE, and the row itself is the button.
 *
 * "Show me" was a separate control for the thing clicking a row obviously does, which
 * cost a target, a label and a column of width on every row in the list. The paragraph
 * that used to sit under every title is behind the chevron: written for someone who does
 * not know what a `gap` is, and read by that person on the ONE finding they are looking
 * at, rather than on all thirty at once.
 */
function FindingRow({
  finding,
  onGoTo,
  fixed,
  onFix,
}: {
  finding: CheckFinding;
  onGoTo: (finding: CheckFinding) => void;
  fixed: boolean;
  onFix: () => void;
}) {
  const [openDetail, setOpenDetail] = useState(false);
  // A finding with no block to select — a whole page, or the site's colors — has
  // nothing to open, so it does not pretend to be a button.
  const canOpen = finding.location.nodeId !== null || finding.location.scope === 'page';
  const meta = SEVERITY[finding.severity];
  const Chevron = openDetail ? ChevronDown : ChevronRight;

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className={`${meta.dot} size-2 shrink-0 rounded-full`} aria-hidden />
        {canOpen ? (
          <button
            type="button"
            onClick={() => onGoTo(finding)}
            className="hover:bg-base-200 -mx-1 min-w-0 flex-1 rounded px-1 text-left"
            title="Show me this on the page"
          >
            <RowLabel finding={finding} />
          </button>
        ) : (
          <span className="min-w-0 flex-1">
            <RowLabel finding={finding} />
          </span>
        )}
        {/* Only where the server said the correction is both unambiguous and safe to
            apply — see `LintFix`. Most rows will never show this, which is correct:
            "choose a destination for this link" is the author's sentence to write. */}
        {finding.fix ? (
          fixed ? (
            <Badge color="success" variant="soft" size="sm">
              Fixed
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              color="neutral"
              onClick={onFix}
              title={`${finding.fix.label}. You can undo this with Ctrl+Z.`}
              className="shrink-0"
            >
              Fix it
            </Button>
          )
        ) : null}
        <button
          type="button"
          onClick={() => setOpenDetail((v) => !v)}
          aria-expanded={openDetail}
          aria-label={openDetail ? 'Hide the explanation' : 'What does this mean?'}
          className="hover:bg-base-200 shrink-0 rounded p-1"
        >
          <Chevron className="size-4" aria-hidden />
        </button>
      </div>
      {openDetail ? (
        <div className="flex flex-col gap-2 px-3 pb-3 pl-7">
          <p className="text-base">{finding.detail}</p>
          {finding.evidence ? (
            <code className="bg-base-200 self-start rounded px-2 py-1 text-base">
              {finding.evidence}
            </code>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Title and place on ONE line. `truncate` rather than wrapping, so a long page name
 *  cannot quietly turn a one-line row back into three. */
function RowLabel({ finding }: { finding: CheckFinding }) {
  return (
    <span className="block truncate text-base">
      <span className="font-medium">{finding.title}</span>
      <span> — in {placeOf(finding)}</span>
    </span>
  );
}

/**
 * How much each page weighs — a measurement, sitting beside the findings and
 * deliberately not among them.
 *
 * COLLAPSED BY DEFAULT. It is reference, not a worklist: an author opens it when asking
 * "why does my site feel slow", never while triaging a link that goes nowhere. Expanded,
 * it was most of the panel's length for most of the panel's life.
 *
 * THE NUMBER IS A FLOOR AND THE PANEL SAYS SO. Only two things can be counted from
 * here: the page's own markup, and the picture files it points at. The stylesheet,
 * the fonts, anything embedded from another site, and any picture hosted somewhere
 * we cannot look up are all on top of it. Showing this as "your page weighs X" would
 * be a number that is wrong in the reassuring direction, which is the worst way for a
 * number to be wrong.
 */
function PageWeights({
  budget,
  onGoToPage,
}: {
  budget: CheckBudget;
  onGoToPage: (pageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (budget.pages.length === 0) return null;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section className="border-base-300 flex flex-col gap-3 border-t pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-base-200 -mx-1 flex items-center gap-2 rounded px-1 py-1 text-left"
      >
        <Chevron className="size-4 shrink-0" aria-hidden />
        <Gauge className="size-4 shrink-0" aria-hidden />
        <span className="text-base font-semibold">How much each page weighs</span>
      </button>

      {open ? (
        <>
          <p className="text-base">
            Everything on a page has to be downloaded before a visitor sees it, and people on a
            phone leave if that takes too long. Nothing here is a problem to fix — a page full of
            large photographs may be exactly what you meant. It is at least this much: your styling,
            fonts and anything embedded from elsewhere are on top.
          </p>

          <ul className="flex flex-col gap-2">
            {budget.pages.map((page) => (
              <li
                key={page.pageId}
                className="border-base-300 flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-base font-semibold">{page.pageName}</span>
                  <span className="text-base">
                    {formatBytes(page.totalBytes)}
                    {page.imageCount > 0
                      ? ` — ${formatBytes(page.imageBytes)} of that is ${plural(page.imageCount, 'picture', 'pictures')}`
                      : ' — no pictures on it'}
                  </span>
                  {page.imagesUnsized > 0 ? (
                    <span className="text-base">
                      Plus {plural(page.imagesUnsized, 'picture', 'pictures')} we could not weigh —
                      either stored somewhere other than your library, or filled in from your
                      products when the page loads.
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge color={BAND[page.band].color} variant="soft" size="sm">
                    {BAND[page.band].label}
                  </Badge>
                  <Button
                    color="neutral"
                    variant="outline"
                    size="sm"
                    onClick={() => onGoToPage(page.pageId)}
                  >
                    Open
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {budget.heavyImages.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h4 className="text-base font-semibold">Pictures worth shrinking</h4>
              <p className="text-base">
                Resizing one of these does more for how fast your site feels than anything else on
                this panel. A photograph rarely needs to be wider than about 2000 pixels.
              </p>
              <ul className="flex flex-col gap-1">
                {budget.heavyImages.map((image) => (
                  <li key={image.src} className="text-base">
                    <span className="font-semibold">{formatBytes(image.bytes)}</span> —{' '}
                    <span className="break-all">{fileNameOf(image.src)}</span>
                    {image.pageCount > 1
                      ? `, on ${plural(image.pageCount, 'page', 'pages')} — one change fixes all of them`
                      : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {budget.unbackedClasses.length > 0 ? (
            <p className="text-base">
              {plural(budget.unbackedClasses.length, 'styling name', 'styling names')} on this site
              produce nothing at all: {budget.unbackedClasses.join(', ')}. Each one is listed above
              with the block it is on.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** The part of a picture's address a person recognises. The full URL is a storage
 *  path nobody chose and nobody can read; the file name is what they uploaded. */
function fileNameOf(src: string): string {
  if (src.startsWith('data:')) return 'a picture pasted into the page';
  const path = src.split(/[?#]/)[0] ?? src;
  const last = path.split('/').filter(Boolean).pop();
  return last ? decodeURIComponent(last) : src;
}
