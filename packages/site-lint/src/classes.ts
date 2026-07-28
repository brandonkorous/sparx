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

import { checkClassString, type VocabularyIssue } from '@sparx/silica-catalog';

import type { DocumentInventory } from './walk';
import type { RawFinding } from './finding';
import type { LintRuleId, LintSeverity } from './types';

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
      });
    }
  }

  return findings;
}
