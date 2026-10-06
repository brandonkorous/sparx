'use client';

// How many of the required pages are ready: the toolbar badge and the banner
// above the checklist. Split from legal-list.tsx under RULE #0.5.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
} from '@wizeworks/silicaui-react';
import { guessingLine } from './legal-guessing-words';
import type { ChecklistItem, LegalChecklist } from './legal-data';

type Completeness = LegalChecklist['completeness'];

function allRequiredReady(completeness: Completeness): boolean {
  return (
    completeness.requiredTotal > 0 && completeness.requiredComplete === completeness.requiredTotal
  );
}

export function LegalReadinessBadge({ completeness }: { completeness: Completeness }) {
  const ready = allRequiredReady(completeness);
  return (
    <Badge
      color={ready ? 'success' : 'info'}
      variant="soft"
      size="sm"
      className="whitespace-nowrap"
    >
      {ready
        ? 'All required pages ready'
        : `${completeness.requiredComplete} of ${completeness.requiredTotal} required ready`}
    </Badge>
  );
}

/** Guessed sentences are counted separately for required and optional pages,
 *  because the banner's subject is the required ones (legal-guessing-words.ts). */
export function LegalReadinessAlert({
  completeness,
  items,
}: {
  completeness: Completeness;
  items: ChecklistItem[];
}) {
  const ready = allRequiredReady(completeness);
  const guessing = (required: boolean) =>
    items.filter((item) => item.required === required && (item.stillGuessing ?? []).length > 0)
      .length;
  const counts = { required: guessing(true), optional: guessing(false) };
  const line = guessingLine(counts);
  return (
    <Alert color={ready && line === null ? 'success' : 'info'} variant="soft">
      <AlertContent>
        <AlertTitle>
          {ready
            ? 'Your required pages are all set'
            : `${completeness.requiredComplete} of ${completeness.requiredTotal} required pages ready`}
        </AlertTitle>
        <AlertDescription>
          {ready
            ? 'Every page you are expected to have is published, up to date, and linked in your footer.'
            : 'A page counts as ready once it is published, built on the latest starter wording, and linked in your footer.'}
          {/* "Ready" counts publishing, not reading, so say what is still ours (issue 375). */}
          {line === null ? '' : ` ${line}`}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
