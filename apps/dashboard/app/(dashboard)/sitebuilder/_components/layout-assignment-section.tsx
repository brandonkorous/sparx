// LayoutAssignmentSection (server, docs/36 §6, P-C). The SB-owned card the
// Commerce product editor + CMS entry editor mount to assign a storefront layout
// to one record. It encapsulates the Site-Builder API reads + the picker so the
// consuming module needs only (targetId, itemRef) — keeping the assignment logic
// on the Site-Builder side of the boundary (docs/02). Renders nothing when Site
// Builder is inactive or the read fails, so the host editor is unaffected.

import { Card, CardContent, CardHeader, Heading, Text } from '@sparx/ui';
import { getLayoutResolution, listPageLayouts } from '../_lib/api';
import { LayoutAssignmentPicker } from './layout-assignment-picker';

export interface LayoutAssignmentSectionProps {
  targetId: string;
  /** The record's stable id (product / collection / content-entry id). */
  itemRef: string;
  title?: string;
  description?: string;
  /** Optional muted helper text under the picker (e.g. the CMS write-only note). */
  note?: string;
}

export async function LayoutAssignmentSection({
  targetId,
  itemRef,
  title = 'Storefront layout',
  description = 'Which layout this renders through on the storefront.',
  note,
}: LayoutAssignmentSectionProps) {
  try {
    const [layouts, resolution] = await Promise.all([
      listPageLayouts(targetId),
      getLayoutResolution(targetId, itemRef),
    ]);
    return (
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>{title}</Heading>
          <Text variant="muted" size="sm">
            {description}
          </Text>
        </CardHeader>
        <CardContent>
          <LayoutAssignmentPicker
            targetId={targetId}
            itemRef={itemRef}
            layouts={layouts.map((l) => ({ id: l.id, name: l.name }))}
            assignedLayoutId={resolution.assignedLayoutId}
            note={note}
          />
        </CardContent>
      </Card>
    );
  } catch {
    // Site Builder inactive / unavailable — no layout picker for this tenant.
    return null;
  }
}
