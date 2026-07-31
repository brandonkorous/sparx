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
// ── Where it lives, and why it moved ─────────────────────────────────────────
//
// It is a SECTION OF THE INSPECTOR, on the page's root node, in the Settings tab —
// beside Element, Data binding and Accessibility. It used to be a toolbar button that
// opened a right-hand drawer, and that was wrong twice over:
//
//   · These are properties OF THE PAGE ELEMENT. The editor already has one place where
//     you select a thing and read its properties; a second, parallel place reachable
//     only from the toolbar meant the page was the one element in the document whose
//     settings weren't where every other element's settings are.
//   · A drawer covered the editor to edit a field belonging to the thing behind it.
//
// silica's `Page` is deliberately flat (`{id,name,slug,root}`) and has no home for
// domain metadata, which is exactly why the engine offers `BuilderHost.inspectorPanels`
// — "host-contributed inspector panels for specific node types (SEO, product-pin, a
// per-module editor)". This is that panel, and the studio decides when it applies (the
// selected node is some page's root — `studio-surface.tsx`).
//
// TYPE SIZE IS DELIBERATELY 14px HERE, not the platform's 16px body floor. This renders
// INSIDE silica's inspector column — a resizable rail that is ~350px at its default
// width, whose own rows are 12px. 16px paragraphs would fit about thirty characters to a
// line and read as a different application bolted into the panel; 12px would match the
// chrome and be too small to read comfortably, which is the complaint that produced the
// floor in the first place. 14px is the honest answer for a dense rail: legible, and in
// proportion with the controls beside it. Same reasoning the status bar already
// documents for keeping silica's own button sizing.
//
// ── The save model ───────────────────────────────────────────────────────────
//
// ONE Save button in the editor, per the platform rule. This panel never writes on its
// own: it reports edits up, the studio marks itself dirty, and `doSync` flushes them
// right after the site reconcile. That ordering is load-bearing — a page created in
// this session has no row until the sync lands, so patching it first would 404.
//
// ── Scope ────────────────────────────────────────────────────────────────────
//
// NAME, SLUG and the page's CHROME are deliberately absent. silica owns all three —
// the page switcher for the first two, and (since 0.37) a per-page layout picker right
// beside it for the third. Putting any of them here too would give one field two
// owners, which is the "identity once" rule this codebase already learned the hard way.
//
// The chrome one was briefly built here before that picker was found, and removing it
// was the right call rather than the polite one: the engine's sits where an author is
// already choosing pages, and the duplicate wrote the same column through a second
// endpoint. What survives is the PERSISTENCE — `SiteSyncPageInput.frameId` carries the
// engine's choice to `builder_pages.frame_id`, which is what makes its picker real.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Badge, Button, Input, Switch, Textarea } from '@wizeworks/silicaui-react';
import { ChevronDown, ImageOff, ImagePlus, Trash2 } from 'lucide-react';
import { useMediaPicker } from '../../cms/media-picker';
import { usePageSettings, type PageSettingsDto } from './data';

/** The editable shape. Everything is a string in the form (an empty string means
 *  "not set" and normalizes to null on the way out), except the indexing switch. */
export interface PageSettingsDraft {
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  ogImage: string;
  noindex: boolean;
}

const BLANK: PageSettingsDraft = {
  seoTitle: '',
  seoDescription: '',
  canonical: '',
  ogImage: '',
  noindex: false,
};

function toDraft(stored: PageSettingsDto | undefined): PageSettingsDraft {
  if (!stored) return BLANK;
  return {
    seoTitle: stored.seoTitle ?? '',
    seoDescription: stored.seoDescription ?? '',
    canonical: stored.canonical ?? '',
    ogImage: stored.ogImage ?? '',
    noindex: stored.noindex,
  };
}

/** The wire shape: empty strings become null so a cleared field actually clears the
 *  column rather than storing `''` (which reads as "set" everywhere downstream). */
export function draftToPatch(draft: PageSettingsDraft): Partial<PageSettingsDto> {
  const nullIfBlank = (v: string): string | null => {
    const t = v.trim();
    return t === '' ? null : t;
  };
  // No `frameId`: the site sync owns it (see the Scope note above), and an ABSENT field
  // is how this patch says "leave the page's chrome alone" rather than resetting it.
  return {
    seoTitle: nullIfBlank(draft.seoTitle),
    seoDescription: nullIfBlank(draft.seoDescription),
    canonical: nullIfBlank(draft.canonical),
    ogImage: nullIfBlank(draft.ogImage),
    noindex: draft.noindex,
  };
}

