'use client';

// A page's own settings, in the Inspector, under the page itself.
//
// Select the page in Layers and this is what you get — its address, what wraps it,
// and how it reads in search. Not a drawer with its own Save: these are edits to the
// DOCUMENT, so they mark the pane unsaved, undo with the rest, and go to the server
// on the one Save the pane already has.

import {
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';
import { NO_FRAME, type PageDoc, type PageSeo } from '@wizeworks/studio';
import { useApply, useDoc } from '@wizeworks/studio/react';
import { RecordTarget } from './page-record-target';

/** The page's chrome choice, as the three things it can mean. */
function frameValue(frame: string | null): string {
  if (frame === null) return 'site';
  if (frame === NO_FRAME) return 'none';
  return 'other';
}

export function PageSettingsPanel() {
  const doc = useDoc<PageDoc>();

  return (
    <div className="border-base-300 mt-4 flex flex-col gap-4 border-t pt-4">
      <p className="text-base-content text-sm font-medium">This page</p>
      <PageName doc={doc} />
      {doc.pageKind === 'singleton' ? <PageAddress doc={doc} /> : <RecordTarget doc={doc} />}
      <ChromeChoice doc={doc} />
      <SearchWording doc={doc} />
    </div>
  );
}

/** What the author calls this page. Not what a visitor reads. */
function PageName({ doc }: { doc: PageDoc }) {
  const apply = useApply();
  return (
    <Field>
      <FieldLabel>Name</FieldLabel>
      <Input
        key={`${doc.id}:name`}
        defaultValue={doc.name}
        onBlur={(event) => {
          const value = event.currentTarget.value.trim();
          if (!value || value === doc.name) return;
          apply('Rename page', [{ kind: 'doc.rename', value }]);
        }}
      />
      <FieldDescription>What you call it. Visitors never see this.</FieldDescription>
    </Field>
  );
}

/** How the page reads in a search result. */
function SearchWording({ doc }: { doc: PageDoc }) {
  const apply = useApply();
  const setSeo = (patch: Partial<PageSeo>) => {
    apply('Change search wording', [{ kind: 'page.setSeo', value: { ...doc.seo, ...patch } }]);
  };

  return (
    <>
      <Field>
        <FieldLabel>Title in search results</FieldLabel>
        <Input
          key={`${doc.id}:seo-title`}
          defaultValue={doc.seo.title ?? ''}
          placeholder={doc.name}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim() || null;
            if (value !== doc.seo.title) setSeo({ title: value });
          }}
        />
        <FieldDescription>Leave it empty and the page name is used.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Description in search results</FieldLabel>
        <Textarea
          key={`${doc.id}:seo-description`}
          rows={3}
          defaultValue={doc.seo.description ?? ''}
          placeholder="A sentence or two about what someone finds on this page."
          onBlur={(event) => {
            const value = event.currentTarget.value.trim() || null;
            if (value !== doc.seo.description) setSeo({ description: value });
          }}
        />
      </Field>

      <HideFromSearch hidden={doc.seo.noindex} onChange={(noindex) => setSeo({ noindex })} />
    </>
  );
}

function HideFromSearch({
  hidden,
  onChange,
}: {
  hidden: boolean;
  onChange: (hidden: boolean) => void;
}) {
  return (
    <Field>
      <FieldLabel>Keep this page out of search</FieldLabel>
      <Switch checked={hidden} onCheckedChange={onChange} />
      <FieldDescription>
        Anyone with the link can still open it — it just won’t come up in Google.
      </FieldDescription>
    </Field>
  );
}

/** Where a visitor finds this page. */
function PageAddress({ doc }: { doc: PageDoc }) {
  const apply = useApply();
  return (
    <Field>
      <FieldLabel>Address</FieldLabel>
      <Input
        key={`${doc.id}:slug`}
        defaultValue={doc.slug ?? ''}
        placeholder="/about"
        onBlur={(event) => {
          const raw = event.currentTarget.value.trim();
          // A leading slash is what the address IS, so add it rather than refusing
          // an answer that is right in every way except one character.
          const value = raw ? (raw.startsWith('/') ? raw : `/${raw}`) : null;
          if (value === doc.slug) return;
          apply('Change address', [{ kind: 'page.setSlug', value }]);
        }}
      />
      <FieldDescription>
        What comes after your web address — “/about” shows at yoursite.com/about.
      </FieldDescription>
    </Field>
  );
}

/**
 * Which header and footer wrap this page.
 *
 * Two answers, because a Piggles site has one set of chrome. A page pointing at some
 * OTHER layout is still representable — a site that came from elsewhere can carry
 * one — so it shows as a third choice rather than being silently reset to the
 * default, which would move the page without telling anyone.
 */
function ChromeChoice({ doc }: { doc: PageDoc }) {
  const apply = useApply();
  const current = frameValue(doc.frame);

  return (
    <Field>
      <FieldLabel>Header and footer</FieldLabel>
      <NativeSelect
        value={current}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (next === current) return;
          apply('Change header and footer', [
            { kind: 'page.setFrame', value: next === 'none' ? NO_FRAME : null },
          ]);
        }}
      >
        <option value="site">Use my site’s header and footer</option>
        <option value="none">No header or footer</option>
        {current === 'other' ? <option value="other">A different header and footer</option> : null}
      </NativeSelect>
      <FieldDescription>
        “No header or footer” gives you a bare page — useful for a campaign or a thank-you page.
      </FieldDescription>
    </Field>
  );
}
