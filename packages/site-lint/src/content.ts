// What is actually ON the page: images, the heading outline, and controls that look
// clickable.
//
// These are the checks a person cannot run on their own work. An author knows what
// their image shows, so they never notice it has no description; they know what their
// button is for, so they never notice nothing is wired to it; and they read the page
// by eye, not as an outline, so a heading that jumps from a title straight to a
// sub-sub-heading looks fine. Each of these only shows up to somebody else — a
// screen-reader user, a visitor who clicks, a search engine reading the structure.
//
// The rule that gates all of them: a node whose content comes from a record is left
// alone. A product template's image has no source and its heading has no words until
// a product fills them in, and flagging that would mean every collection template on
// every site reporting as broken.

import type { DocumentInventory, VisitedNode } from './walk';
import {
  accessibleName,
  attr,
  bindsAttr,
  hasAttr,
  hasMedia,
  isBound,
  isElement,
  prop,
  typeOf,
  visibleText,
} from './walk';
import type { RawFinding } from './finding';

const HEADING_TAGS = new Map([
  ['h1', 1],
  ['h2', 2],
  ['h3', 3],
  ['h4', 4],
  ['h5', 5],
  ['h6', 6],
]);

/** silica atoms that render an image. `Avatar` is included because a missing avatar
 *  description is the same problem wearing a different component name. */
const IMAGE_COMPONENTS = new Set(['image', 'avatar']);

/** silica atoms that render a control. */
const CONTROL_COMPONENTS = new Set(['button', 'link', 'navlink', 'anchor']);

function locate(visited: VisitedNode): Pick<RawFinding, 'origin' | 'nodeId' | 'nodePath'> {
  return {
    origin: visited.origin,
    nodeId: visited.node.id ?? null,
    nodePath: visited.nodePath,
  };
}

/* ── Images ─────────────────────────────────────────────────────────────────── */

/**
 * WHY AN ABSENT `alt` AND AN EMPTY ONE ARE DIFFERENT. `alt=""` is the correct,
 * deliberate marking for a decorative image — one that repeats something the
 * surrounding text already says, where a screen reader announcing it would be noise.
 * The sparx catalog uses it on purpose (a blog post's hero image sits directly under
 * the headline it illustrates). An ABSENT `alt` is the opposite: nobody decided
 * anything, and the screen reader falls back to reading out the file name.
 *
 * So an empty description passes silently and a missing one is reported. Collapsing
 * the two would either nag about every deliberately-decorative image or miss every
 * accidental one.
 */
function checkImages(inventory: DocumentInventory): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const visited of inventory.nodes) {
    const { node } = visited;
    const type = typeOf(node).toLowerCase();
    const isImgElement = isElement(node) && type === 'img';
    const isImgAtom = node.kind === 'component' && IMAGE_COMPONENTS.has(type);
    if (!isImgElement && !isImgAtom) continue;

    const bound = isBound(node);
    const src = isImgElement ? attr(node, 'src') : prop(node, 'src');
    if (!src && !bound) {
      findings.push({
        ...locate(visited),
        rule: 'image-no-source',
        severity: 'error',
        title: 'This image has no picture in it',
        detail:
          'The image block is on the page but no file has been chosen, so visitors see an empty ' +
          'box with a broken-image icon. Pick a picture for it, or delete the block.',
      });
    }

    const described = isImgElement
      ? hasAttr(node, 'alt')
      : node.kind === 'component' && node.props != null && 'alt' in node.props;
    if (!described) {
      findings.push({
        ...locate(visited),
        rule: 'image-no-description',
        severity: 'warning',
        title: 'This image has no description',
        detail:
          'A short description of what the picture shows is read aloud to visitors who use a ' +
          'screen reader, shown if the image fails to load, and used by search engines to ' +
          'understand the page. Describe it in a few words — or, if the picture is purely ' +
          'decorative and the text beside it already says the same thing, set the description to ' +
          'empty on purpose so it is skipped rather than left undecided.',
        ...(src ? { evidence: src } : {}),
      });
    }
  }

  return findings;
}

/* ── The heading outline ────────────────────────────────────────────────────── */

