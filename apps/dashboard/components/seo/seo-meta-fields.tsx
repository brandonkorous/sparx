'use client';

import * as React from 'react';
import { CornerDownLeft } from 'lucide-react';

import { Button, Input, Label, Textarea } from 'silicaui-react';
import { cn } from '@sparx/ui';
import type { EntityType } from '@sparx/seo-audit';

import { SeoScoreChip } from './seo-score';

// SeoMetaFields — the ONE SEO title + meta-description block, standard across
// every editable entity (collection, product, CMS content, page). docs/50 §7.
//
// The platform already FALLS BACK to the entity name / description when the SEO
// fields are blank — both the live storefront `generateMetadata` and the SEO
// audit do `seoTitle ?? name`. So a blank SEO field is not "missing"; it
// INHERITS. This block makes that legible instead of confusing:
//   • the inherited value is the field's placeholder (so blank-but-scored-green
//     reads as "inheriting 'Fan Favorites'", not a bug),
//   • a per-field "Use name" / "Use description" button materializes that value
//     for editing — shown only while the field is empty, so it never clobbers a
//     custom value the author already wrote,
//   • the description fill is trimmed to the meta budget the score grades.

const DESC_FILL_MAX = 160; // upper bound of the audit's desc-length pass
const DESC_PLACEHOLDER_MAX = 120; // a hint, not the whole body

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trim to at most `max` chars on a word boundary (no ellipsis — it's a value). */
function truncateAtWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

export interface SeoMetaFieldsProps {
  /** Entity kind + id for the live SEO health chip. */
  type: EntityType;
  id: string;
  /** Inherited title source (the entity name/title) — placeholder + "Use name". */
  nameSource: string;
  /** Inherited description source (may be HTML; stripped) — "Use description". */
  descriptionSource?: string | null;
  seoTitle: string;
  seoDescription: string;
  onSeoTitleChange: (value: string) => void;
  onSeoDescriptionChange: (value: string) => void;
  /** Distinguishes input ids when several SEO blocks share a page. */
  idPrefix?: string;
  /** Wrapper className (e.g. a top divider + padding the host wants). */
  className?: string;
}

export function SeoMetaFields({
  type,
  id,
  nameSource,
  descriptionSource,
  seoTitle,
  seoDescription,
  onSeoTitleChange,
  onSeoDescriptionChange,
  idPrefix = 'seo',
  className,
}: SeoMetaFieldsProps) {
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-description`;

  const nameFill = nameSource.trim();
  const descFill = truncateAtWord(stripHtml(descriptionSource ?? ''), DESC_FILL_MAX);

  const titlePlaceholder = nameFill || 'Page title for search engines';
  const descPlaceholder = descFill
    ? truncateAtWord(descFill, DESC_PLACEHOLDER_MAX) +
      (descFill.length > DESC_PLACEHOLDER_MAX ? '…' : '')
    : 'A short pitch shown under the title in search results';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-lg font-semibold">SEO</h4>
        {/* Live SEO health for the saved entity; hover for the full report. */}
        <SeoScoreChip type={type} id={id} size={30} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={titleId}>Page title</Label>
          {seoTitle.trim().length === 0 && nameFill.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              color="module"
              iconStart={<CornerDownLeft className="h-3 w-3" />}
              onClick={() => onSeoTitleChange(nameFill)}
            >
              Use name
            </Button>
          )}
        </div>
        <Input
          id={titleId}
          value={seoTitle}
          placeholder={titlePlaceholder}
          onChange={(e) => onSeoTitleChange(e.target.value)}
        />
        {seoTitle.trim().length === 0 && nameFill.length > 0 && (
          <p className="text-base-content/70 text-xs">Blank uses the name — “{nameFill}”.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={descId}>Meta description</Label>
          {seoDescription.trim().length === 0 && descFill.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              color="module"
              iconStart={<CornerDownLeft className="h-3 w-3" />}
              onClick={() => onSeoDescriptionChange(descFill)}
            >
              Use description
            </Button>
          )}
        </div>
        <Textarea
          id={descId}
          rows={3}
          value={seoDescription}
          placeholder={descPlaceholder}
          onChange={(e) => onSeoDescriptionChange(e.target.value)}
        />
        {seoDescription.trim().length === 0 && descFill.length > 0 && (
          <p className="text-base-content/70 text-xs">
            Blank uses the description (trimmed to {DESC_FILL_MAX} characters).
          </p>
        )}
      </div>
    </div>
  );
}
