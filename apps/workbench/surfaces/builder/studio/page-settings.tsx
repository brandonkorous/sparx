'use client';

// Page settings — what wraps ONE page, and how it shows up in a search result or when
// someone shares it.
//
// ── Why this exists ──────────────────────────────────────────────────────────
//
// These six columns (`frameId` + `seoTitle` / `seoDescription` / `ogImage` /
// `canonical` / `noindex`) live on the `BuilderPage` row. The storefront has always
// read them — `generateMetadata` titles and describes every page from them — and the
// SEO scorecard has always graded them. Nothing in the editor could ever SET them. So
// every page a tenant built shipped with the site name as its title, no description at
// all, and a scorecard telling them to "add a title" with nowhere to add one.
//
// `frameId` shipped with the same shape of gap and is the reason this drawer is no
// longer only about search: the column, its CHECK constraint, the tri-state resolver
// and the storefront read all landed, `PATCH /v1/builder/pages/:id` accepted the field,
// and a landing page with the header turned off was still unreachable by clicking.
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
  Alert,
  AlertContent,
  AlertDescription,
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
  Select,
  Switch,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import {
  FRAME_NONE,
  frameMissingMessage,
  resolvePageFrame,
  type PageFrameChoice,
} from '@sparx/builder-schemas';
import { AlertTriangle, ChevronDown, ImageOff, ImagePlus, Settings2, Trash2 } from 'lucide-react';
import { useMediaPicker } from '../../cms/media-picker';
import { useLayouts, usePageSettings, type LayoutChoice, type PageSettingsDto } from './data';

/** The editable shape. Everything is a string in the form (an empty string means
 *  "not set" and normalizes to null on the way out), except the indexing switch.
 *
 *  `frameId` follows the same convention on purpose — `''` is the site default, so the
 *  form has one rule for "empty" rather than a `null` that behaves differently from
 *  every field beside it. {@link draftToPatch} restores the tri-state on the way out. */
export interface PageSettingsDraft {
  frameId: string;
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  ogImage: string;
  noindex: boolean;
}

const BLANK: PageSettingsDraft = {
  frameId: '',
  seoTitle: '',
  seoDescription: '',
  canonical: '',
  ogImage: '',
  noindex: false,
};

