import { Badge } from '@wizeworks/silicaui-react';
import { Text } from '../primitives';

/**
 * The screen this whole page is promising, shown rather than described.
 *
 * Every hero on this site puts a real product moment beside the headline — the
 * CRM page shows a customer record, commerce shows an order. For a migration the
 * product moment is not the import; it is the REPORT BEFORE the import. "You
 * find out first, and the button is last" is the entire argument, and a picture
 * of a validation report makes it in one glance where the copy needs a paragraph.
 *
 * It is deliberately not a screenshot: a PNG goes stale the day the surface
 * changes, cannot re-theme, and cannot say the vendor's own file name. This is
 * built from the same tokens and the same vocabulary the workbench uses, and the
 * file name is passed in from the adapter registry — so it stays true for the
 * same reason everything else on these pages does.
 *
 * The numbers are illustrative and read as such (a small catalogue, one bad
 * row). They are not presented as anybody's real data.
 */
export function ReportGlimpse({
  vendorName,
  fileName,
  /** What this vendor's FIRST export actually is — 'Products' for a shop,
   *  'Contacts' for a CRM, 'Subscribers' for an email tool. Hardcoding
   *  "products" here told six of the twenty vendors that their contacts file was
   *  a products export. */
  label,
}: {
  vendorName: string;
  fileName: string;
  label: string;
}) {
  const noun = label.toLowerCase();
  return (
    <div
      // `data-theme="light"` because this sits inside the dark hero island: the
      // thing being shown is a bright product surface, and re-resolving the
      // tokens is what lets it look like the app instead of like a dark card.
      data-theme="light"
      className="bg-base-100 border-base-content/10 w-full max-w-[460px] rounded-2xl border p-5 shadow-none"
      aria-label={`What sparx shows you after reading a ${vendorName} ${noun} export, before anything is saved`}
    >
      <div className="flex items-center justify-between gap-3">
        <Text size={16} weight={600} mono>
          {fileName}
        </Text>
        <Badge color="neutral" variant="outline" size="sm">
          read locally
        </Badge>
      </div>

      <div className="bg-success/10 mt-4 rounded-lg p-3">
        <Text size={14} weight={600} className="text-success">
          This is a {vendorName} {noun} export
        </Text>
        <Text size={14}>We can tell from the columns and the file name.</Text>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Text size={16} weight={600}>
          {label}
        </Text>
        <Badge color="warning" variant="soft" size="sm">
          128 of 129 ready
        </Badge>
      </div>
      <Text size={14} className="mt-1">
        128 {noun} ready — 1 row will be skipped.
      </Text>

      <div className="border-base-content/10 mt-3 flex items-start gap-3 rounded-lg border p-3">
        <Badge color="danger" variant="soft" size="sm">
          Must fix
        </Badge>
        <Text size={14}>Row 84: this record has no name.</Text>
      </div>

      <div className="border-base-content/10 mt-4 flex items-center gap-2 border-t pt-4">
        <Text size={14} weight={600}>
          Nothing has been saved yet.
        </Text>
      </div>
    </div>
  );
}