/**
 * Headings are read in COMPOSED document order — chrome, page body, chrome — because
 * that is the order a screen reader and a search engine read them in. Checking the
 * page body alone would report a clean outline on a page whose footer headings sit
 * two levels below anything above them.
 */
function checkHeadings(inventory: DocumentInventory): RawFinding[] {
  const findings: RawFinding[] = [];
  const headings: { visited: VisitedNode; level: number }[] = [];

  for (const visited of inventory.nodes) {
    if (!isElement(visited.node)) continue;
    const level = HEADING_TAGS.get(visited.node.tag.toLowerCase());
    if (level) headings.push({ visited, level });
  }

  for (const { visited, level } of headings) {
    if (isBound(visited.node) || visibleText(visited.node)) continue;
    findings.push({
      ...locate(visited),
      rule: 'heading-empty',
      severity: 'warning',
      title: 'This heading has no words in it',
      detail:
        'An empty heading leaves a gap in the page for anyone reading it with a screen reader, ' +
        `and search engines see a level-${String(level)} heading with nothing under it. Write the ` +
        'heading, or remove it.',
    });
  }

  const tops = headings.filter((h) => h.level === 1);
  // A page built around a live region — the cart, the search results, the catalog
  // listing, the sign-in form — has its main heading rendered by that region at
  // request time, because the heading depends on what the region found ("4 results
  // for wiper blades"). It is not in the authored tree and cannot be, so reporting it
  // as missing would be telling an owner to add a second heading to a page that
  // already has one. The gap this leaves is narrow and worth it: a page carrying a
  // live region AND genuinely lacking a heading goes unreported.
  const hasLiveRegion = inventory.nodes.some((v) => v.node.kind === 'host');
  if (tops.length === 0 && !hasLiveRegion) {
    findings.push({
      origin: { scope: 'page', ownerId: inventory.page.id, ownerName: inventory.page.name },
      nodeId: null,
      nodePath: '',
      rule: 'heading-missing',
      severity: 'warning',
      title: 'This page has no main heading',
      detail:
        'Every page needs one main heading that says what the page is about. It is the first ' +
        'thing a screen reader announces and the strongest signal a search engine has about the ' +
        'subject of the page. Make the most important line on the page a main heading.',
    });
  } else if (tops.length > 1) {
    // The first top-level heading is the page's; any further one is a competing
    // claim about what the page is about, so the finding lands on the extra, not
    // on the original.
    for (const extra of tops.slice(1)) {
      findings.push({
        ...locate(extra.visited),
        rule: 'heading-multiple-top',
        severity: 'suggestion',
        title: 'This page has more than one main heading',
        detail:
          'A page should say what it is about once. When several lines are all marked as the ' +
          'main heading, search engines have to guess which one counts. Keep the most important ' +
          'one as the main heading and make the others section headings.',
        ...(visibleText(extra.visited.node)
          ? { evidence: visibleText(extra.visited.node).slice(0, 80) }
          : {}),
      });
    }
  }

  let previous = 0;
  for (const { visited, level } of headings) {
    if (previous && level - previous > 1) {
      findings.push({
        ...locate(visited),
        rule: 'heading-level-skipped',
        severity: 'suggestion',
        title: 'A heading level was skipped here',
        detail:
          `This heading is a level ${String(level)}, but the heading before it was a level ` +
          `${String(previous)} — so the page jumps a step. Headings work like an outline: a ` +
          'reader using a screen reader navigates by them, and a gap makes it sound as though a ' +
          'section is missing. Move this one up to level ' +
          `${String(previous + 1)}, or add the heading that belongs between them.`,
        ...(visibleText(visited.node) ? { evidence: visibleText(visited.node).slice(0, 80) } : {}),
      });
    }
    previous = level;
  }

  return findings;
}

/* ── Controls ───────────────────────────────────────────────────────────────── */

/** Is this node something a visitor would try to click? */
function isControl(visited: VisitedNode): boolean {
  const type = typeOf(visited.node).toLowerCase();
  if (isElement(visited.node)) return type === 'a' || type === 'button';
  return visited.node.kind === 'component' && CONTROL_COMPONENTS.has(type);
}