function toDraft(stored: PageSettingsDto | undefined): PageSettingsDraft {
  if (!stored) return BLANK;
  return {
    frameId: stored.frameId ?? '',
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
  return {
    // `null` RESETS this page to the site default; `'none'` and a layout id are stored
    // verbatim. The service treats all three as distinct from an ABSENT field, so a
    // patch that always carries `frameId` is what makes "back to the default" reachable.
    frameId: nullIfBlank(draft.frameId),
    seoTitle: nullIfBlank(draft.seoTitle),
    seoDescription: nullIfBlank(draft.seoDescription),
    canonical: nullIfBlank(draft.canonical),
    ogImage: nullIfBlank(draft.ogImage),
    noindex: draft.noindex,
  };
}

function sameDraft(a: PageSettingsDraft, b: PageSettingsDraft): boolean {
  return (
    a.frameId === b.frameId &&
    a.seoTitle === b.seoTitle &&
    a.seoDescription === b.seoDescription &&
    a.canonical === b.canonical &&
    a.ogImage === b.ogImage &&
    a.noindex === b.noindex
  );
}

// ── The chrome picker ────────────────────────────────────────────────────────

/** The option list, in the order a person reasons about it: the site default first
 *  (what almost every page wants), then the deliberate exception, then the alternative
 *  designs.
 *
 *  The LIVE layout is named inside the default option rather than listed again beside
 *  it, and that is the engine's model rather than a presentation choice: silica's
 *  `Site.frame` is the default shell and is NOT a member of `Site.frames`, so a page
 *  pointing at the live layout's id would dangle in the editor while resolving fine on
 *  the storefront — the same page previewing differently from how it publishes. One
 *  meaning, one value. */
function frameOptions(layouts: readonly LayoutChoice[], choice: PageFrameChoice) {
  const active = layouts.find((l) => l.isActive);
  const items: Record<string, string> = {
    '': active ? `Follow the site default (${active.name})` : 'Follow the site default',
    [FRAME_NONE]: 'No header or footer',
  };
  for (const layout of layouts) if (!layout.isActive) items[layout.id] = layout.name;
  // A page pointing at a deleted design still has to render its own value, or the
  // control comes up blank and the author cannot tell what it is set to.
  if (choice.kind === 'missing') items[choice.frameId] = 'A design that no longer exists';
  return items;
}

/** What this choice MEANS on the live site, in the second person. The picker names the
 *  designs; this says what a visitor will see, which is the part an owner is actually
 *  deciding. */
function frameConsequence(choice: PageFrameChoice, layouts: readonly LayoutChoice[]): string {
  switch (choice.kind) {
    case 'default':
      return 'This page shows the same header and footer as the rest of your site.';
    case 'none':
      return (
        'This page shows no menu and no footer links at all. Make sure the page itself gives ' +
        'people somewhere to go next — a button, a form, or a link back to your site.'
      );
    default: {
      const named = layouts.find((l) => l.id === choice.frameId);
      return named
        ? `This page uses “${named.name}” instead of the header and footer the rest of your site ` +
            'shows.'
        : 'This page uses a design that has been deleted, so it currently shows no header or footer.';
    }
  }
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
  onChange: (pageId: string, draft: PageSettingsDraft | null) => void;
  /** The pending (unsaved) draft for this page, if the operator already edited it and
   *  reopened the drawer. */
  pending: PageSettingsDraft | null;
}

export function PageSettings({ pageId, pageName, siteName, saved, onChange, pending }: Props) {
  const [open, setOpen] = useState(false);
  const stored = usePageSettings(saved ? pageId : null, open);
  const layouts = useLayouts(open);
  const [draft, setDraft] = useState<PageSettingsDraft>(BLANK);
  const pick = useMediaPicker();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const baseline = useMemo(() => toDraft(stored.data), [stored.data]);

  // Seed the form from whichever is authoritative: a pending edit the operator has not
  // saved yet wins over what the server holds, so reopening the drawer never silently
  // discards their typing.
  useEffect(() => {
    setDraft(pending ?? baseline);
  }, [pending, baseline, pageId]);

  const set = <K extends keyof PageSettingsDraft>(key: K, value: PageSettingsDraft[K]): void => {
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

  // Resolve the stored choice against the designs that actually exist, so a page
  // pointing at a deleted one is REPORTED rather than quietly shown as the default —
  // the whole point of the tri-state (doc 139 §5).
  //
  // Until the catalog has loaded, an id resolves against an EMPTY set and would read as
  // `missing` — which would flash "a design that no longer exists" at an author whose
  // design is fine. So the warning waits for the list, and the picker holds the id.
  const layoutList = layouts.data ?? [];
  const choice = resolvePageFrame(
    draft.frameId === '' ? null : draft.frameId,
    layouts.isSuccess ? layoutList.map((l) => l.id) : [draft.frameId]
  );

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
            What wraps <strong>{pageName || 'this page'}</strong>, and how it appears in Google and
            when someone shares it. Saved with the rest of your changes when you press Save.
          </p>
        </DrawerHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
          {!saved ? (
            <Text className="text-base">
              This page is new. Fill these in now — they save along with the page itself.
            </Text>
          ) : null}

          {/* Chrome comes first: it is the choice that changes what the page IS, and
              the one an author making a landing page came here for. */}
          <Field>
            <FieldLabel>Header and footer</FieldLabel>
            <FieldDescription>
              Almost every page should keep the same header and footer as the rest of your site, so
              visitors always know where they are and how to get around.
            </FieldDescription>
            <FieldControl>
              <Select
                color="module"
                aria-label="Header and footer for this page"
                value={draft.frameId}
                items={frameOptions(layoutList, choice)}
                onValueChange={(next) => {
                  set('frameId', next as string);
                }}
              />
            </FieldControl>
            <Text className="text-base">{frameConsequence(choice, layoutList)}</Text>
            {choice.kind === 'missing' ? (
              <Alert color="warning" variant="soft">
                <AlertTriangle className="size-5" aria-hidden />
                <AlertContent>
                  <AlertDescription>{frameMissingMessage(pageName)}</AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}
          </Field>

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
