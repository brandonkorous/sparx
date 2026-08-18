'use client';

// What the check found, grouped by how much it matters.
//
// ADVISORY, and the pane says so out loud. Nothing here stops a publish, because a
// check that can stop you shipping is a check people learn to route around — and the
// author knows things about their own site that a rule never will.
//
// Findings are grouped by SEVERITY rather than by page. A broken link in the footer
// and a broken link on the About page are one job, and listing them per page makes
// one mistake look like four.

import { Alert, Badge, Button } from '@wizeworks/silicaui-react';
import type { CheckFinding, CheckSeverity, SiteCheckReport } from '../../lib/studio/site-data';

const BANDS: { severity: CheckSeverity; title: string; tone: 'error' | 'warning' | 'info' }[] = [
  { severity: 'error', title: 'Visitors will see this go wrong', tone: 'error' },
  { severity: 'warning', title: 'Worth a look before you publish', tone: 'warning' },
  { severity: 'suggestion', title: 'Could be better', tone: 'info' },
];

/** Where a finding is, in the author's words — "the footer", not "frame:null". */
function whereOf(finding: CheckFinding): string {
  const { location } = finding;
  if (location.scope === 'frame') return 'Your header and footer';
  if (location.scope === 'site') return 'Your site';
  if (location.seenOn.length > 1) {
    return `${location.ownerName} — seen on ${String(location.seenOn.length)} pages`;
  }
  return location.ownerName;
}

export function PublishChecks({
  report,
  running,
  onRun,
}: {
  report: SiteCheckReport | null;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <section className="bg-base-100 rounded-lg p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-base-content text-base font-medium">Before you publish</h3>
        <Button
          size="sm"
          color="primary"
          variant="soft"
          className="ml-auto"
          disabled={running}
          onClick={onRun}
        >
          {running ? 'Checking…' : report ? 'Check again' : 'Check my site'}
        </Button>
      </div>

      {report ? (
        <CheckReport report={report} />
      ) : (
        <p className="text-base-content text-sm">
          A quick look for the things visitors notice — links that go nowhere, pictures with no
          description, words that are hard to read. It never stops you publishing.
        </p>
      )}
    </section>
  );
}

function CheckReport({ report }: { report: SiteCheckReport }) {
  const clean = report.findings.length === 0;
  return (
    <div className="flex flex-col gap-3">
      <Alert color={clean ? 'success' : 'info'} variant="soft">
        {clean
          ? `Nothing to fix across ${String(report.pagesChecked)} pages. It reads well.`
          : `${String(report.findings.length)} things to look at across ${String(report.pagesChecked)} pages. None of them stops you publishing.`}
      </Alert>

      {BANDS.map((band) => {
        const found = report.findings.filter((finding) => finding.severity === band.severity);
        if (!found.length) return null;
        return <Band key={band.severity} title={band.title} tone={band.tone} findings={found} />;
      })}
    </div>
  );
}

function Band({
  title,
  tone,
  findings,
}: {
  title: string;
  tone: 'error' | 'warning' | 'info';
  findings: CheckFinding[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-base-content text-sm font-medium">{title}</p>
      <ul className="flex flex-col gap-2">
        {findings.map((finding, index) => (
          <li key={`${finding.rule}-${index}`} className="border-base-300 rounded border p-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <Badge color={tone} variant="soft">
                {whereOf(finding)}
              </Badge>
              <span className="text-base-content font-medium">{finding.title}</span>
            </div>
            <p className="text-base-content mt-1 text-sm">{finding.detail}</p>
            {finding.evidence ? (
              <p className="text-base-content mt-1 font-mono text-sm break-all">
                {finding.evidence}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
