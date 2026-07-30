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
//
// AND "OPENS THE TREE IT LIVES IN" MEANS `setActiveTree`, NOT JUST A PAGE SWITCH.
// silica's selection is TREE-SCOPED — "an id in one tree means nothing in the other" —
// and `editor.select(id)` neither validates the id nor moves the spine. So handing it a
// header node while the editor is on a page body sets a selection that matches nothing:
// the canvas draws no ring, the Navigator highlights no row, the Inspector describes
// nothing. Not an error, not a toast — literally nothing happens, which is the worst
// possible outcome for the one button whose entire job is "take me to it".
//
// This file used to reason that "the frame is part of every page's canvas, so a frame
// node needs no navigation at all". That is true of what you SEE and false of what you
// can select, and the header/footer is where a starter site's findings mostly are — an
// unfinished nav link, a logo with no description. So `goTo` now points the spine at the
// tree the finding names, in BOTH directions: a page finding clicked while the author is
// in Layout needs the same correction as a frame finding clicked from a page.
//
// TWO SECTIONS, AND THEY ARE NOT THE SAME KIND OF THING. Above: findings — something
// is wrong. Below: what each page WEIGHS — nothing is wrong, here is what a visitor
// downloads. Keeping weight out of the findings is deliberate; see `PageWeights`.

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
import {
  CheckCircle2,
  CircleAlert,
  Gauge,
  Lightbulb,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { PaneScope } from '../../../lib/dock/window-boundary';
import {
  builderErrorMessage,
  useSiteCheck,
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
   *
   * Then the SPINE moves before the selection does — see the note at the top of the
   * file. `enterSymbol` carries its own tree (and silica syncs its mode toggle off it);
   * `page` and `frame` need saying out loud.
   */
  const goTo = useCallback(
    (finding: CheckFinding) => {
      const { scope, ownerId, nodeId } = finding.location;
      try {
        editor.exitSymbol();
        if (scope === 'symbol' && ownerId) editor.enterSymbol(ownerId);
        else if (scope === 'frame') editor.setActiveTree('frame');
        else {
          // Stated rather than inherited. `exitSymbol` happens to land on the page body
          // already, so this is a no-op today — but "which tree does a page finding
          // open?" should be answered here, not two lines up in a call whose job is
          // leaving a symbol. A `site`-scoped finding (the theme's colours) has no tree
          // of its own and the page body is where an author acts on it.
          editor.setActiveTree('page');
          if (scope === 'page' && ownerId) editor.setActivePage(ownerId);
        }
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

  const report = check.data;

  return (
    // Scoped to the pane, like every other overlay this app owns (window-boundary.tsx):
    // portalled to `document.body` it dimmed the whole workbench for a panel belonging to
    // one editor, and in a torn-off window it would have opened on the wrong monitor.
    <PaneScope>
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
              Everything below is a note, not a rule. You can publish whenever you like — this is
              here so nothing reaches your visitors that you did not mean to send.
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
            ) : !report ? null : (
              <div className="flex flex-col gap-8">
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
                  <FindingGroups report={report} onGoTo={goTo} />
                )}
                <PageWeights budget={report.budget} onGoToPage={goToPage} />
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </PaneScope>
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

/**
 * How much each page weighs — a measurement, sitting beside the findings and
 * deliberately not among them.
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
  if (budget.pages.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base-content flex items-center gap-2 text-lg font-semibold">
        <Gauge className="size-4" aria-hidden />
        How much each page weighs
      </h3>
      <p className="text-base-content text-base">
        Everything on a page has to be downloaded before a visitor sees it, and people on a phone
        leave if that takes too long. Nothing here is a problem to fix — a page full of large
        photographs may be exactly what you meant. It is at least this much: your styling, fonts and
        anything embedded from elsewhere are on top.
      </p>

      <ul className="flex flex-col gap-2">
        {budget.pages.map((page) => (
          <li
            key={page.pageId}
            className="border-base-300 flex items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-base-content text-base font-semibold">{page.pageName}</span>
              <span className="text-base-content text-base">
                {formatBytes(page.totalBytes)}
                {page.imageCount > 0
                  ? ` — ${formatBytes(page.imageBytes)} of that is ${plural(page.imageCount, 'picture', 'pictures')}`
                  : ' — no pictures on it'}
              </span>
              {page.imagesUnsized > 0 ? (
                <span className="text-base-content text-base">
                  Plus {plural(page.imagesUnsized, 'picture', 'pictures')} we could not weigh —
                  either stored somewhere other than your library, or filled in from your products
                  when the page loads.
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
          <h4 className="text-base-content text-base font-semibold">Pictures worth shrinking</h4>
          <p className="text-base-content text-base">
            Resizing one of these does more for how fast your site feels than anything else on this
            panel. A photograph rarely needs to be wider than about 2000 pixels.
          </p>
          <ul className="flex flex-col gap-1">
            {budget.heavyImages.map((image) => (
              <li key={image.src} className="text-base-content text-base">
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
        <p className="text-base-content text-base">
          {plural(budget.unbackedClasses.length, 'styling name', 'styling names')} on this site
          produce nothing at all: {budget.unbackedClasses.join(', ')}. Each one is listed above with
          the block it is on.
        </p>
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
