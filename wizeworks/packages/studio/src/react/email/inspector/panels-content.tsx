'use client';

// The content kinds — the blocks that carry what the email actually says.

import type {
  ButtonNode,
  DividerNode,
  HtmlNode,
  ImageNode,
  SocialNode,
  SpacerNode,
  TextNode,
  VideoNode,
} from '@wizeworks/silicaui-builder/email';
import {
  ALIGN_OPTIONS,
  AreaRow,
  ColorRow,
  Group,
  NumberRow,
  PictureRow,
  SelectRow,
  SwitchRow,
  TextRow,
  WEIGHT_OPTIONS,
  usePatch,
} from './fields';
import { SocialLinks } from './social-links';

const MERGE_HINT = 'Type {{customer.firstName ?? "there"}} to greet someone by name.';

export function TextPanel({ node }: { node: TextNode }) {
  const patch = usePatch(node.id);
  return (
    <>
      <Group title="Words">
        <AreaRow
          label="Copy"
          value={node.html}
          rows={6}
          hint={MERGE_HINT}
          onCommit={(html) => patch('Edit copy', { html })}
        />
      </Group>
      <Group title="Look">
        <ColorRow
          label="Colour"
          value={node.color}
          onCommit={(color) => patch('Change colour', { color, colorAuto: false })}
        />
        <NumberRow
          label="Size"
          value={node.fontSize}
          min={10}
          max={72}
          onCommit={(fontSize) => patch('Change size', { fontSize })}
        />
        <SelectRow
          label="Weight"
          value={node.fontWeight}
          options={WEIGHT_OPTIONS}
          onCommit={(fontWeight) => patch('Change weight', { fontWeight })}
        />
        <NumberRow
          label="Line spacing"
          value={node.lineHeight}
          min={10}
          max={120}
          hint="In pixels — around 1.5× the size reads comfortably."
          onCommit={(lineHeight) => patch('Change line spacing', { lineHeight })}
        />
        <SelectRow
          label="Line things up"
          value={node.align}
          options={ALIGN_OPTIONS}
          onCommit={(align) => patch('Change alignment', { align })}
        />
        <ColorRow
          label="Link colour"
          value={node.linkColor ?? node.color}
          hint="Links inside this copy."
          onCommit={(linkColor) => patch('Change link colour', { linkColor, linkColorAuto: false })}
        />
      </Group>
    </>
  );
}

export function ButtonPanel({ node }: { node: ButtonNode }) {
  const patch = usePatch(node.id);
  const outline = node.variant === 'outline';
  return (
    <>
      <Group title="The button">
        <TextRow
          label="Words on it"
          value={node.label}
          onCommit={(label) => patch('Change button words', { label })}
        />
        <TextRow
          label="Web address"
          value={node.href}
          placeholder="https://"
          onCommit={(href) => patch('Change destination', { href })}
        />
        <SelectRow
          label="Style"
          value={node.variant ?? 'filled'}
          options={
            [
              { value: 'filled', label: 'Filled' },
              { value: 'outline', label: 'Outlined' },
            ] as const
          }
          onCommit={(variant) => patch('Change button style', { variant })}
        />
      </Group>
      <Group title="Look">
        {outline ? null : (
          <ColorRow
            label="Background"
            value={node.bg}
            onCommit={(bg) => patch('Change button colour', { bg, bgAuto: false })}
          />
        )}
        <ColorRow
          label="Words"
          value={node.color}
          onCommit={(color) => patch('Change button words colour', { color, colorAuto: false })}
        />
        <ColorRow
          label="Border"
          value={node.borderColor ?? node.bg}
          onCommit={(borderColor) =>
            patch('Change button border', { borderColor, borderColorAuto: false })
          }
        />
        <NumberRow
          label="Border thickness"
          value={node.borderWidth ?? (outline ? 1 : 0)}
          max={8}
          onCommit={(borderWidth) =>
            patch('Change button border', { borderWidth: borderWidth || undefined })
          }
        />
        <NumberRow
          label="Rounded corners"
          value={node.radius}
          max={64}
          onCommit={(radius) => patch('Change button corners', { radius })}
        />
        <NumberRow
          label="Space inside, left and right"
          value={node.paddingX}
          onCommit={(paddingX) => patch('Change button spacing', { paddingX })}
        />
        <NumberRow
          label="Space inside, top and bottom"
          value={node.paddingY}
          onCommit={(paddingY) => patch('Change button spacing', { paddingY })}
        />
        <SelectRow
          label="Position"
          value={node.align}
          options={ALIGN_OPTIONS}
          onCommit={(align) => patch('Change button position', { align })}
        />
      </Group>
    </>
  );
}

