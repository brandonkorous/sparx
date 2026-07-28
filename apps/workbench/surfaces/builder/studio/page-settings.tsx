'use client';

// Page settings — how ONE page shows up in a search result and when someone shares it.
//
// ── Why this exists ──────────────────────────────────────────────────────────
//
// These five columns (`seoTitle` / `seoDescription` / `ogImage` / `canonical` /
// `noindex`) live on the `BuilderPage` row. The storefront has always read them —
// `generateMetadata` titles and describes every page from them — and the SEO scorecard
// has always graded them. Nothing in the editor could ever SET them. So every page a
// tenant built shipped with the site name as its title, no description at all, and a
// scorecard telling them to "add a title" with nowhere to add one.
//
// silica's `Page` is deliberately flat (`{id,name,slug,root}`) and has no home for
// domain metadata, which is exactly why the engine hands hosts `onActivePageChange` —
// "how a host keys its own page-scoped side panel". This is that panel.
//
// ── The save model ───────────────────────────────────────────────────────────
//
// ONE Save button in the editor, per the platform rule. This drawer never writes on its
// own: it reports edits up, the studio marks itself dirty, and `doSync` flushes them
// right after the site reconcile. That ordering is load-bearing — a page created in
// this session has no row until the sync lands, so patching it first would 404.
//
// ── Scope ────────────────────────────────────────────────────────────────────
//
// NAME and SLUG are deliberately absent. silica's page switcher owns them and syncs
// them with the tree; putting them here too would give one field two owners, which is
// the "identity once" rule this codebase already learned the hard way.

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Switch,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import { ChevronDown, ImageOff, ImagePlus, Settings2, Trash2 } from 'lucide-react';
import { useMediaPicker } from '../../cms/media-picker';
import { usePageSeo, type PageSeo } from './data';

/** The editable shape. Everything is a string in the form (an empty string means
 *  "not set" and normalizes to null on the way out), except the indexing switch. */
export interface PageSeoDraft {
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  ogImage: string;
  noindex: boolean;
}

const BLANK: PageSeoDraft = {
  seoTitle: '',
  seoDescription: '',
  canonical: '',
  ogImage: '',
  noindex: false,
};

function toDraft(seo: PageSeo | undefined): PageSeoDraft {
  if (!seo) return BLANK;
  return {
    seoTitle: seo.seoTitle ?? '',
    seoDescription: seo.seoDescription ?? '',
    canonical: seo.canonical ?? '',
    ogImage: seo.ogImage ?? '',
    noindex: seo.noindex,
  };
}

/** The wire shape: empty strings become null so a cleared field actually clears the
 *  column rather than storing `''` (which reads as "set" everywhere downstream). */
export function draftToPatch(draft: PageSeoDraft): Partial<PageSeo> {
  const nullIfBlank = (v: string): string | null => {
    const t = v.trim();
    return t === '' ? null : t;
  };
  return {
    seoTitle: nullIfBlank(draft.seoTitle),
    seoDescription: nullIfBlank(draft.seoDescription),
    canonical: nullIfBlank(draft.canonical),
    ogImage: nullIfBlank(draft.ogImage),
    noindex: draft.noindex,
  };
}

function sameDraft(a: PageSeoDraft, b: PageSeoDraft): boolean {
  return (
    a.seoTitle === b.seoTitle &&
    a.seoDescription === b.seoDescription &&
    a.canonical === b.canonical &&
    a.ogImage === b.ogImage &&
    a.noindex === b.noindex
  );
}

/** Length guidance, phrased as an outcome rather than a rule. Search engines cut a
 *  title around 60 characters and a description around 160 — worth saying plainly,
 *  never worth blocking on. */
function lengthHint(value: string, ideal: number): { text: string; over: boolean } | null {
  const n = value.trim().length;
  if (n === 0) return null;
  if (n > ideal) {
    return { text: `${n} characters — the end may be cut off in search results`, over: true };
  }
  return { text: `${n} characters`, over: false };
}

interface Props {
  /** The page the editor currently has open — silica owns this and reports it. */
  pageId: string | null;
  pageName: string;
  /** The site's own name, shown in the preview where a title is not set yet. */
  siteName: string;
  /** True once this page exists on the server. A page added in this session does not
   *  yet, so its settings cannot be loaded — the form starts blank and saves after the
   *  next site Save creates the row. */
  saved: boolean;
  /** Report an edit up. The studio holds the pending change and flushes it on Save. */
  onChange: (pageId: string, draft: PageSeoDraft | null) => void;
  /** The pending (unsaved) draft for this page, if the operator already edited it and
   *  reopened the drawer. */
  pending: PageSeoDraft | null;
}

