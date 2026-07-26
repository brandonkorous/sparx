'use client';

// The email studio — ONE surface for every email this business sends.
//
// This is the silicaui `<EmailBuilder>`: silica owns the editor chrome (the Insert
// palette, the canvas, the Design inspector) AND the two document-level fields an
// email has that a page doesn't — its subject and its inbox-preview line, edited
// through the canvas's own inspector. What sparx keeps is everything AROUND that,
// in the strip above the engine: WHICH email you're editing (the switcher), the
// email's name, its lifecycle (new · rename · delete · customize-for-this-site ·
// publish), a merge-tag reference, a branded preview, and the unsaved-work net.
//
// There is no separate list. The switcher IS the list — the whole catalog loads
// once (each email carries its own draft document), and switching is in-memory.
//
// EXPLICIT SAVE, on purpose — and this is the one place the workbench deliberately
// DIVERGES from the dashboard's version of this screen, which debounce-autosaves.
// Autosave was removed platform-wide: silica hands back the whole document on every
// edit, we hold it and mark the pane dirty, and nothing reaches the server until
// the operator presses Save. That is why this is a pane — the dirty dot, the
// close-guard and the per-site layout are the safety net a modal would sit outside
// of — and it is why SWITCHING or CREATING with unsaved edits stops to confirm
// rather than quietly flushing the burst the way the dashboard does.
//
// The canvas is a live preview in its own right: silica resolves `{{merge.tags}}`
// against sample data as you type, so a `{{customer.firstName}}` reads as a real
// name on screen, and it renders the send's brand frame (brand bar/wordmark/legal
// footer) as inert chrome around the body (silicaui 0.34). The "Preview" here is the
// STEP BEYOND that — the final, email-safe projected HTML, rendered by the server
// (real client rendering, real per-recipient data), not the canvas approximation.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Heading,
  Input,
  NativeSelect,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import {
  Check,
  Copy,
  Eye,
  Pencil,
  Plus,
  Save,
  SplitSquareHorizontal,
  Tags,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { EmailBuilder } from '@wizeworks/silicaui-builder/email/react';
import type { EmailBuilderHost } from '@wizeworks/silicaui-builder/email/react';
import type {
  EmailColorDefaults,
  EmailDocument,
  EmailProject,
} from '@wizeworks/silicaui-builder/email';
import { THEME_PRESETS, type Theme } from '@wizeworks/silicaui-html';
import { compileThemeForTenant, compiledToSilicaTheme } from '@sparx/site-themes';
import {
  createSilicaResolver,
  defaultSilicaFormat,
  emailMergeTags,
  EMAIL_SOURCES,
  groupMergeTags,
  SAMPLE_EMAIL_DATA,
  toSilicaDataSources,
  type MergeTag,
} from '@sparx/builder-schemas';
import { WelcomeEmptyState } from '../../../components/welcome-empty-state';
import { PaneScope } from '../../../lib/dock/window-boundary';
import { useConfirm } from '../../../lib/confirm';
import { useDirtySource } from '../../../lib/workbench/dirty';
import { useActiveSiteId, useSites } from '../../../lib/api/shell-data';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import {
  effectiveTenantBrand,
  emailErrorMessage,
  emailStatus,
  useCreateEmail,
  useCustomizeEmailForSite,
  useDeleteEmail,
  useEmailChrome,
  useEmails,
  usePreviewEmail,
  usePublishEmail,
  useRenameEmail,
  useSaveEmailDoc,
  useSendEmailTest,
  useSiteBrandInfos,
  useSiteBuilderConfig,
  useTenantBrand,
  type EmailDesign,
  type EmailPreview,
} from './email-data';

/** The neutral fallback theme — used only until the tenant brand loads, or if the
 *  brand/config read fails. The compiled tenant brand (below) is what normally
 *  seeds the canvas; either way the theme only tints NEW blocks and the SEND
 *  re-resolves the real per-site brand (docs/120), so it never decides the shipped
 *  look. */
const FALLBACK_THEME: Theme = THEME_PRESETS[0]!;

/** The FIXED semantic status colours the send applies (`@sparx/email/silica`
 *  `brand-colors.ts` SEMANTIC) — a success is green for every tenant, a warning
 *  amber, independent of the brand palette. Overlaid onto the canvas theme's own
 *  `--color-{info,success,warning,error}` tokens so silica's live repaint
 *  (`setColorDefaults`) paints the ✓ Confirmed / warning / error cues on the EDIT
 *  canvas with the EXACT hexes the send does — otherwise the compiled theme's own
 *  semantic tokens (a different green) drift the canvas from the Preview.
 *
 *  KEEP IN SYNC with `packages/email/src/silica/brand-colors.ts` SEMANTIC — the two
 *  are the same fixed constants, deliberately duplicated (a client component must
 *  not pull the server email package into its bundle), the same way the builder
 *  live-sync wire contract is duplicated from api-rest. */
const EMAIL_SEMANTIC_TOKENS: Record<string, string> = {
  '--color-info': '#1d4ed8',
  '--color-success': '#15803d',
  '--color-warning': '#b45309',
  '--color-error': '#b91c1c',
};

/** Turn the send's resolved role→hex map (`EmailChrome.colors`, from the server) into
 *  the silica `Theme` the canvas reads. silica's `resolveEmailColorDefaults` pulls each
 *  role straight back off these `--color-*` tokens, so `resolveEmailColorDefaults(theme)`
 *  === the send's map — the canvas repaints every `*Auto` field in EXACTLY the colours
 *  the inbox gets (brand primary/base + the fixed semantics), instead of the site page
 *  theme, which can diverge or fail to resolve and drop the canvas to silica's neutral
 *  defaults (the black button). */
function emailColorsToTheme(c: EmailColorDefaults): Theme {
  return {
    name: 'email-brand',
    mode: 'light',
    tokens: {
      '--color-primary': c.primary,
      '--color-primary-content': c.primaryContent,
      '--color-base-content': c.baseContent,
      '--color-base-100': c.base100,
      '--color-base-200': c.base200,
      '--color-base-300': c.base300,
      '--color-secondary': c.secondary,
      '--color-accent': c.accent,
      '--color-neutral': c.neutral,
      '--color-info': c.info,
      '--color-success': c.success,
      '--color-warning': c.warning,
      '--color-error': c.error,
    },
    dark: {},
  };
}

/** The email binding vocabulary as silica data sources — drives the built-in
 *  binding picker and the inline `{{` autocomplete. Static (the email sources are
 *  code-defined), so built once at module load rather than per render. */
const DATA_SOURCES = toSilicaDataSources(EMAIL_SOURCES);

/** The sparx `EmailBuilderHost`: the SAME resolver the storefront and the send use,
 *  over the email sample data — so the canvas resolves bindings and merge tags
 *  exactly as a real send does. `hideWhenEmpty` matches the send's conditional (a
 *  bound block with no value is dropped, not left showing an empty label). */
const HOST: EmailBuilderHost = (() => {
  const resolver = createSilicaResolver({
    root: SAMPLE_EMAIL_DATA,
    format: defaultSilicaFormat,
    hideWhenEmpty: true,
  });
  return {
    resolveBinding: resolver.resolveBinding,
    resolveCollection: resolver.resolveCollection,
    dataSources: () => DATA_SOURCES,
  };
})();

/** The merge tags an author can drop into copy, grouped by where each comes from.
 *  Static — the flat email token set doesn't change per tenant. */
const MERGE_GROUPS = groupMergeTags(emailMergeTags());

export function EmailEditorSurface({ ctx }: { ctx: SurfaceContext }) {
  return <EmailStudio ctx={ctx} />;
}

function EmailStudio({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: emails, isPending, isError, refetch } = useEmails();
  const { data: sites } = useSites();
  const { data: activeSite } = useActiveSiteId();

  // Everything the canvas needs to render the email as it SHIPS, resolved server-side
  // from the active site's EMAIL brand (docs/impl transactional-email §7): the inert
  // `frame` (brand bar/wordmark/legal footer, silicaui 0.34) AND the exact `colors`
  // map the send paints with. Feeding `colors` to the canvas theme is what makes the
  // edit canvas match the inbox — silica's `setColorDefaults` repaints every `*Auto`
  // block from it, in the brand primary/base + fixed semantics the send uses, instead
  // of the site PAGE theme (which for some sites resolves to nothing and drops the
  // canvas to silica's neutral defaults — the black button).
  const chrome = useEmailChrome();
  const chromeSettled = !chrome.isLoading;

  // The site page theme + brand — the FALLBACK colour source, used only until the
  // chrome read settles or if it fails. (Left in place so a chrome hiccup degrades to
  // the previous behaviour rather than a bare canvas.)
  const brand = useTenantBrand();
  const siteConfig = useSiteBuilderConfig();
  const siteBrands = useSiteBrandInfos();
  const brandSettled = !brand.isLoading && !siteConfig.isLoading;

  const canvasTheme = useMemo<Theme>(() => {
    // The real thing: the send's own resolved colour map → the canvas repaints in
    // exactly the inbox colours. Everything below is the fallback for before this
    // settles / if it failed.
    if (chrome.data?.colors) return emailColorsToTheme(chrome.data.colors);
    if (!brand.data || !siteConfig.data) return FALLBACK_THEME;
    try {
      const property = siteBrands.data?.find((s) => s.id === activeSite?.propertyId);
      const effective = effectiveTenantBrand(
        brand.data,
        property?.isPrimary ?? true,
        property?.brandOverride
      );
      const compiled = compileThemeForTenant({
        themeKey: siteConfig.data.themeKey,
        brand: effective,
        presentation: siteConfig.data.draftSettings?.presentation ?? null,
      });
      const silica = compiledToSilicaTheme(compiled, siteConfig.data.themeKey);
      // Overlay the send's FIXED semantic status colours so the canvas repaints the
      // status cues exactly as the Preview/send does (the compiled theme carries its
      // own, differing, semantic tokens).
      return { ...silica, tokens: { ...silica.tokens, ...EMAIL_SEMANTIC_TOKENS } };
    } catch {
      return FALLBACK_THEME;
    }
  }, [chrome.data, brand.data, siteConfig.data, siteBrands.data, activeSite?.propertyId]);

  // The email being edited. Starts unresolved; an effect settles it once the
  // catalog loads — to the deep-linked id, else the first email. `{id:'new'}`
  // deep-links into the "create one now" path instead.
  const paramId = typeof ctx.params.id === 'string' ? ctx.params.id : undefined;
  const [activeId, setActiveId] = useState<string | null>(null);
  const openedNewRef = useRef(false);

  // The live document for the active email. Seeded from the catalog EXACTLY ONCE
  // per email (guarded by the id it was seeded for), then owned by silica's
  // onChange — so a background refetch never overwrites unsaved edits, and Save /
  // Publish read the CURRENT document.
  const docRef = useRef<EmailDocument | null>(null);
  const seededForId = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rendered, setRendered] = useState<EmailPreview | null>(null);

  const active: EmailDesign | null = activeId
    ? (emails?.find((e) => e.id === activeId) ?? null)
    : null;

  // The one-time-per-email seed. Done in render (not an effect) so the document is
  // in place on the SAME render the switcher remounts `<EmailBuilder>` (via its
  // `key`) — an effect would remount with the previous email's document first.
  // Guarded by `seededForId`, so it runs once per email; the render-phase state
  // reset is the supported "adjust state when the key changes" pattern.
  if (active && seededForId.current !== active.id) {
    seededForId.current = active.id;
    docRef.current = active.silicaDoc as EmailDocument;
    setDirty(false);
  }

  const create = useCreateEmail();
  const targetId = activeId ?? '';
  const rename = useRenameEmail(targetId);
  const save = useSaveEmailDoc(targetId);
  const publish = usePublishEmail(targetId);
  const preview = usePreviewEmail(targetId);
  const remove = useDeleteEmail(targetId);
  const sendTest = useSendEmailTest(targetId);
  const customize = useCustomizeEmailForSite();

  const createNew = useCallback(async () => {
    try {
      const email = await create.mutateAsync({ name: 'Untitled email' });
      setActiveId(email.id);
      // Land straight in rename: a fresh email's first job is a name.
      setNameDraft(email.name);
      setRenaming(true);
    } catch (error) {
      toast.add({
        title: 'Could not create an email',
        description: emailErrorMessage(error, 'Nothing was changed. Try again.'),
        type: 'error',
      });
    }
  }, [create, toast]);

  // Settle the active email once the catalog loads.
  useEffect(() => {
    if (!emails) return;
    if (paramId === 'new' && !openedNewRef.current) {
      openedNewRef.current = true;
      void createNew();
      return;
    }
    if (activeId && emails.some((e) => e.id === activeId)) return;
    const deep = paramId && paramId !== 'new' ? emails.find((e) => e.id === paramId) : undefined;
    setActiveId(deep?.id ?? emails[0]?.id ?? null);
  }, [emails, paramId, activeId, createNew]);

  // Keep the tab label in step with the active email.
  useEffect(() => {
    ctx.setTitle(active ? active.name : 'Emails');
  }, [ctx, active]);

  // Focus + select the name on entering rename mode (rather than autoFocus, which
  // trips a11y and can steal focus on mount).
  useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  useDirtySource(dirty, 'This email has unsaved changes. Close it anyway?');

  const onChange = useCallback((project: EmailProject) => {
    const doc = project.templates[0]?.document;
    if (!doc) return;
    docRef.current = doc;
    setDirty(true);
  }, []);

  const onSave = useCallback(async () => {
    const doc = docRef.current;
    if (!doc || !activeId) return;
    try {
      await save.mutateAsync(doc);
      setDirty(false);
    } catch (error) {
      toast.add({
        title: 'Could not save',
        description: emailErrorMessage(error, 'Nothing was saved. Try again.'),
        type: 'error',
      });
    }
  }, [activeId, save, toast]);

  /** True if it's safe to leave the current email — clean, or the operator chose to
   *  discard. This is what stands in for the dashboard's silent autosave-on-switch:
   *  we never lose a burst without asking. */
  const confirmLeave = useCallback(async () => {
    if (!dirty) return true;
    return confirm({
      title: 'Discard unsaved changes?',
      description: `“${active?.name ?? 'This email'}” has changes you haven't saved. Leaving loses them — save first if you want to keep them.`,
      confirmLabel: 'Discard and continue',
      cancelLabel: 'Keep editing',
      color: 'warning',
    });
  }, [active?.name, confirm, dirty]);

  const attemptSwitch = async (nextId: string) => {
    if (nextId === activeId) return;
    if (!(await confirmLeave())) return;
    setRenaming(false);
    setActiveId(nextId);
  };

  const onNewEmail = async () => {
    if (!(await confirmLeave())) return;
    await createNew();
  };

  // silica's own "Send test" — it hands back the HTML it projected, but we ignore
  // it and let the SERVER render: only the send path applies the real brand,
  // composes the wordmark/legal frame, and resolves real data. Save first so the
  // server renders the current draft, not the last-saved one.
  const onSendTest = useCallback(
    async ({ to }: { to: string }) => {
      await onSave();
      try {
        await sendTest.mutateAsync(to);
      } catch (error) {
        // Thrown so it surfaces inside silica's own send-test dialog.
        throw new Error(emailErrorMessage(error, 'Test send failed.'));
      }
    },
    [onSave, sendTest]
  );

  const commitName = () => {
    setRenaming(false);
    const next = nameDraft.trim();
    if (!active || next === '' || next === active.name) return;
    ctx.setTitle(next);
    rename.mutate(next, {
      onError: (error) => {
        toast.add({
          title: 'Could not rename',
          description: emailErrorMessage(error, 'The name was left as it was.'),
          type: 'error',
        });
      },
    });
  };

  const onPreview = async () => {
    await onSave();
    try {
      const result = await preview.mutateAsync();
      setRendered(result);
      setPreviewOpen(true);
    } catch (error) {
      toast.add({
        title: 'Could not build a preview',
        description: emailErrorMessage(error, 'Try again in a moment.'),
        type: 'error',
      });
    }
  };

  const onPublish = async () => {
    if (!active) return;
    const ok = await confirm({
      title: `Publish “${active.name}”?`,
      description:
        'Publishing makes this exact design the one your customers receive from now on. Your current draft is saved and captured as the live version.',
      confirmLabel: 'Save and publish',
      cancelLabel: 'Keep editing',
      color: 'warning',
    });
    if (!ok) return;
    await onSave();
    publish.mutate(undefined, {
      onSuccess: () => {
        toast.add({
          title: `${active.name} published`,
          description: 'Recipients now get this version.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not publish',
          description: emailErrorMessage(error, 'Your draft is still saved. Try again.'),
          type: 'error',
        });
      },
    });
  };

  const onDelete = async () => {
    if (!active) return;
    const ok = await confirm({
      title: `Delete “${active.name}”?`,
      description:
        'This permanently removes the email and everything in it. This cannot be undone.',
      confirmLabel: 'Delete email',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    const removedId = active.id;
    remove.mutate(undefined, {
      onSuccess: () => {
        setDirty(false);
        // Move to another email rather than closing the studio — this is the whole
        // module, not one document's pane.
        const next = (emails ?? []).find((e) => e.id !== removedId);
        setActiveId(next?.id ?? null);
        toast.add({ title: `${active.name} deleted`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete',
          description: emailErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onCustomize = async () => {
    if (!active?.key || !activeSite?.propertyId) return;
    const key = active.key;
    try {
      const override = await customize.mutateAsync({ propertyId: activeSite.propertyId, key });
      setActiveId(override.id);
      toast.add({
        title: 'Made a version for this site',
        description: 'Changes here now apply to this site only.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Could not customize for this site',
        description: emailErrorMessage(error, 'Nothing was changed.'),
        type: 'error',
      });
    }
  };

  // A failed load replaces the studio — never an empty canvas beside dead controls.
  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Alert color="error" variant="soft" className="max-w-md">
          <AlertContent>
            <AlertTitle>Could not load your emails</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server, or the site builder is switched off for this
              account. Your emails are unaffected.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="error"
            variant="soft"
            onClick={() => {
              void refetch();
            }}
          >
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  // The catalog seeds defaults on first read, so an empty result is a genuine
  // "none exist" — offer the first one rather than a dead screen.
  if (!isPending && emails?.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <WelcomeEmptyState
          title="No emails yet"
          description="Create your first email — it opens straight into the editor."
          actions={
            <Button
              size="sm"
              color="module"
              loading={create.isPending}
              onClick={() => {
                void createNew();
              }}
            >
              <Plus className="size-4" aria-hidden />
              New email
            </Button>
          }
        />
      </div>
    );
  }

  const doc = docRef.current;
  // Also wait for the canvas colours to settle so the editor opens in the send's real
  // colours from first paint — never a flash of silica's neutral defaults that then
  // repaints. "Settled" is loaded-or-failed for BOTH the chrome (colours + frame) and
  // the fallback brand read, so an errored read falls straight through to the fallback
  // rather than hanging the studio.
  if (isPending || !emails || !active || !doc || !chromeSettled || !brandSettled) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  const status = emailStatus(active);
  const isCustom = active.key === null;
  const multiSite = (sites?.length ?? 0) > 1;
  const canCustomize = multiSite && active.scope === 'tenant' && active.key !== null;
  const busy =
    save.isPending ||
    publish.isPending ||
    preview.isPending ||
    create.isPending ||
    remove.isPending ||
    customize.isPending;

  // ONE toolbar — the same move the site Editor makes (studio-surface.tsx). The
  // switcher, its lifecycle (rename/new/delete/customize), the status badge, and the
  // editor actions (merge tags/Preview/Publish/Save) are all HOST concerns silica
  // knows nothing about, so they ride in `toolbarSlot` — silica renders them in its
  // own editor header, right before its Send-test/Export buttons, instead of a
  // second bar stacked above the canvas. `flex-wrap` lets a narrow pane drop to a
  // second line rather than crush the switcher.
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {renaming ? (
        <Input
          ref={renameInputRef}
          color="module"
          size="sm"
          className="w-44 @lg:w-56"
          aria-label="Email name"
          value={nameDraft}
          onChange={(event) => {
            setNameDraft(event.target.value);
          }}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setNameDraft(active.name);
              setRenaming(false);
            }
          }}
        />
      ) : (
        <NativeSelect
          color="module"
          size="sm"
          className="w-44 @lg:w-56"
          aria-label="Which email"
          value={active.id}
          disabled={busy}
          onChange={(event) => {
            void attemptSwitch(event.target.value);
          }}
        >
          {emails.map((email) => (
            <option key={email.id} value={email.id}>
              {email.name}
            </option>
          ))}
        </NativeSelect>
      )}
      <Button
        size="sm"
        variant="ghost"
        color="neutral"
        shape="square"
        aria-label="Rename this email"
        title="Rename this email"
        disabled={busy || renaming}
        onClick={() => {
          setNameDraft(active.name);
          setRenaming(true);
        }}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        color="neutral"
        shape="square"
        aria-label="New email"
        title="New email"
        disabled={busy}
        onClick={() => {
          void onNewEmail();
        }}
      >
        <Plus className="size-4" aria-hidden />
      </Button>
      {isCustom ? (
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          shape="square"
          aria-label="Delete this email"
          title="Delete this email"
          loading={remove.isPending}
          disabled={busy}
          onClick={() => {
            void onDelete();
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      ) : null}

      <Badge color={status.tone} variant="soft" size="sm">
        {status.label}
      </Badge>
      {active.scope === 'site' ? (
        <Badge color="module" variant="soft" size="sm">
          This site only
        </Badge>
      ) : canCustomize ? (
        <Button
          size="sm"
          variant="outline"
          color="neutral"
          loading={customize.isPending}
          disabled={busy}
          title={`Make a version of this email just for ${sites?.find((s) => s.id === activeSite?.propertyId)?.name ?? 'this site'}`}
          onClick={() => {
            void onCustomize();
          }}
        >
          <SplitSquareHorizontal className="size-4" aria-hidden />
          <span className="hidden @lg:inline">Customize for this site</span>
        </Button>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <MergeTagsMenu />
        <Button
          size="sm"
          variant="outline"
          color="neutral"
          loading={preview.isPending}
          disabled={busy}
          onClick={() => {
            void onPreview();
          }}
        >
          <Eye className="size-4" aria-hidden />
          <span className="hidden @md:inline">Preview</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          color="neutral"
          loading={publish.isPending}
          disabled={busy}
          onClick={() => {
            void onPublish();
          }}
        >
          <Upload className="size-4" aria-hidden />
          <span className="hidden @md:inline">Publish</span>
        </Button>
        <Button
          size="sm"
          color="module"
          disabled={!dirty || busy}
          loading={save.isPending}
          onClick={() => {
            void onSave();
          }}
        >
          <Save className="size-4" aria-hidden />
          {dirty ? 'Save' : 'Saved'}
        </Button>
      </div>
    </div>
  );

  // silica fills the pane — its editor header (carrying `toolbar`), Insert palette,
  // canvas, and Design inspector are the whole surface, exactly like the site
  // Editor's `<Builder>`. `key` remounts the engine when the switcher moves to
  // another email so it loads that document.
  return (
    <div className="h-full">
      <EmailBuilder
        key={active.id}
        document={doc}
        host={HOST}
        theme={canvasTheme}
        frame={chrome.data?.frame ?? undefined}
        onChange={onChange}
        onSendTest={onSendTest}
        persistKey={null}
        toolbarSlot={toolbar}
      />

      {rendered ? (
        <PreviewDialog
          open={previewOpen}
          preview={rendered}
          onOpenChange={(next) => {
            setPreviewOpen(next);
          }}
        />
      ) : null}
    </div>
  );
}

/** The merge-tag reference — the vocabulary of `{{tokens}}` an author can drop into
 *  copy, grouped by where each comes from, each copyable. Insertion itself is
 *  native: typing `{{` in any text block on the canvas autocompletes from the same
 *  set. This is the discoverable index of what's available. */
function MergeTagsMenu() {
  return (
    <PaneScope>
      <Popover>
        <PopoverTrigger>
          <Button size="sm" variant="outline" color="neutral">
            <Tags className="size-4" aria-hidden />
            <span className="hidden @md:inline">Merge tags</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex max-h-96 w-80 flex-col overflow-hidden p-0">
          <div className="border-base-300 border-b px-3 py-2">
            <Heading level={2} className="text-sm font-semibold">
              Personalize with merge tags
            </Heading>
            <Text className="text-sm">
              Type <code className="bg-base-200 rounded px-1 font-mono text-xs">{'{{'}</code> in any
              text to insert one, or copy a tag below.
            </Text>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {MERGE_GROUPS.map((group) => (
              <div key={group.source.key} className="px-3 py-2">
                <Text className="text-xs font-semibold">{group.source.label}</Text>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {group.tags.map((tag) => (
                    <MergeTagItem key={tag.token} tag={tag} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </PaneScope>
  );
}

function MergeTagItem({ tag }: { tag: MergeTag }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tag.token);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      toast.add({
        title: 'Could not copy',
        description: 'Select the tag and copy it manually.',
        type: 'error',
      });
    }
  };

  return (
    <li>
      <button
        type="button"
        className="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1 text-left"
        onClick={() => {
          void copy();
        }}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <code className="font-mono text-sm break-all">{tag.token}</code>
          {tag.sample ? <span className="text-xs">e.g. {tag.sample}</span> : null}
        </span>
        {copied ? (
          <Check className="size-4 shrink-0" aria-hidden />
        ) : (
          <Copy className="size-4 shrink-0" aria-hidden />
        )}
      </button>
    </li>
  );
}

/** The final, email-safe render of the draft — what a recipient actually receives,
 *  brand frame and all. In an isolated iframe so the email's own inline styles
 *  can't leak into (or be broken by) the app's. A read-only view that holds no
 *  work, so a dialog is right: abandoning it loses nothing. */
function PreviewDialog({
  open,
  preview,
  onOpenChange,
}: {
  open: boolean;
  preview: EmailPreview;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <PaneScope>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle>Preview</DialogTitle>
            <DialogClose>
              <Button size="sm" variant="ghost" color="neutral" shape="square" aria-label="Close">
                <X className="size-4" aria-hidden />
              </Button>
            </DialogClose>
          </div>
          <div className="border-base-300 flex flex-col gap-0.5 border-b pb-2">
            <Text className="text-xs">What lands in the inbox as</Text>
            <Text className="font-medium">
              {preview.subject.trim() === '' ? 'No subject line' : preview.subject}
            </Text>
          </div>
          <iframe
            title="Email preview"
            srcDoc={preview.html}
            className="bg-base-100 min-h-0 w-full flex-1 rounded border-0"
          />
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
