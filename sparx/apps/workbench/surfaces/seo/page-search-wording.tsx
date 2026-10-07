'use client';

// A page's search-result words, changed where the check that grades them is read.
//
// The page check said "a very short title wastes the best chance you have of
// being found" and "the page has a short summary: not written yet" under
// Gillett Diesel's About page, and neither could be changed from there (sparx
// persona issue 133). The only other home for these two fields is a panel at the
// foot of the editor's Settings tab, shown only once the page's own root is
// selected in Layers: the editor cannot be opened onto it. So for a site page,
// the two fields the checks grade sit here, beside the advice.
//
// Same endpoint, same length rule and the same "a page that designs every
// product has no words of its own" rule as that panel (`page-settings.tsx`), so
// the two places cannot disagree. Saving re-scores the page.

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { usePageSettings, useUpdatePageSettings } from '../builder/studio/data';
import {
  lengthHint,
  recordWordingFor,
  shownTitle,
  titleFallback,
  titleLengthHint,
} from '../builder/studio/page-settings';
import { useActivePropertyId, useSites } from '../../lib/api/shell-data';

const SUMMARY_IDEAL = 160;

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function PageSearchWording({
  pageId,
  pageName,
  onSaved,
}: {
  pageId: string;
  pageName: string;
  /** Called once the words are saved, so the check can score the page again. */
  onSaved: () => void;
}) {
  const stored = usePageSettings(pageId, true);
  // The site this page is on: the console's active one, the same site the page was
  // read through. Its name is what the live site adds to the title.
  const sites = useSites();
  const activeSiteId = useActivePropertyId();
  const siteName =
    sites.data?.find((site) => site.id === activeSiteId)?.name ??
    sites.data?.find((site) => site.isPrimary)?.name ??
    '';
  const save = useUpdatePageSettings();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');

  const savedTitle = stored.data?.seoTitle ?? '';
  const savedSummary = stored.data?.seoDescription ?? '';
  useEffect(() => {
    setTitle(savedTitle);
    setSummary(savedSummary);
  }, [savedTitle, savedSummary]);

  const dirty = title.trim() !== savedTitle.trim() || summary.trim() !== savedSummary.trim();
  useDirtySource(dirty, 'The search title and summary for this page are not saved.');

  if (!stored.data) return null;

  const record = recordWordingFor(stored.data);
  if (record) {
    return (
      <Alert color="info">
        <AlertContent>
          <AlertTitle>Each {record.each} writes its own</AlertTitle>
          <AlertDescription>
            This one page shows every {record.each} you have, so the words a search result shows
            come from {record.where}. Leave a {record.each}’s own fields empty and its name and
            description are used.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  const titleHint = titleLengthHint(title, siteName, stored.data);
  const summaryHint = lengthHint(summary, SUMMARY_IDEAL);

  return (
    <section className="card bg-base-100 flex flex-col gap-4 p-4">
      <div className="border-base-300 flex flex-col gap-0.5 border-b pb-2">
        <Heading level={2} className="text-lg font-semibold">
          How it shows up in search
        </Heading>
        <Text className="text-sm">
          The headline and the couple of lines people read before they decide to click.
        </Text>
      </div>

      <Field>
        <FieldLabel>Search title</FieldLabel>
        <FieldControl
          render={
            <Input
              value={title}
              placeholder={titleFallback(pageName, siteName, stored.data)}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setTitle(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>
          {titleHint
            ? titleHint.text
            : `Empty, so search shows “${shownTitle('', pageName, siteName, stored.data)}”. Say what the page is, in your customers’ words: 30 to 60 characters.`}
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Summary</FieldLabel>
        <FieldControl
          render={
            <Textarea
              rows={3}
              value={summary}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                setSummary(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>
          {summaryHint
            ? summaryHint.text
            : 'Not written yet. A sentence or two that makes someone want to click: up to 160 characters.'}
        </FieldDescription>
      </Field>

      <div className="flex justify-end">
        <Button
          color="module"
          disabled={!dirty || save.isPending}
          loading={save.isPending}
          onClick={() => {
            save.mutate(
              {
                pageId,
                settings: { seoTitle: blankToNull(title), seoDescription: blankToNull(summary) },
              },
              {
                onSuccess: () => {
                  toast.add({ title: 'Saved. Checking the page again.', type: 'success' });
                  void stored.refetch();
                  onSaved();
                },
                onError: () => {
                  toast.add({
                    title: 'That did not save',
                    description: 'The title and summary are as they were. Try again.',
                    type: 'error',
                  });
                },
              }
            );
          }}
        >
          Save
        </Button>
      </div>
    </section>
  );
}
