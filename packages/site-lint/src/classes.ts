// Styling that compiles to nothing — located.
//
// The detection is `@sparx/silica-catalog`'s `checkClassString`, which is the single
// authority on which classes this platform's CSS actually contains and is unit-tested
// against the declared vocabulary it mirrors. This file adds the one thing that
// engine cannot provide and this one must: WHERE. `checkTreeClasses` answers "is
// anything broken on this site" with a deduplicated list of class names, which is the
// right answer for an MCP agent inspecting a tree it just wrote and the wrong one for
// an owner who has to go and change it. A finding here carries the node, so the Check
// step can select it.
//
// Deduplication moves accordingly. The catalog collapses by class name — nine cards
// sharing a broken `gap-7` are one thing to fix, and nine copies of the message buries
// it. Here the collapse happens in `mergeFindings` on (tree, node, class), which keeps
// that property for a class repeated across a page while still pointing at something.

import { checkClassString, containerVariants, type VocabularyIssue } from '@sparx/silica-catalog';

import type { DocumentInventory } from './walk';
import type { RawFinding } from './finding';
import type { LintFix, LintRuleId, LintSeverity } from './types';

interface Wording {
  rule: LintRuleId;
  severity: LintSeverity;
  title: string;
  lead: string;
}

/**
 * Two genuinely different problems wear the same shape.
 *
 * An arbitrary value or an out-of-range step emits NO CSS: the styling was typed, it
 * looks present in the field, and it does nothing anywhere — on the canvas or on the
 * live site. That is a warning.
 *
 * A viewport variant is the opposite. It works perfectly on the published page and
 * only fails in the PREVIEW, because the phone and tablet views resize an element
 * rather than the browser window. Nothing is broken for a visitor, so calling it a
 * warning would overstate it — but the author is being shown something untrue while
 * they work, which is worth a nudge.
 */
function wordingFor(reason: VocabularyIssue['reason']): Wording {
  if (reason === 'viewport-variant') {
    return {
      rule: 'class-preview-blind',
      severity: 'suggestion',
      title: "This styling can't be seen in the phone and tablet previews",
      lead:
        'It works on the live site, but the phone and tablet previews resize the block rather ' +
        'than the whole browser window — so switching between them shows no change and the ' +
        'design cannot be checked before publishing.',
    };
  }
  return {
    rule: 'class-no-css',
    severity: 'warning',
    title: "This styling won't appear anywhere",
    lead:
      reason === 'arbitrary-value'
        ? 'A size typed in by hand is not one of the sizes your design carries, so it is ignored ' +
          'completely — here in the editor and on your live page.'
        : 'This names a size your design does not include, so it is ignored completely — here in ' +
          'the editor and on your live page.',
  };
}

/**
 * The half of the message that names the concrete thing to write instead.
 *
 * BUILT FROM `replacement`, NOT FROM `hint`. The catalog ships both, derived from the
 * same values — but `hint` is a sentence for an MCP agent inspecting a tree it just
 * wrote, and it reads like one: "not in the declared scale and emits no CSS", "the
 * nearest declared step", a bare list of every legal number. Appending it verbatim put
 * that in front of a business owner, which is the one audience this surface has.
 *
 * Wording it here is NOT the second, quietly diverging answer the catalog warns about:
 * the class name still comes from `replacement`, the same field the one-click fix
 * substitutes. Prose and button now quote one value instead of two strings built
 * independently — so they cannot disagree, which the old pairing could.
 *
 * `offered` is the ancestor-aware decision from `fixFor`, and it belongs in the words:
 * promising "Fix it will do that" beside a withheld button is worse than saying nothing.
 */
function adviceFor(issue: VocabularyIssue, offered: boolean): string {
  const swap = offered ? ' Fix it will make the change.' : '';

  if (issue.reason === 'arbitrary-value') {
    return 'Pick one of the sizes your design already carries — those are the ones that show up.';
  }

  if (issue.reason === 'viewport-variant') {
    // The `@container` clause is load-bearing, so it survives — but it is the reason the
    // button is missing, and it is spelled out rather than assumed. An owner cannot act
    // on "needs a container ancestor"; they can act on "move it inside a section".
    return offered
      ? `Use \`${issue.replacement}\` instead, which measures this block rather than the ` +
          `browser window.${swap}`
      : `The version that measures this block is \`${issue.replacement}\`, but it only works ` +
          'inside a wrapper marked to be measured (`@container`) and nothing above this one is ' +
          '— so it is not offered as a one-click change. The sections, menu bar and footer your ' +
          'site came with are already marked.';
  }

  return issue.replacement
    ? `The closest size your design does carry is \`${issue.replacement}\`.${swap}`
    : 'Pick one of the sizes your design already carries.';
}

