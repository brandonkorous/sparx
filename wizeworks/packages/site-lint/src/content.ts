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

import {
  HOST_KEYS,
  embedOutcome,
  frameEmbedProblem,
  mapEmbedProblem,
} from '@wizeworks/silica-catalog';

import type { DocumentInventory, VisitedNode } from './walk';
import {
  accessibleName,
  attr,
  bindsAttr,
  hasAttr,
  hasMedia,
  imageSrc,
  isBound,
  isElement,
  isImageNode,
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
    if (!isImageNode(node)) continue;
    const isImgElement = isElement(node);

    const bound = isBound(node);
    const src = imageSrc(node);
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
 *  live site fills (a product grid, the cart) or a record-bound node. */
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

/* ── Embeds ─────────────────────────────────────────────────────────────────── */

/**
 * The sentence for each way a video or embed block disappoints its author.
 *
 * SHORT, AND IT SHOULD STAY SHORT. On silicaui 0.47 this table had eight entries, because
 * the engine could not play a Short, a livestream, a playlist or a Vimeo channel link,
 * and it silently dropped start times and the private hash an unlisted video needs. 0.49
 * fixed all of them, and the six sentences explaining those failures were deleted rather
 * than kept "just in case" — advice for a problem that no longer exists is worse than no
 * advice, because it sends an author to change a link that was already right.
 *
 * The rule the survivors obey: the FIX is in the sentence. "Invalid URL" is accurate and
 * useless to the person who has to act on it.
 */
const EMBED_ADVICE: Record<string, { title: string; detail: string }> = {
  empty: {
    title: 'This block has no link in it yet',
    detail:
      'Nothing appears here at all — visitors just get a gap where the video or booking ' +
      'calendar was meant to be, and nothing on the page says why. Open the block and paste ' +
      'the address of the thing you want to show, or remove the block.',
  },
  link: {
    title: 'This will show a link to click, not the thing itself',
    detail:
      'Videos can play on the page when they come from YouTube or Vimeo. Anything else — and ' +
      'any link that points at a channel or a search rather than one video — becomes a link ' +
      'visitors have to click. That still works, so leave it if you meant it; if you wanted it ' +
      'to appear on the page, open the video itself and copy its address from your browser’s bar.',
  },
  'map-not-embeddable': {
    title: 'A map link won’t show a map here',
    detail:
      'Google only lets one particular kind of map address appear inside another site, so this ' +
      'one becomes a link instead. Use the Map block rather than this one and simply type your ' +
      'address — it builds the right kind of map for you.',
  },
};

/** The same job for the general Embed block, which is sparx's own frame rather than the
 *  engine's — so its failures are different ones. */
const FRAME_ADVICE: Record<string, { title: string; detail: string }> = {
  empty: {
    title: 'This embed has no link in it yet',
    detail:
      'Nothing appears here at all — visitors get a gap, and nothing on the page says why. ' +
      'Open the block and paste the address of the thing you want to show, or remove the block.',
  },
  insecure: {
    title: 'That link isn’t secure, so browsers will block it',
    detail:
      'Your site is served securely, and a browser refuses to show insecure content inside a ' +
      'secure page. Try the same address with https:// at the front — and if that site has no ' +
      'secure version, link to it in your words instead of showing it here.',
  },
  'not-a-link': {
    title: 'That doesn’t look like a web address',
    detail:
      'Paste the full address of the page you want to show, the way it appears in your ' +
      'browser’s bar, starting with https://',
  },
  'use-video-block': {
    title: 'Use the Video block for this one',
    detail:
      'YouTube and Vimeo don’t allow their ordinary pages to be shown inside another site, so ' +
      'this would come out blank. The Video block knows how to play them properly — put the ' +
      'same link in there instead.',
  },
};

const MAP_ADVICE: Record<string, { title: string; detail: string }> = {
  empty: {
    title: 'This map has no address in it yet',
    detail:
      'Nothing will appear here. Open the block and type your address — the same one on your ' +
      'contact page is fine. A Google Maps link works too.',
  },
  'shortened-link': {
    title: 'That is a shortened map link',
    detail:
      'A short link hides the actual place, so there is nothing here to put on a map. Open it, ' +
      'then copy the long address from your browser’s bar — or just type the address itself.',
  },
  'no-location-in-link': {
    title: 'We cannot find a place in that map link',
    detail:
      'The link has no address or coordinates in it. Search for your place on Google Maps, then ' +
      'copy the address from your browser’s bar — or type the address here directly.',
  },
};

/**
 * A video, embed or map block that will not do what its author thinks.
 *
 * WHY THIS RULE HAS TO EXIST. Both blocks fail SILENTLY, and both fail in the author's
 * blind spot. An `Embed` with nothing in it renders an empty element — no error, no
 * placeholder, just a gap where the video was meant to be — and one pointing at a channel
 * page, a search result or a Google Maps link renders a plain anchor, which reads as a
 * styling problem rather than as the engine's answer. The `site.map` core is silent by
 * choice, because an empty bordered box on a shop's contact page is worse than an
 * absence; the cost of that choice is that nothing on the live site says why the map is
 * missing.
 *
 * All of those look fine to the person who pasted the link. So this is where they find
 * out, and each case gets its own sentence naming the actual fix.
 *
 * `warning`, never `error`: a block placed today and filled in tomorrow is a normal way
 * to work, and the page around it is fine.
 */
function checkEmbeds(inventory: DocumentInventory): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const visited of inventory.nodes) {
    const { node } = visited;

    // The engine's own embed component — a video or anything else framed from another
    // site. `embedOutcome` models what silicaui will do with the link; its own test
    // pins that model against the real renderer, so this cannot quietly go stale.
    if (node.kind === 'component' && node.component === 'Embed') {
      const url = prop(node, 'url');
      const outcome = embedOutcome(url);
      // A degradation is more specific than the kind, so it wins: a maps link IS a
      // `link`, and "use the Map block" is a better sentence than "this shows as a link".
      const key =
        outcome.degraded ??
        (outcome.kind === 'empty' || outcome.kind === 'link' ? outcome.kind : '');
      const advice = EMBED_ADVICE[key];
      if (advice) {
        findings.push({
          ...locate(visited),
          rule: 'embed-no-source',
          severity: 'warning',
          ...advice,
          // The author's own string back, so they recognise which block is meant on a
          // page carrying several. Absent when the field is empty — there is nothing to
          // show them, and a blank quote reads as a bug in the check.
          ...(url ? { evidence: url } : {}),
        });
      }
      continue;
    }

    if (node.kind === 'host' && node.component === HOST_KEYS.siteMap) {
      const location = prop(node, 'location');
      const problem = mapEmbedProblem(location, node.props?.zoom);
      const advice = problem ? MAP_ADVICE[problem] : undefined;
      if (advice) {
        findings.push({
          ...locate(visited),
          rule: 'embed-no-source',
          severity: 'warning',
          ...advice,
          ...(location ? { evidence: location } : {}),
        });
      }
      continue;
    }

    if (node.kind === 'host' && node.component === HOST_KEYS.siteEmbed) {
      const url = prop(node, 'url');
      const problem = frameEmbedProblem(url);
      const advice = problem ? FRAME_ADVICE[problem] : undefined;
      if (advice) {
        findings.push({
          ...locate(visited),
          rule: 'embed-no-source',
          severity: 'warning',
          ...advice,
          ...(url ? { evidence: url } : {}),
        });
      }
    }
  }

  return findings;
}

/** Every content finding for one page's composed document. */
export function checkContent(inventory: DocumentInventory): RawFinding[] {
  return [
    ...checkPageEmpty(inventory),
    ...checkImages(inventory),
    ...checkHeadings(inventory),
    ...checkDeadControls(inventory),
    ...checkEmbeds(inventory),
  ];
}