function sameDraft(a: PageSettingsDraft, b: PageSettingsDraft): boolean {
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

/** One labelled field in the rail: label, one line of plain-language help, control.
 *  Deliberately NOT silica's `<Field>` — that composition sizes itself for a full-width
 *  form, and this column is 350px (see the type-size note in the header). */
function PanelField({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <p className="text-sm leading-snug">{help}</p>
      {children}
    </div>
  );
}

interface Props {
  /** The page this panel is describing — the page whose ROOT node is selected. */
  pageId: string;
  pageName: string;
  /** The site's own name, shown in the preview where a title is not set yet. */
  siteName: string;
  /** True once this page exists on the server. A page added in this session does not
   *  yet, so its settings cannot be loaded — the form starts blank and saves after the
   *  next site Save creates the row. */
  saved: boolean;
  /** Report an edit up. The studio holds the pending change and flushes it on Save. */
  onChange: (pageId: string, draft: PageSettingsDraft | null) => void;
  /** The pending (unsaved) draft for this page, if the operator already edited it and
   *  then selected something else and come back. */
  pending: PageSettingsDraft | null;
}

export function PageSettingsPanel({ pageId, pageName, siteName, saved, onChange, pending }: Props) {
  const stored = usePageSettings(saved ? pageId : null, true);
  const [draft, setDraft] = useState<PageSettingsDraft>(BLANK);
  const pick = useMediaPicker();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const baseline = useMemo(() => toDraft(stored.data), [stored.data]);

  // Seed the form from whichever is authoritative: a pending edit the operator has not
  // saved yet wins over what the server holds, so re-selecting the page never silently
  // discards their typing.
  useEffect(() => {
    setDraft(pending ?? baseline);
  }, [pending, baseline, pageId]);

  const set = <K extends keyof PageSettingsDraft>(key: K, value: PageSettingsDraft[K]): void => {
    const next = { ...draft, [key]: value };
    setDraft(next);
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
    <div className="flex flex-col gap-4">
      {!saved ? (
        <p className="text-sm leading-snug">
          This page is new. Fill these in now — they save along with the page itself.
        </p>
      ) : null}

      {/* The point of the whole section, made concrete: what a person actually sees
          before they decide to click. Abstract field labels do not teach this. */}
      <div className="border-base-300 flex flex-col gap-1 rounded-lg border p-3">
        <span className="text-sm font-medium">In a search result</span>
        <p className="text-primary mt-1 leading-snug">{previewTitle}</p>
        <p className="text-sm leading-snug">
          {previewDescription || 'Add a description below and it will show up here.'}
        </p>
      </div>

      <PanelField
        label="Page title"
        help="The headline in search results and the browser tab. Say what the page is, in your customers’ words."
      >
        <Input
          size="sm"
          value={draft.seoTitle}
          placeholder={pageName || siteName}
          onChange={(event) => {
            set('seoTitle', event.target.value);
          }}
        />
        {titleHint ? (
          <p className={`text-sm ${titleHint.over ? 'text-warning' : ''}`}>{titleHint.text}</p>
        ) : null}
      </PanelField>

      <PanelField
        label="Description"
        help="The couple of lines under the title. This is your pitch — it is often what decides whether someone clicks."
      >
        <Textarea
          size="sm"
          rows={3}
          value={draft.seoDescription}
          onChange={(event) => {
            set('seoDescription', event.target.value);
          }}
        />
        {descHint ? (
          <p className={`text-sm ${descHint.over ? 'text-warning' : ''}`}>{descHint.text}</p>
        ) : null}
      </PanelField>

      <PanelField
        label="Sharing picture"
        help="Shown when this page is posted to social media or sent in a message. Without one, a plain link is all anyone sees."
      >
        <div className="bg-base-200 relative h-24 w-full overflow-hidden rounded-md">
          {draft.ogImage ? (
            <Image
              src={draft.ogImage}
              alt=""
              fill
              sizes="360px"
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
            {draft.ogImage ? 'Change' : 'Choose a picture'}
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
      </PanelField>

      <PanelField
        label="Show this page in search engines"
        help="Turn this off for a page you only want people to reach by link — a thank-you page, or something not ready yet."
      >
        <div className="flex items-center gap-2">
          <Switch
            color="module"
            checked={!draft.noindex}
            aria-label="Show this page in search engines"
            onCheckedChange={(next: boolean) => {
              set('noindex', !next);
            }}
          />
          {draft.noindex ? (
            <Badge color="warning" variant="soft" size="sm">
              Hidden
            </Badge>
          ) : null}
        </div>
      </PanelField>

      {/* Canonical is a genuinely technical concept and almost nobody needs it, so it
          sits behind a disclosure rather than in the main flow — present for the
          person who needs it, invisible to the person who does not. */}
      <div className="border-base-300 flex flex-col gap-3 border-t pt-3">
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-medium"
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
          <PanelField
            label="Preferred web address"
            help="If this same content also lives at another address, put that address here so search engines count them as one page instead of two. Leave it empty unless you know you need it."
          >
            <Input
              size="sm"
              value={draft.canonical}
              placeholder="https://example.com/the-original-page"
              onChange={(event) => {
                set('canonical', event.target.value);
              }}
            />
          </PanelField>
        ) : null}
      </div>
    </div>
  );
}