/**
 * Whether this issue may be offered as a one-click fix, and with what.
 *
 * TWO SEPARATE QUESTIONS, and conflating them is how an editor ships a "fix" that makes
 * a page worse:
 *
 *   1. IS THERE A SINGLE ANSWER? `vocabulary-check` answers that with `replacement`, and
 *      only sets it when there is one. `arbitrary-value` never carries one.
 *   2. IS APPLYING IT SAFE HERE? That is an ANCESTOR question, so only this walk can
 *      answer it — and for a viewport variant the answer is usually no. Rewriting
 *      `md:grid-cols-3` to `@3xl:grid-cols-3` under a node with no `@container` above it
 *      swaps a rule that works on a real device for one that matches nowhere at all. The
 *      author would watch their layout stop reflowing and have been told it was a fix.
 *      So the offer is withheld unless `inContainer`, and the hint — which explains the
 *      `@container` requirement in words — carries the case this cannot.
 *
 * A node with no id is unaddressable: nothing downstream could find it to edit it.
 */
function fixFor(
  issue: VocabularyIssue,
  visited: DocumentInventory['nodes'][number]
): { fix?: LintFix } {
  if (!issue.replacement || !visited.node.id) return {};
  if (issue.reason === 'viewport-variant' && !visited.inContainer) return {};
  return {
    fix: {
      kind: 'replace-class',
      from: issue.className,
      to: issue.replacement,
      label: `Change ${issue.className} to ${issue.replacement}`,
    },
  };
}

/**
 * Every unusable class in one page's composed document.
 *
 * The catalog's `hint` is deliberately NOT used here — see `adviceFor`. It is the same
 * finding worded for a different reader, and this one's reader is a business owner.
 */
export function checkClasses(inventory: DocumentInventory): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const visited of inventory.nodes) {
    const classes = visited.node.class;
    if (!classes) continue;

    // A container variant with no `@container` ancestor is the third way styling can
    // compile and do nothing — and the only one a per-class check cannot see, because
    // the answer is in the ANCESTORS. `@3xl:grid-cols-3` is valid Tailwind, emits real
    // CSS, and never matches, so the two-column layout the author was trying to fix
    // stays two columns at every width with nothing anywhere to explain it.
    //
    // Reported as a suggestion, matching the engine's own `warn` level: an orphaned
    // container query is inert rather than dangerous, and a section pasted before its
    // wrapper hits this legitimately for a moment.
    if (!visited.inContainer) {
      const orphaned = containerVariants(classes);
      if (orphaned.length > 0) {
        findings.push({
          origin: visited.origin,
          nodeId: visited.node.id ?? null,
          nodePath: visited.nodePath,
          rule: 'class-container-orphan',
          severity: 'suggestion',
          title: 'This responsive styling never takes effect',
          detail:
            'Styling that only applies at a certain width needs a wrapper marked as the thing ' +
            'being measured. Nothing above this is marked, so the rule never matches and the ' +
            'layout stays the same at every size. Add `@container` to a section or wrapper above ' +
            'it — the seeded sections, the nav and the footer already have one.',
          evidence: orphaned.join(' '),
        });
      }
    }

    for (const issue of checkClassString(classes)) {
      const wording = wordingFor(issue.reason);
      // Resolved ONCE: `adviceFor` has to say whether a button is coming, and the answer
      // is the same one the finding carries. Calling `fixFor` twice would let the words
      // and the button drift apart on the next edit to either.
      const offer = fixFor(issue, visited);
      findings.push({
        origin: visited.origin,
        nodeId: visited.node.id ?? null,
        nodePath: visited.nodePath,
        rule: wording.rule,
        severity: wording.severity,
        title: wording.title,
        detail: `${wording.lead} ${adviceFor(issue, Boolean(offer.fix))}`,
        evidence: issue.className,
        ...offer,
      });
    }
  }

  return findings;
}
