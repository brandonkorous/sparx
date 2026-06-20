import { Badge } from '@sparx/ui';

import type { BookingStatus } from '../_lib/types';
import { STATUS_LABEL, statusColor } from '../_lib/format';

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge color={statusColor(status)} variant="soft">
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
