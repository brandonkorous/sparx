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
// WHY IT SAVES FIRST. The check reads the saved draft. Skipping the save would report
// on the state before the edit the author is about to publish, which is worse than not
// checking at all: it says "clean" about work it has never seen.
//
// CLICK-TO-NODE IS THE POINT. A list of problems nobody can find is a list nobody
// reads. Every finding that names a block opens the tree it lives in — the page, the
// header and footer, or the saved piece — and selects it, so "this button does
// nothing" is one click from the button.

import { useCallback } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  useToast,
} from '@wizeworks/silicaui-react';
import { useEditor } from '@wizeworks/silicaui-builder/react';
import { CheckCircle2, CircleAlert, Lightbulb, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  builderErrorMessage,
  useSiteCheck,
  type CheckFinding,
  type CheckSeverity,
  type SiteCheckReport,
} from './data';

/* ── How each severity reads ────────────────────────────────────────────────── */

interface SeverityMeta {
  /** Plural heading for the group. */
  heading: string;
  color: 'error' | 'warning' | 'info';
  icon: typeof CircleAlert;
  /** One line saying what this group MEANS, so the ranking is not just colour. */
  meaning: string;
}

const SEVERITY: Record<CheckSeverity, SeverityMeta> = {
  error: {
    heading: 'Broken for visitors',
    color: 'error',
    icon: CircleAlert,
    meaning: 'Someone visiting your site right now would hit this and it would not work.',
  },
  warning: {
    heading: 'Worth fixing',
    color: 'warning',
    icon: TriangleAlert,
    meaning: 'The page still works, but it is harder to use, harder to read, or harder to find.',
  },
  suggestion: {
    heading: 'Suggestions',
    color: 'info',
    icon: Lightbulb,
    meaning: 'Nothing is wrong. These are the things that make a good site a bit better.',
  },
};

const ORDER: CheckSeverity[] = ['error', 'warning', 'suggestion'];

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

/* ── The panel ──────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * What the Check button asks the studio to do: save the draft, then open.
   *
   * The SAVE IS THE PRECONDITION FOR THE QUERY, which is why it lives in the parent
   * rather than here. Both routes into this panel — the button, and "let me look
   * first" from the publish confirm — must have persisted the current draft before it
   * opens, because the endpoint reads the saved draft and would otherwise describe a
   * version the author has already moved on from. Keeping the ordering in one place
   * means the panel can simply say `enabled: open` and be right.
   */
  onRequestOpen: () => void;
}

export function SiteCheck({ open, onOpenChange, onRequestOpen }: Props) {
  const check = useSiteCheck(open);
  const editor = useEditor();
  const toast = useToast();

  /**
   * Open the thing a finding lives in and select the block.
   *
   * `exitSymbol` first, unconditionally: the author may currently be editing a saved
   * piece, and `setActivePage` while inside one leaves the canvas showing the master
   * with the page switched underneath it — the selection lands somewhere the author
   * cannot see. Leaving first is a no-op when they are not in one.
   */
  const goTo = useCallback(
    (finding: CheckFinding) => {
      const { scope, ownerId, nodeId } = finding.location;
      try {
        editor.exitSymbol();
        if (scope === 'symbol' && ownerId) editor.enterSymbol(ownerId);
        else if (scope === 'page' && ownerId) editor.setActivePage(ownerId);
        // The frame is part of every page's canvas, so a frame node needs no
        // navigation at all — selecting it is enough.
        if (nodeId) editor.select(nodeId);
        onOpenChange(false);
      } catch {
        // A stale id (the block was deleted between the check and the click) — say so
        // rather than leaving the click looking broken.
        toast.add({
          title: 'That block is not there any more',
          description: 'Run the check again to see the current list.',
          type: 'warning',
        });
      }
    },
    [editor, onOpenChange, toast]
  );

  const report = check.data;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Button
        size="sm"
        variant="ghost"
        color="neutral"
        onClick={onRequestOpen}
        title="Check for broken links, unreadable text and missing descriptions"
      >
        <ShieldCheck className="size-4" aria-hidden />
        Check
      </Button>
      <DrawerContent side="right" className="flex w-[34rem] max-w-full flex-col">
        <DrawerHeader>
          <DrawerTitle>Check before you publish</DrawerTitle>
          <p className="text-base-content text-base">
            Everything below is a note, not a rule. You can publish whenever you like — this is here
            so nothing reaches your visitors that you did not mean to send.
          </p>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {check.isPending ? (
            <p className="text-base-content p-4 text-base" role="status">
              Checking every page…
            </p>
          ) : check.isError ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not run the check</AlertTitle>
                <AlertDescription>
                  {builderErrorMessage(
                    check.error,
                    'Your work is saved. Try the Check button again in a moment.'
                  )}
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : !report ? null : report.findings.length === 0 ? (
            <Alert color="success" variant="soft">
              <AlertContent>
                <AlertTitle>
                  <CheckCircle2 className="size-4" aria-hidden /> Nothing to flag
                </AlertTitle>
                <AlertDescription>
                  All {report.pagesChecked} page{report.pagesChecked === 1 ? '' : 's'} came back
                  clean — every link goes somewhere, every image is described, and the words can be
                  read against what is behind them.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : (
            <FindingGroups report={report} onGoTo={goTo} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function FindingGroups({
  report,
  onGoTo,
}: {
  report: SiteCheckReport;
  onGoTo: (finding: CheckFinding) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-base-content text-base">
        Checked {report.pagesChecked} page{report.pagesChecked === 1 ? '' : 's'}, including your
        header and footer and everything inside your saved pieces.
      </p>
      {ORDER.map((severity) => {
        const group = report.findings.filter((f) => f.severity === severity);
        if (group.length === 0) return null;
        const meta = SEVERITY[severity];
        const Icon = meta.icon;
        return (
          <section key={severity} className="flex flex-col gap-2">
            <h3 className="text-base-content flex items-center gap-2 text-lg font-semibold">
              <Icon className="size-4" aria-hidden />
              {meta.heading}
              <Badge color={meta.color} variant="soft" size="sm">
                {group.length}
              </Badge>
            </h3>
            <p className="text-base-content text-base">{meta.meaning}</p>
            <ul className="flex flex-col gap-2">
              {group.map((finding, i) => (
                <FindingRow
                  key={`${finding.rule}-${finding.location.nodePath}-${String(i)}`}
                  finding={finding}
                  onGoTo={onGoTo}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function FindingRow({
  finding,
  onGoTo,
}: {
  finding: CheckFinding;
  onGoTo: (finding: CheckFinding) => void;
}) {
  // A finding with no block to select — a whole page, or the site's colours — has
  // nothing to open, so it does not pretend to be a button.
  const canOpen = finding.location.nodeId !== null || finding.location.scope === 'page';

  return (
    <li className="border-base-300 flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-base-content text-base font-semibold">{finding.title}</span>
          <span className="text-base-content text-base">in {placeOf(finding)}</span>
        </div>
        {canOpen ? (
          <Button color="neutral" variant="outline" size="sm" onClick={() => onGoTo(finding)}>
            Show me
          </Button>
        ) : null}
      </div>
      <p className="text-base-content text-base">{finding.detail}</p>
      {finding.evidence ? (
        <code className="bg-base-200 text-base-content self-start rounded px-2 py-1 text-base">
          {finding.evidence}
        </code>
      ) : null}
    </li>
  );
}
