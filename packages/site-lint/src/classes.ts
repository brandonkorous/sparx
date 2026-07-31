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
        ? 'A styling value written by hand like this is not part of the site stylesheet, so it is ' +
          'ignored completely — on the canvas and on the live page.'
        : 'This styling names a size that the site stylesheet does not contain, so it is ignored ' +
          'completely — on the canvas and on the live page.',
  };
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
 * The catalog's `hint` is appended verbatim rather than paraphrased: it names the
 * concrete legal value to write instead (`gap-6` for a rejected `gap-7`, the exact
 * container variant for a viewport one), and that string is derived from the declared
 * vocabulary. Rewriting it here would mean maintaining a second, quietly diverging
 * answer to "what should I have written".
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
      findings.push({
        origin: visited.origin,
        nodeId: visited.node.id ?? null,
        nodePath: visited.nodePath,
        rule: wording.rule,
        severity: wording.severity,
        title: wording.title,
        detail: `${wording.lead} ${issue.hint}`,
        evidence: issue.className,
        ...fixFor(issue, visited),
      });
    }
  }

  return findings;
}
