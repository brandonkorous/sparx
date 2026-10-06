'use client';

// The cookie banner for THIS site, on the Legal pages screen. A pending or failed
// read shows that, never a form seeded with "Off".

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Text,
} from '@wizeworks/silicaui-react';
import { faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { SaveFailure } from '../../components/save-failure';
import { CookieBannerSummary } from './cookie-banner-summary';
import { CookieBannerFields } from './cookie-banner-fields';
import {
  useCanEditCookieBanner,
  useCookieBannerEditor,
  useSiteNameIfMany,
} from './cookie-banner-editor';
import type { ChecklistItem } from './legal-data';

export function CookieBannerSection({ cookiePolicy }: { cookiePolicy: ChecklistItem | undefined }) {
  const policyEntry = cookiePolicy?.entry ?? null;
  const editor = useCookieBannerEditor(policyEntry);
  const { known, canEdit } = useCanEditCookieBanner();
  const siteName = useSiteNameIfMany();
  const description = siteName
    ? `What visitors to ${siteName} are told about cookies, and the choices they get. Each of your sites has its own.`
    : 'What visitors to your site are told about cookies, and the choices they get.';
  const { draft } = editor;

  return (
    <FormSection title="Cookie banner" description={description}>
      {editor.settings.isError ? (
        <LoadFailure
          onRetry={() => {
            void editor.settings.refetch();
          }}
        />
      ) : draft === null ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : (
        <>
          {known && !canEdit ? (
            <Text>
              Only an account owner or admin can change the cookie banner. Ask one of them if
              something here needs changing.
            </Text>
          ) : null}
          <CookieBannerFields draft={draft} onChange={editor.setDraft} disabled={!canEdit} />
          <CookieBannerSummary
            mode={draft.mode}
            kinds={draft.kinds}
            policyPublished={policyEntry?.status === 'published'}
            unsaved={editor.viewChanged}
          />
          <SaveFailure title="Could not save the cookie banner" message={editor.failure} />
          <SaveRow
            dirty={editor.dirty}
            saving={editor.saving}
            canEdit={canEdit}
            onSave={editor.onSave}
          />
        </>
      )}
    </FormSection>
  );
}

function LoadFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>Could not load your cookie banner settings</AlertTitle>
        <AlertDescription>
          This is a problem reaching the server. Your site keeps whatever it was showing.
        </AlertDescription>
      </AlertContent>
      <Button size="sm" color="warning" variant="soft" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}

function SaveRow({
  dirty,
  saving,
  canEdit,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  canEdit: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {dirty ? (
        <Badge color="warning" variant="soft" size="sm">
          Unsaved changes
        </Badge>
      ) : null}
      <Button
        size="sm"
        color="module"
        loading={saving}
        disabled={!canEdit || !dirty}
        onClick={onSave}
      >
        <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
        Save cookie banner
      </Button>
    </div>
  );
}