export function ImagePanel({ node }: { node: ImageNode }) {
  const patch = usePatch(node.id);
  return (
    <Group title="Picture">
      <PictureRow
        label="Picture"
        value={node.src}
        onCommit={(src) => patch('Change picture', { src })}
      />
      <TextRow
        label="Description"
        value={node.alt}
        hint="Read aloud, and shown when pictures are switched off. Say what it shows."
        onCommit={(alt) => patch('Change description', { alt })}
      />
      <TextRow
        label="Links to"
        value={node.href ?? ''}
        placeholder="https://"
        onCommit={(href) => patch('Change destination', { href: href || undefined })}
      />
      <NumberRow
        label="Width"
        value={node.width}
        min={16}
        max={800}
        onCommit={(width) => patch('Change picture width', { width })}
      />
      <SelectRow
        label="Position"
        value={node.align}
        options={ALIGN_OPTIONS}
        onCommit={(align) => patch('Change picture position', { align })}
      />
    </Group>
  );
}

export function VideoPanel({ node }: { node: VideoNode }) {
  const patch = usePatch(node.id);
  return (
    <Group title="Video">
      <TextRow
        label="Video address"
        value={node.href}
        placeholder="https://"
        hint="Inboxes cannot play a video, so this shows a picture that opens it."
        onCommit={(href) => patch('Change video', { href })}
      />
      <PictureRow
        label="Picture to show"
        value={node.thumbnail}
        onCommit={(thumbnail) => patch('Change video picture', { thumbnail })}
      />
      <NumberRow
        label="Width"
        value={node.width}
        min={16}
        max={800}
        onCommit={(width) => patch('Change video width', { width })}
      />
      <SelectRow
        label="Position"
        value={node.align}
        options={ALIGN_OPTIONS}
        onCommit={(align) => patch('Change video position', { align })}
      />
      <SwitchRow
        label="Show a play symbol"
        checked={node.showPlayButton}
        onCommit={(showPlayButton) => patch('Change play symbol', { showPlayButton })}
      />
    </Group>
  );
}

export function DividerPanel({ node }: { node: DividerNode }) {
  const patch = usePatch(node.id);
  return (
    <Group title="Line">
      <ColorRow
        label="Colour"
        value={node.color}
        onCommit={(color) => patch('Change line colour', { color, colorAuto: false })}
      />
      <NumberRow
        label="Thickness"
        value={node.thickness}
        min={1}
        max={16}
        onCommit={(thickness) => patch('Change line thickness', { thickness })}
      />
    </Group>
  );
}

export function SpacerPanel({ node }: { node: SpacerNode }) {
  const patch = usePatch(node.id);
  return (
    <Group title="Space">
      <NumberRow
        label="Height"
        value={node.height}
        min={1}
        max={200}
        onCommit={(height) => patch('Change space', { height })}
      />
    </Group>
  );
}

export function SocialPanel({ node }: { node: SocialNode }) {
  const patch = usePatch(node.id);
  return (
    <>
      <Group title="Where to find you">
        <SocialLinks node={node} />
      </Group>
      <Group title="Look">
        <NumberRow
          label="Size"
          value={node.iconSize}
          min={12}
          max={64}
          onCommit={(iconSize) => patch('Change social size', { iconSize })}
        />
        <NumberRow
          label="Gap between"
          value={node.gap}
          max={48}
          onCommit={(gap) => patch('Change social gap', { gap })}
        />
        <SelectRow
          label="Position"
          value={node.align}
          options={ALIGN_OPTIONS}
          onCommit={(align) => patch('Change social position', { align })}
        />
      </Group>
    </>
  );
}

export function HtmlPanel({ node }: { node: HtmlNode }) {
  const patch = usePatch(node.id);
  return (
    <Group title="Custom code">
      <AreaRow
        label="HTML"
        value={node.html}
        rows={10}
        hint="Sent exactly as written. Nothing here is checked for you."
        onCommit={(html) => patch('Edit custom code', { html })}
      />
    </Group>
  );
}