/**
 * A control with nothing wired to it.
 *
 * A published sparx page is static HTML: the only things that make a control do
 * something are a destination (`href`), a form to submit, or a silica behavior marker
 * that the runtime hydrates. A `<button>` carrying none of those is a button that
 * looks completely finished and does nothing at all when pressed — the single most
 * embarrassing thing a site can ship, and one that cannot be spotted in the editor,
 * where clicking selects the node rather than triggering it.
 *
 * The bar for reporting one is deliberately high. Anything inside a form, inside a
 * behavior, marked as a behavior part, bound to an action, or typed as a submit
 * button has a job, and none of them are flagged.
 */
function checkDeadControls(inventory: DocumentInventory): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const visited of inventory.nodes) {
    if (!isControl(visited)) continue;
    const { node } = visited;
    const type = typeOf(node).toLowerCase();

    const wired =
      visited.inInteractive ||
      node.behavior != null ||
      node.part != null ||
      isBound(node) ||
      bindsAttr(node, 'href') ||
      attr(node, 'type') === 'submit' ||
      Boolean(isElement(node) ? attr(node, 'href') : prop(node, 'href'));

    if (!wired) {
      findings.push({
        ...locate(visited),
        rule: 'button-does-nothing',
        severity: 'warning',
        title:
          type === 'a'
            ? 'This looks like a link but is not one'
            : 'Nothing happens when this button is pressed',
        detail:
          type === 'a'
            ? 'It is styled as a link, so visitors will try to click it, but no destination was ' +
              'ever set — so it behaves like ordinary text. Give it a destination, or restyle it ' +
              'so it does not invite a click.'
            : 'The button is on the page and looks ready to use, but nothing is connected to it: ' +
              'it has no destination, it is not part of a form, and it does not open or toggle ' +
              'anything. Give it a destination, put it in a form, or remove it — a button that ' +
              'does nothing costs more trust than a missing one.',
        ...(visibleText(node) ? { evidence: visibleText(node).slice(0, 80) } : {}),
      });
    }

    // Nested controls are content inside their parent, not separate targets — the
    // parent already carries the words.
    if (visited.inControl) continue;
    if (isBound(node)) continue;
    if (visibleText(node) || hasMedia(node) || accessibleName(node)) continue;

    findings.push({
      ...locate(visited),
      rule: 'control-no-label',
      severity: 'warning',
      title: type === 'a' ? 'This link has nothing in it' : 'This button has nothing in it',
      detail:
        'There are no words and no icon inside it, so on the live page it is an invisible or ' +
        'blank target. Add the words that say what it does — or, if it is meant to be an ' +
        'icon-only control, add the icon and a short description of what pressing it does.',
    });
  }

  return findings;
}

/* ── The page as a whole ────────────────────────────────────────────────────── */

/** A node that puts something in front of a visitor by itself — a live region the
 *  storefront fills (a product grid, the cart) or a record-bound node. */
function isLiveContent(node: VisitedNode['node']): boolean {
  return node.kind === 'host' || isBound(node);
}

/**
 * A page whose own body says nothing.
 *
 * Scoped to nodes authored ON THE PAGE, never the chrome: a page with a full header
 * and footer and an empty middle is still an empty page, and it is precisely the one
 * that gets published by accident — created, named, added to the navigation, and
 * never filled in.
 */
function checkPageEmpty(inventory: DocumentInventory): RawFinding[] {
  const own = inventory.nodes.filter((v) => v.origin.scope === 'page');
  const hasSomething = own.some(
    (v) => isLiveContent(v.node) || visibleText(v.node).length > 0 || hasMedia(v.node)
  );
  if (hasSomething) return [];

  return [
    {
      origin: { scope: 'page', ownerId: inventory.page.id, ownerName: inventory.page.name },
      nodeId: null,
      nodePath: '',
      rule: 'page-empty',
      severity: 'error',
      title: 'This page is empty',
      detail:
        'Apart from the header and footer there is nothing on it — a visitor who arrives here ' +
        'sees a blank space. Add the content, or remove the page so nothing links to it.',
    },
  ];
}

/** Every content finding for one page's composed document. */
export function checkContent(inventory: DocumentInventory): RawFinding[] {
  return [
    ...checkPageEmpty(inventory),
    ...checkImages(inventory),
    ...checkHeadings(inventory),
    ...checkDeadControls(inventory),
  ];
}
