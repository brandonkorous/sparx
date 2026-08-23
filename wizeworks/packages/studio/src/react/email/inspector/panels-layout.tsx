'use client';

// The layout kinds: the email itself, a band, a column row, a column, a link group.
//
// These are the nodes that hold others, so what they carry is space and ground —
// where a block sits, what is behind it, how much room is around it.

import type {
  ColumnNode,
  ColumnsNode,
  EmailBody,
  LinkNode,
  SectionNode,
} from '@wizeworks/silicaui-builder/email';
import {
  ALIGN_OPTIONS,
  ColorRow,
  Group,
  NumberRow,
  PictureRow,
  SelectRow,
  SwitchRow,
  TextRow,
  usePatch,
} from './fields';

export function BodyPanel({ node }: { node: EmailBody }) {
  const patch = usePatch(node.id);
  return (
    <>
      <Group title="The email">
        <NumberRow
          label="Width"
          value={node.width}
          min={280}
          max={800}
          hint="600 is the width nearly every email uses. Wider than 640 gets cut off in some inboxes."
          onCommit={(width) => patch('Change width', { width })}
        />
        <TextRow
          label="Typeface"
          value={node.fontFamily}
          hint="Name a font people already have — an inbox cannot download one."
          onCommit={(fontFamily) => patch('Change typeface', { fontFamily })}
        />
      </Group>
      <Group title="Background">
        <ColorRow
          label="Behind the email"
          value={node.contentBg}
          onCommit={(contentBg) => patch('Change background', { contentBg, contentBgAuto: false })}
        />
        <ColorRow
          label="Around the email"
          value={node.bg}
          hint="Shows either side on a wide screen."
          onCommit={(bg) => patch('Change surround', { bg, bgAuto: false })}
        />
      </Group>
    </>
  );
}

export function SectionPanel({ node }: { node: SectionNode }) {
  const patch = usePatch(node.id);
  return (
    <>
      <Group title="Background">
        <ColorRow
          label="Color"
          value={node.bg}
          onCommit={(bg) => patch('Change band color', { bg, bgAuto: false })}
        />
        <PictureRow
          label="Picture behind"
          value={node.bgImage ?? ''}
          hint="Some inboxes ignore this, so the color above always shows underneath."
          onCommit={(value) => patch('Change band picture', { bgImage: value || undefined })}
        />
      </Group>
      <Group title="Spacing">
        <NumberRow
          label="Space inside, left and right"
          value={node.paddingX}
          onCommit={(paddingX) => patch('Change spacing', { paddingX })}
        />
        <NumberRow
          label="Space inside, top and bottom"
          value={node.paddingY}
          onCommit={(paddingY) => patch('Change spacing', { paddingY })}
        />
        <NumberRow
          label="Space outside, left and right"
          value={node.marginX ?? 0}
          onCommit={(marginX) => patch('Change spacing', { marginX: marginX || undefined })}
        />
        <NumberRow
          label="Space outside, top and bottom"
          value={node.marginY ?? 0}
          onCommit={(marginY) => patch('Change spacing', { marginY: marginY || undefined })}
        />
      </Group>
      <Group title="Shape">
        <SelectRow
          label="Line things up"
          value={node.align ?? 'center'}
          options={ALIGN_OPTIONS}
          onCommit={(align) => patch('Change alignment', { align })}
        />
        <NumberRow
          label="Rounded corners"
          value={node.radius ?? 0}
          max={64}
          hint="Older desktop inboxes draw square corners regardless. That is normal."
          onCommit={(radius) => patch('Change corners', { radius: radius || undefined })}
        />
        <NumberRow
          label="Border thickness"
          value={node.borderWidth ?? 0}
          max={16}
          onCommit={(borderWidth) =>
            patch('Change border', { borderWidth: borderWidth || undefined })
          }
        />
        {node.borderWidth ? (
          <ColorRow
            label="Border color"
            value={node.borderColor ?? node.bg}
            onCommit={(borderColor) =>
              patch('Change border color', { borderColor, borderColorAuto: false })
            }
          />
        ) : null}
      </Group>
    </>
  );
}

export function ColumnsPanel({ node }: { node: ColumnsNode }) {
  const patch = usePatch(node.id);
  return (
    <Group title="Columns">
      <SwitchRow
        label="Stack on a phone"
        checked={node.stackOnMobile}
        hint="On, these sit one above the other on a small screen instead of squeezing side by side."
        onCommit={(stackOnMobile) => patch('Change stacking', { stackOnMobile })}
      />
    </Group>
  );
}

export function ColumnPanel({ node }: { node: ColumnNode }) {
  const patch = usePatch(node.id);
  return (
    <Group title="This column">
      <NumberRow
        label="Share of the row (%)"
        value={node.widthPct}
        min={5}
        max={100}
        hint="The columns in one row should add up to 100."
        onCommit={(widthPct) => patch('Change column width', { widthPct })}
      />
    </Group>
  );
}

export function LinkPanel({ node }: { node: LinkNode }) {
  const patch = usePatch(node.id);
  return (
    <Group title="Where this goes">
      <TextRow
        label="Web address"
        value={node.href}
        placeholder="https://"
        hint="Everything grouped in here points at this address, unless it has one of its own."
        onCommit={(href) => patch('Change destination', { href })}
      />
    </Group>
  );
}
