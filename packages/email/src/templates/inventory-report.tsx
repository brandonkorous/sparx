import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAlert,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailLead,
  EmailLineItems,
  EmailSectionLabel,
  type SummaryRow,
} from '../components';

// A scheduled inventory report (docs/146 Phase 10.4).
//
// ── What this email is FOR ───────────────────────────────────────────────────
//
// The reports it carries are good and nobody opens them, because opening them
// means remembering to log in on a Monday. So the report comes to the person
// instead. That makes the body's job specific: the three or four numbers have to
// be readable in the notification preview, before anybody decides whether to
// open anything.
//
// So the figures are the email. The spreadsheet is an attachment for whoever
// wants to work in one, and the link is for whoever wants to look at the screen.
//
// ── Gaps are rendered as gaps ────────────────────────────────────────────────
//
// A line marked `isGap` is something the report could NOT measure — units nobody
// costed, order lines with no history, a rate that fell back to the category
// default. Those are set apart in their own band rather than listed among the
// statistics, because a number that is missing and a number that is small look
// identical in a column and mean opposite things.

export interface InventoryReportLine {
  label: string;
  /** Already formatted by the report — it knows how its own figure should read. */
  value: string;
  /** True when this line reports something that could not be measured. */
  isGap?: boolean;
}

export interface InventoryReportEmailProps {
  /** The business this is about, as the owner named it. */
  businessName: string;
  /** What the owner called the schedule, e.g. "Monday morning stock check". */
  scheduleName: string;
  /** The report's own name, e.g. "Stock that is not paying its rent". */
  reportLabel: string;
  /** One sentence: what question the report answers. */
  reportDescription?: string;
  /** e.g. "1 – 31 March 2027". Omitted for a report about right now. */
  periodLabel?: string;
  /** The headline figures. */
  lines: InventoryReportLine[];
  /** Rows in the attached spreadsheet. Null when there is no attachment. */
  rowCount?: number | null;
  /** The attached file's name, when one is attached. */
  attachmentName?: string | null;
  /** Set when the report was too large to attach, so the body says so instead of
   *  leaving somebody hunting for a file that is not there. */
  attachmentTooLarge?: boolean;
  /** Absolute link to the report in the workbench. */
  reportUrl: string;
}

export function inventoryReportSubject(scheduleName: string, periodLabel?: string): string {
  return periodLabel ? `${scheduleName} — ${periodLabel}` : scheduleName;
}

export function InventoryReportEmail({
  businessName,
  scheduleName,
  reportLabel,
  reportDescription,
  periodLabel,
  lines,
  rowCount,
  attachmentName,
  attachmentTooLarge,
  reportUrl,
}: InventoryReportEmailProps) {
  const figures = lines.filter((line) => !line.isGap);
  const gaps = lines.filter((line) => line.isGap);

  const summary: SummaryRow[] = figures.map((line) => ({ label: line.label, value: line.value }));

  return (
    <PlatformEmailLayout
      preview={`${reportLabel}${periodLabel ? ` — ${periodLabel}` : ''}`}
      {...(periodLabel ? { mastheadRight: periodLabel } : {})}
      footerReason={`Someone at ${businessName} set up "${scheduleName}". Change or stop it in your stock reports.`}
    >
      <EmailDisplayHeading>{reportLabel}</EmailDisplayHeading>
      <EmailLead>
        {reportDescription ?? `Your ${scheduleName.toLowerCase()} for ${businessName}.`}
      </EmailLead>

      {periodLabel ? <EmailSectionLabel>{periodLabel}</EmailSectionLabel> : null}

      {/* The figures ARE the email. `EmailLineItems` with only a summary renders
          the label/value pairs as a clean two-column block, which is exactly the
          shape a set of headline numbers wants. */}
      <EmailLineItems items={[]} summary={summary} />

      {gaps.length > 0 ? (
        <EmailAlert tone="warn" title="What these figures could not include">
          {gaps.map((gap) => (
            <React.Fragment key={gap.label}>
              {gap.label}: {gap.value}
              <br />
            </React.Fragment>
          ))}
        </EmailAlert>
      ) : null}

      <EmailActionButton href={reportUrl}>Open the full report</EmailActionButton>

      {attachmentTooLarge === true ? (
        <EmailFinePrint>
          This report was too large to attach. Open it above to download the whole spreadsheet.
        </EmailFinePrint>
      ) : attachmentName ? (
        <EmailFinePrint>
          {attachmentName} is attached
          {typeof rowCount === 'number' ? `, with ${rowCount.toLocaleString('en-US')} rows` : ''}.
        </EmailFinePrint>
      ) : null}
    </PlatformEmailLayout>
  );
}

export default InventoryReportEmail;