export function PageSettings({ pageId, pageName, siteName, saved, onChange, pending }: Props) {
  const [open, setOpen] = useState(false);
  const stored = usePageSeo(saved ? pageId : null, open);
  const [draft, setDraft] = useState<PageSeoDraft>(BLANK);
  const pick = useMediaPicker();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const baseline = useMemo(() => toDraft(stored.data), [stored.data]);

  // Seed the form from whichever is authoritative: a pending edit the operator has not
  // saved yet wins over what the server holds, so reopening the drawer never silently
  // discards their typing.
  useEffect(() => {
    setDraft(pending ?? baseline);
  }, [pending, baseline, pageId]);

  const set = <K extends keyof PageSeoDraft>(key: K, value: PageSeoDraft[K]): void => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (!pageId) return;
    // Report null when the operator has typed their way back to the stored values —
    // otherwise the editor would stay dirty forever over a no-op change.
    onChange(pageId, sameDraft(next, baseline) ? null : next);
  };

  const chooseImage = async (): Promise<void> => {
    const picked = await pick();
    if (!picked?.url) return;
    set('ogImage', picked.url);
  };

  const titleHint = lengthHint(draft.seoTitle, 60);
  const descHint = lengthHint(draft.seoDescription, 160);
  const previewTitle = draft.seoTitle.trim() || pageName || siteName;
  const previewDescription = draft.seoDescription.trim();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="ghost"
        color="neutral"
        disabled={!pageId}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Settings2 className="size-4" aria-hidden />
        Page settings
      </Button>

      <DrawerContent side="right" className="flex w-[30rem] max-w-full flex-col">
        <DrawerHeader>
          <DrawerTitle>Page settings</DrawerTitle>
          <p className="text-base-content text-base">
            How <strong>{pageName || 'this page'}</strong> appears in Google and when someone shares
            it. Saved with the rest of your changes when you press Save.
          </p>
        </DrawerHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
          {!saved ? (
            <Text className="text-base">
              This page is new. Fill these in now — they save along with the page itself.
            </Text>
          ) : null}

          {/* The point of the whole panel, made concrete: what a person actually sees
              before they decide to click. Abstract field labels do not teach this. */}
          <div className="border-base-300 flex flex-col gap-1 rounded-lg border p-4">
            <Text className="text-base-content text-base font-medium">In a search result</Text>
            <p className="text-primary mt-2 text-lg leading-snug">{previewTitle}</p>
            <p className="text-base-content text-base leading-snug">
              {previewDescription || 'Add a description below and it will show up here.'}
            </p>
          </div>

          <Field>
            <FieldLabel>Page title</FieldLabel>
            <FieldDescription>
              The headline people see in search results and in the browser tab. Say what the page
              is, in their words.
            </FieldDescription>
            <FieldControl>
              <Input
                value={draft.seoTitle}
                placeholder={pageName || siteName}
                onChange={(event) => {
                  set('seoTitle', event.target.value);
                }}
              />
            </FieldControl>
            {titleHint ? (
              <Text className={titleHint.over ? 'text-warning text-base' : 'text-base'}>
                {titleHint.text}
              </Text>
            ) : null}
          </Field>

          <Field>
            <FieldLabel>Description</FieldLabel>
            <FieldDescription>
              The couple of lines under the title. This is your pitch — it is often what decides
              whether someone clicks.
            </FieldDescription>
            <FieldControl>
              <Textarea
                rows={3}
                value={draft.seoDescription}
                onChange={(event) => {
                  set('seoDescription', event.target.value);
                }}
              />
            </FieldControl>
            {descHint ? (
              <Text className={descHint.over ? 'text-warning text-base' : 'text-base'}>
                {descHint.text}
              </Text>
            ) : null}
          </Field>

          <Field>
            <FieldLabel>Sharing picture</FieldLabel>
            <FieldDescription>
              Shown when this page is posted to social media or sent in a message. Without one, a
              plain link is all anyone sees.
            </FieldDescription>
            <div className="flex flex-col gap-2">
              <div className="bg-base-200 relative h-32 w-full overflow-hidden rounded-md">
                {draft.ogImage ? (
                  <Image
                    src={draft.ogImage}
                    alt=""
                    fill
                    sizes="440px"
                    className="object-cover"
                    // Cross-origin tenant media — the optimizer's host allow-list is
                    // environment-fragile, same call the media browser makes.
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full items-center justify-center">
                    <ImageOff className="size-5" aria-hidden />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  color="module"
                  onClick={() => {
                    void chooseImage();
                  }}
                >
                  <ImagePlus className="size-4" aria-hidden />
                  {draft.ogImage ? 'Change picture' : 'Choose a picture'}
                </Button>
                {draft.ogImage ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    color="neutral"
                    onClick={() => {
                      set('ogImage', '');
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </Field>

          <Field>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col">
                <FieldLabel>Show this page in search engines</FieldLabel>
                <FieldDescription>
                  Turn this off for a page you only want people to reach by link — a thank-you page,
                  or something not ready yet.
                </FieldDescription>
              </div>
              <div className="flex flex-none items-center gap-2 pt-1">
                {draft.noindex ? (
                  <Badge color="warning" variant="soft" size="sm">
                    Hidden
                  </Badge>
                ) : null}
                <Switch
                  color="module"
                  checked={!draft.noindex}
                  aria-label="Show this page in search engines"
                  onCheckedChange={(next: boolean) => {
                    set('noindex', !next);
                  }}
                />
              </div>
            </div>
          </Field>

          {/* Canonical is a genuinely technical concept and almost nobody needs it, so it
              sits behind a disclosure rather than in the main flow — present for the
              person who needs it, invisible to the person who does not. */}
          <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
            <button
              type="button"
              className="text-base-content flex items-center gap-1 text-base font-medium"
              aria-expanded={showAdvanced}
              onClick={() => {
                setShowAdvanced((v) => !v);
              }}
            >
              <ChevronDown
                className={`size-4 transition-transform ${showAdvanced ? '' : '-rotate-90'}`}
                aria-hidden
              />
              Advanced
            </button>
            {showAdvanced ? (
              <Field>
                <FieldLabel>Preferred web address</FieldLabel>
                <FieldDescription>
                  If this same content also lives at another address, put that address here so
                  search engines count them as one page instead of two. Leave it empty unless you
                  know you need it.
                </FieldDescription>
                <FieldControl>
                  <Input
                    value={draft.canonical}
                    placeholder="https://example.com/the-original-page"
                    onChange={(event) => {
                      set('canonical', event.target.value);
                    }}
                  />
                </FieldControl>
              </Field>
            ) : null}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
