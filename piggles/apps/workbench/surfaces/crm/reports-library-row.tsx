'use client';

import { Badge, Button, Card, Text } from '@wizeworks/silicaui-react';
import { faCopy, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { VISUALIZATION_LABEL, type SavedReport } from './report-builder-data';
import { describe, type FieldLabel } from './reports-library-describe';
import { productCopy } from '../../lib/product';

export interface ReportRowActions {
  onOpen: (report: SavedReport, shiftKey: boolean) => void;
  onCopy: (report: SavedReport) => void;
  onRemove: (report: SavedReport) => Promise<void>;
}

interface ReportRowProps extends ReportRowActions {
  report: SavedReport;
  fieldLabel: FieldLabel;
}

/** Copy, and delete for the tenant's own reports; built-ins can only be copied. */
function RowButtons({ report, onCopy, onRemove }: Omit<ReportRowProps, 'fieldLabel' | 'onOpen'>) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label={`Make a copy of ${report.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onCopy(report);
        }}
      >
        <Icon glyph={faCopy} className="size-4" aria-hidden />
      </Button>
      {report.builtinSlug ? null : (
        <Button
          color="danger"
          variant="ghost"
          size="sm"
          aria-label={`Delete ${report.name}`}
          onClick={(event) => {
            event.stopPropagation();
            void onRemove(report);
          }}
        >
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

/** One saved report: what it is called, what it answers, and its actions. */
export function ReportRow({ report, fieldLabel, onOpen, onCopy, onRemove }: ReportRowProps) {
  return (
    <Card
      className="flex cursor-pointer items-start justify-between gap-4 p-4"
      // Opens from the keyboard like every list row (sparx persona issue 246);
      // Enter on the copy or delete button stays with that button.
      tabIndex={0}
      role="button"
      onClick={(event) => onOpen(report, event.shiftKey)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(report, event.shiftKey);
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong>{report.name}</strong>
          {report.builtinSlug ? (
            <Badge color="info" variant="soft">
              {productCopy('crm.report.builtIn', 'Ships with sparx')}
            </Badge>
          ) : null}
          <Badge color="neutral" variant="soft">
            {VISUALIZATION_LABEL[report.visualization]}
          </Badge>
        </div>
        {report.description ? <Text>{report.description}</Text> : null}
        <Text>{describe(report, fieldLabel)}</Text>
      </div>
      <RowButtons report={report} onCopy={onCopy} onRemove={onRemove} />
    </Card>
  );
}
