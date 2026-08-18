'use client';

// The SEO tab — how this product reads to someone who has not found it yet.
//
// Three fields, and the whole design problem is that none of them mean anything
// on their own. "SEO title, 47/60 characters" tells an owner nothing about what
// they are about to publish. So this tab is built around two PREVIEWS — a search
// result and a shared link — and the fields sit under the thing they change.
//
// ── Empty is a real, correct state ───────────────────────────────────────
//
// All three fall back: an empty search title uses the product's name, an empty
// summary uses the start of its description, an empty picture uses the main
// photo. That is usually the right answer, so the previews render the FALLBACK
// and say where it came from, rather than showing a blank box that implies
// something is broken. Nobody should feel obliged to fill these in.
//
// ── Closing the ogImage gap ──────────────────────────────────────────────
//
// `ogImageId` has been on the product model the whole time and has never been
// editable in any interface — a merchant could not choose the picture that shows
// when their product is pasted into a chat or a post. It is editable here, and
// the choice is deliberately limited to photos already ON this product: a social
// card showing a picture that is not in the gallery is a bait-and-switch, and a
// full media-library picker would be a second, unrelated surface bolted onto a
// three-field form.

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import { faImageSlash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useActivePropertyId } from '../../lib/api/shell-data';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useDomains } from '../domains/data';
import { useTabSave } from './product-tab-save';
import {
  useMediaAssets,
  useProductMedia,
  useUpdateProduct,
  type Product,
  type ProductPatch,
} from './products-data';

/**
 * Where search results start cutting a title off, and where a summary stops
 * being read. Not hard limits — the server allows far more — so going past one
 * is a caution, never an error that blocks Save. Google truncates on pixel width
 * rather than character count, so these are the conventional approximations, and
 * the wording says "usually" for that reason.
 */
const TITLE_COMFORT = 60;
const DESCRIPTION_COMFORT = 155;

interface Draft {
  seoTitle: string;
  seoDescription: string;
  ogImageId: string | null;
}

function toDraft(product: Product): Draft {
  return {
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
    ogImageId: product.ogImageId,
  };
}

/** Only what moved, and `null` rather than `""` for a cleared field — an empty
 *  string would store "this product has a blank search title" instead of
 *  "it has none, so use its name". */
function buildPatch(draft: Draft, saved: Draft): ProductPatch {
  const patch: ProductPatch = {};
  if (draft.seoTitle !== saved.seoTitle) {
    patch.seoTitle = draft.seoTitle.trim() === '' ? null : draft.seoTitle.trim();
  }
  if (draft.seoDescription !== saved.seoDescription) {
    patch.seoDescription = draft.seoDescription.trim() === '' ? null : draft.seoDescription.trim();
  }
  if (draft.ogImageId !== saved.ogImageId) patch.ogImageId = draft.ogImageId;
  return patch;
}

/** The first sentence or so of the description, with any HTML stripped — what a
 *  search engine would show if no summary is written. */
function fromDescription(description: string | null): string {
  if (!description) return '';
  const plain = description
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= DESCRIPTION_COMFORT) return plain;
  return `${plain.slice(0, DESCRIPTION_COMFORT).trimEnd()}…`;
}

