'use client';

// One photo: what it is, where it sits, and when a shopper is shown it. Fully controlled: the draft
// lives in the tab above, which registers the save with the pane toolbar while this panel comes and goes.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  RadioGroup,
  RadioOption,
  Text,
} from '@wizeworks/silicaui-react';
import {
  faChevronLeft,
  faChevronRight,
  faStar,
  faTrashCan,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { PhotoPinning } from './product-media-pinning';
import type { Binding, ShowMode } from './product-media-binding';
import type { MediaAsset, ProductImage, ProductOption, Variant } from './products-data';

type SetDraft = (update: (current: Binding) => Binding) => void;

/** One step through the gallery order: `later` moves the photo one place on, otherwise one back. */
function MoveButton(props: {
  later: boolean;
  disabled: boolean;
  loading: boolean;
  onMove: (delta: number) => void;
}) {
  const { later } = props;
  return (
    <Button
      size="sm"
      variant="ghost"
      color="neutral"
      shape="square"
      aria-label={later ? 'Move this photo later' : 'Move this photo earlier'}
      title={later ? 'Move later' : 'Move earlier'}
      disabled={props.disabled}
      loading={props.loading}
      onClick={() => {
        props.onMove(later ? 1 : -1);
      }}
    >
      <Icon glyph={later ? faChevronRight : faChevronLeft} className="size-4" aria-hidden />
    </Button>
  );
}

function PhotoToolbar(props: {
  image: ProductImage;
  asset: MediaAsset | null;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  busy: { reorder: boolean; primary: boolean };
  onMove: (delta: number) => void;
  onSetPrimary: () => void;
}) {
  const { image, asset, busy } = props;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Text className="min-w-0 flex-1 basis-48 truncate text-sm">
        {asset?.filename ?? 'Photo'}
        {asset?.width && asset.height ? ` · ${String(asset.width)} × ${String(asset.height)}` : ''}
      </Text>
      <div className="flex items-center gap-1">
        <MoveButton
          later={false}
          disabled={!props.canMoveEarlier}
          loading={busy.reorder}
          onMove={props.onMove}
        />
        <MoveButton
          later
          disabled={!props.canMoveLater}
          loading={busy.reorder}
          onMove={props.onMove}
        />
        <Button
          size="sm"
          variant="outline"
          color={image.isPrimary ? 'neutral' : 'module'}
          disabled={image.isPrimary}
          loading={busy.primary}
          onClick={props.onSetPrimary}
        >
          <Icon glyph={faStar} className="size-4" aria-hidden />
          {image.isPrimary ? 'Main photo' : 'Make it the main photo'}
        </Button>
      </div>
    </div>
  );
}

function AltField({
  draft,
  asset,
  setDraft,
}: {
  draft: Binding;
  asset: MediaAsset | null;
  setDraft: SetDraft;
}) {
  return (
    <Field>
      <FieldLabel>Description for screen readers</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={draft.alt}
            placeholder={asset?.altText ?? 'A navy canvas backpack, seen from the front'}
            onChange={(event) => {
              setDraft((current) => ({ ...current, alt: event.target.value }));
            }}
          />
        }
      />
      <FieldDescription>
        Read aloud to shoppers who cannot see the picture, and shown if it fails to load. Describe
        what is in it, not that it is a photo.
      </FieldDescription>
    </Field>
  );
}

function ShowModeField({
  draft,
  variants,
  options,
  setDraft,
}: {
  draft: Binding;
  variants: Variant[];
  options: ProductOption[];
  setDraft: SetDraft;
}) {
  const hasOptions = options.length > 0;
  const firstOptionName = options[0]?.name ?? 'choice';
  const firstValueName = options[0]?.values[0]?.value ?? '';
  return (
    <Field>
      <FieldLabel>When this photo shows</FieldLabel>
      <FieldControl
        render={
          <RadioGroup
            color="module"
            value={draft.mode}
            onValueChange={(next) => {
              setDraft((current) => ({ ...current, mode: next as ShowMode }));
            }}
          >
            <RadioOption value="always">Always: whatever the shopper picks</RadioOption>
            <RadioOption value="variant" disabled={variants.length === 0}>
              Only on one particular version
            </RadioOption>
            <RadioOption value="choices" disabled={!hasOptions}>
              Whenever a certain choice is picked
            </RadioOption>
          </RadioGroup>
        }
      />
      {/* Named with THIS product's own option and one of its real values, so the reader
          does not have to map a generic example onto their own catalog. */}
      <FieldDescription>
        {hasOptions
          ? `Use the last one to show this photo whenever someone picks a particular ${firstOptionName.toLowerCase()}${firstValueName ? ` (${firstValueName}, say)` : ''}, without tying it to one version.`
          : 'This product has no size or color choices yet, so every photo shows for everyone. Add choices on the Options tab to pin a photo to one of them.'}
      </FieldDescription>
    </Field>
  );
}

interface ImageDetailsProps {
  image: ProductImage;
  index: number;
  total: number;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  asset: MediaAsset | null;
  variants: Variant[];
  options: ProductOption[];
  draft: Binding;
  busy: { reorder: boolean; primary: boolean; remove: boolean };
  onDraftChange: (next: Binding) => void;
  onMove: (delta: number) => void;
  onSetPrimary: () => void;
  onRemove: () => void;
}

export function ImageDetails(props: ImageDetailsProps) {
  const { image, asset, variants, options, draft, busy, onDraftChange } = props;
  const setDraft: SetDraft = (update) => {
    onDraftChange(update(draft));
  };

  return (
    <FormSection
      title="This photo"
      description={`Number ${String(props.index + 1)} of ${String(props.total)} in the gallery.`}
    >
      <PhotoToolbar
        image={image}
        asset={asset}
        canMoveEarlier={props.canMoveEarlier}
        canMoveLater={props.canMoveLater}
        busy={busy}
        onMove={props.onMove}
        onSetPrimary={props.onSetPrimary}
      />
      <AltField draft={draft} asset={asset} setDraft={setDraft} />
      <ShowModeField draft={draft} variants={variants} options={options} setDraft={setDraft} />
      <PhotoPinning draft={draft} variants={variants} options={options} setDraft={setDraft} />
      {/* Rare and one-way, so it sits after the work, under a divider, as a
          plain row, never a card competing with the settings above it. */}
      <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Text className="text-sm">
          Taking this photo off the product leaves the file in your media library.
        </Text>
        <Button
          size="sm"
          variant="outline"
          color="danger"
          loading={busy.remove}
          onClick={props.onRemove}
        >
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          Take it off
        </Button>
      </div>
    </FormSection>
  );
}
