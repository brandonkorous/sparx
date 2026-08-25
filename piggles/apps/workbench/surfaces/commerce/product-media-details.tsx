'use client';

// One photo: what it is, where it sits, and when a shopper is shown it.
//
// Fully controlled. The draft lives in the tab above, because the tab is what
// registers the save with the pane toolbar and this panel comes and goes with
// the selection.

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

export function ImageDetails({
  image,
  index,
  total,
  canMoveEarlier,
  canMoveLater,
  asset,
  variants,
  options,
  draft,
  busy,
  onDraftChange,
  onMove,
  onSetPrimary,
  onRemove,
}: {
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
}) {
  const setDraft = (update: (current: Binding) => Binding) => {
    onDraftChange(update(draft));
  };

  const hasOptions = options.length > 0;
  const firstOptionName = options[0]?.name ?? 'choice';
  const firstValueName = options[0]?.values[0]?.value ?? '';

  return (
    <FormSection
      title="This photo"
      description={`Number ${String(index + 1)} of ${String(total)} in the gallery.`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Text className="min-w-0 flex-1 truncate text-sm">
          {asset?.filename ?? 'Photo'}
          {asset?.width && asset.height
            ? ` · ${String(asset.width)} × ${String(asset.height)}`
            : ''}
        </Text>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            color="neutral"
            shape="square"
            aria-label="Move this photo earlier"
            title="Move earlier"
            disabled={!canMoveEarlier}
            loading={busy.reorder}
            onClick={() => {
              onMove(-1);
            }}
          >
            <Icon glyph={faChevronLeft} className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="neutral"
            shape="square"
            aria-label="Move this photo later"
            title="Move later"
            disabled={!canMoveLater}
            loading={busy.reorder}
            onClick={() => {
              onMove(1);
            }}
          >
            <Icon glyph={faChevronRight} className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="outline"
            color={image.isPrimary ? 'neutral' : 'module'}
            disabled={image.isPrimary}
            loading={busy.primary}
            onClick={onSetPrimary}
          >
            <Icon glyph={faStar} className="size-4" aria-hidden />
            {image.isPrimary ? 'Main photo' : 'Make it the main photo'}
          </Button>
        </div>
      </div>

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
              <RadioOption value="always">Always — whatever the shopper picks</RadioOption>
              <RadioOption value="variant" disabled={variants.length === 0}>
                Only on one particular version
              </RadioOption>
              <RadioOption value="choices" disabled={!hasOptions}>
                Whenever a certain choice is picked
              </RadioOption>
            </RadioGroup>
          }
        />
        {/* Named with THIS product's own option and one of its real values.
            Generic guidance ("show the red photos when someone picks red") asks
            the reader to map an example onto their own catalogue; naming Cobalt
            on a mug that comes in Cobalt does not. */}
        <FieldDescription>
          {hasOptions
            ? `Use the last one to show this photo whenever someone picks a particular ${firstOptionName.toLowerCase()}${firstValueName ? ` — ${firstValueName}, say` : ''}, without tying it to one version.`
            : 'This product has no size or color choices yet, so every photo shows for everyone. Add choices on the Options tab to pin a photo to one of them.'}
        </FieldDescription>
      </Field>

      <PhotoPinning draft={draft} variants={variants} options={options} setDraft={setDraft} />
      {/* Rare and one-way, so it sits after the work, under a divider, as a
          plain row — never a card competing with the settings above it. */}
      <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Text className="text-sm">
          Taking this photo off the product leaves the file in your media library.
        </Text>
        <Button size="sm" variant="outline" color="danger" loading={busy.remove} onClick={onRemove}>
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          Take it off
        </Button>
      </div>
    </FormSection>
  );
}