export function ProductSeoTab({ product }: { ctx: SurfaceContext; product: Product }) {
  const update = useUpdateProduct(product.id);

  const { data: domains } = useDomains();
  const propertyId = useActivePropertyId();

  const media = useProductMedia(product.id);
  const images = useMemo(() => media.data ?? [], [media.data]);
  const assetIds = useMemo(() => images.map((image) => image.mediaAssetId), [images]);
  const assetsQuery = useMediaAssets(assetIds);
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);

  const saved = useMemo(() => toDraft(product), [product]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  const patch = buildPatch(draft, saved);
  const dirty = Object.keys(patch).length > 0;

  // Save lives in the pane toolbar and acts on whichever tab is showing — see
  // product-tab-save.tsx. This tab renders no Save of its own, and lets the
  // mutation REJECT so the toolbar reports the server's own sentence rather
  // than this tab quietly swallowing it and letting the button claim success.
  useTabSave({
    dirty,
    saving: update.isPending,
    save: async () => {
      // Safe when nothing has changed: the toolbar disables its button, but a
      // keyboard shortcut can still reach this, and an empty PATCH is a
      // pointless round trip.
      if (!dirty) return;
      const next = await update.mutateAsync(patch);
      setTouched(false);
      setDraft(toDraft(next));
    },
  });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  // The address this product actually sits at, on the site being worked in.
  const mine = (domains ?? []).filter(
    (domain) =>
      domain.status !== 'removed' && (propertyId ? domain.propertyId === propertyId : true)
  );
  const host = (mine.find((domain) => domain.isCanonical) ?? mine[0])?.host ?? 'yoursite.com';

  const usedTitle = draft.seoTitle.trim() || product.title;
  const titleIsFallback = draft.seoTitle.trim() === '';
  const descriptionFallback = fromDescription(product.description);
  const usedDescription = draft.seoDescription.trim() || descriptionFallback;

  // The main photo is what a share falls back to, so the preview shows it rather
  // than an empty frame when nothing has been chosen.
  const primaryImage = images.find((image) => image.isPrimary) ?? images[0] ?? null;
  const chosenAssetId = draft.ogImageId ?? primaryImage?.mediaAssetId ?? null;
  const chosenAsset = assets.find((asset) => asset.id === chosenAssetId) ?? null;
  const imageIsFallback = draft.ogImageId == null;

  return (
    <div className="flex flex-col gap-4">
      <FormSection
        title="In search results"
        description="This is roughly how your product appears to someone searching. Search engines rewrite these when they think they can do better, so treat it as a strong suggestion rather than a guarantee."
      >
        {/* The preview leads, and the fields follow it. A field with a character
            counter above a preview asks someone to imagine the result; below it,
            they can just look. */}
        <div className="border-base-300 rounded-box flex flex-col gap-1 border p-4">
          <Text as="span" className="text-sm break-all">
            {host} › products › {product.handle}
          </Text>
          <Text as="span" className="text-primary text-xl leading-snug font-medium">
            {usedTitle}
          </Text>
          <Text as="span" className="text-sm">
            {usedDescription ||
              'No summary yet — search engines will pick a sentence from your page.'}
          </Text>
        </div>

        <Field>
          <FieldLabel>Search title</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={draft.seoTitle}
                placeholder={product.title}
                onChange={(event) => {
                  set('seoTitle', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            {titleIsFallback
              ? 'Empty, so the product’s name is used — which is usually right. Write something different only when the name alone would not tell a stranger what this is.'
              : `Usually shown in full up to about ${String(TITLE_COMFORT)} characters.`}
          </FieldDescription>
          {!titleIsFallback && draft.seoTitle.trim().length > TITLE_COMFORT ? (
            <Badge color="warning" variant="soft" size="sm">
              Longer than most results show — the end will be cut off
            </Badge>
          ) : null}
        </Field>

        <Field>
          <FieldLabel>Search summary</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={3}
                value={draft.seoDescription}
                placeholder={
                  descriptionFallback || 'One or two sentences on what this is and who it is for.'
                }
                onChange={(event) => {
                  set('seoDescription', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            {draft.seoDescription.trim() === ''
              ? descriptionFallback
                ? 'Empty, so the start of your description is used. Write your own to say something that makes a person click rather than just the first thing on the page.'
                : 'Empty, and this product has no description either — so search engines will choose a sentence from the page themselves.'
              : `Usually shown in full up to about ${String(DESCRIPTION_COMFORT)} characters.`}
          </FieldDescription>
          {draft.seoDescription.trim().length > DESCRIPTION_COMFORT ? (
            <Badge color="warning" variant="soft" size="sm">
              Longer than most results show — the end will be cut off
            </Badge>
          ) : null}
        </Field>
      </FormSection>

      <FormSection
        title="When someone shares a link to it"
        description="The picture that appears when this product is pasted into a message, a post or a chat."
      >
        {images.length === 0 ? (
          <Alert color="info" variant="soft">
            <AlertContent>
              <AlertTitle>No photos to choose from yet</AlertTitle>
              <AlertDescription>
                Add photos on the Media tab and you can pick which one appears when someone shares
                this product. Until then a shared link shows no picture at all, which makes it far
                easier to scroll past.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : (
          <>
            {/* One share card, at the shape a link preview actually is. */}
            <div className="border-base-300 rounded-box overflow-hidden border">
              <div className="bg-base-200 relative aspect-[1.91/1] w-full">
                {chosenAsset?.url ? (
                  <Image
                    src={chosenAsset.url}
                    alt={`The picture shown when ${product.title} is shared`}
                    fill
                    sizes="(min-width: 1024px) 640px, 90vw"
                    className="object-cover"
                    unoptimized={!chosenAsset.canOptimize || chosenAsset.mimeType === 'image/gif'}
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-sm">
                    No picture
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 p-3">
                <Text as="span" className="text-sm break-all">
                  {host}
                </Text>
                <Text as="span" className="font-semibold">
                  {usedTitle}
                </Text>
                <Text as="span" className="text-sm">
                  {usedDescription || 'No summary yet.'}
                </Text>
              </div>
            </div>

            <Field>
              <FieldLabel>Which picture</FieldLabel>
              <FieldControl
                render={
                  <ul className="grid grid-cols-3 gap-2 @md:grid-cols-4 @3xl:grid-cols-6">
                    <li>
                      <PickerTile
                        selected={draft.ogImageId == null}
                        label="Use the main photo"
                        onSelect={() => {
                          set('ogImageId', null);
                        }}
                      >
                        <span className="flex h-full items-center justify-center p-1 text-center text-sm">
                          Main photo
                        </span>
                      </PickerTile>
                    </li>
                    {images.map((image) => {
                      const asset = assets.find((row) => row.id === image.mediaAssetId);
                      return (
                        <li key={image.id}>
                          <PickerTile
                            selected={draft.ogImageId === image.mediaAssetId}
                            label={`Use ${asset?.filename ?? 'this photo'} when shared`}
                            onSelect={() => {
                              set('ogImageId', image.mediaAssetId);
                            }}
                          >
                            {asset?.url ? (
                              <Image
                                src={asset.url}
                                alt=""
                                fill
                                sizes="120px"
                                className="object-cover"
                                unoptimized={!asset.canOptimize || asset.mimeType === 'image/gif'}
                              />
                            ) : (
                              <span className="flex h-full items-center justify-center">
                                <Icon glyph={faImageSlash} className="size-4" aria-hidden />
                              </span>
                            )}
                          </PickerTile>
                        </li>
                      );
                    })}
                  </ul>
                }
              />
              <FieldDescription>
                {imageIsFallback
                  ? 'Nothing chosen, so whichever photo is set as the main one is used — and it changes automatically if you change the main photo.'
                  : 'This picture is used whatever the main photo is. Choose “Main photo” to let it follow along again.'}
              </FieldDescription>
            </Field>
          </>
        )}
      </FormSection>
    </div>
  );
}

/** One choosable picture. A real `<button>` — a clickable tile is a control, not
 *  a list item with a handler taped to it. */
function PickerTile({
  selected,
  label,
  onSelect,
  children,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      className={`bg-base-200 rounded-box relative aspect-square w-full overflow-hidden ${
        selected ? 'ring-2 ring-[color:var(--color-module)] ring-offset-2' : ''
      }`}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
