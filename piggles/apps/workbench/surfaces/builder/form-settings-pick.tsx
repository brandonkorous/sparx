'use client';

// Every form on this site, to pick one to configure: a list/detail pair like every
// other builder surface. A site usually has one or two forms, so no search.

import { useEffect } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  Text,
} from '@wizeworks/silicaui-react';

import { faFileLines } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formChoiceLabel, useFormChoices } from './form-settings-data';
import { MODULE, SETTINGS_COLUMN } from './form-settings-column';

type FormChoicesQuery = ReturnType<typeof useFormChoices>;

function countWords(count: number): string {
  if (count === 0) return 'No forms on this site';
  return count === 1 ? '1 form' : `${String(count)} forms`;
}

function FormsToolbar({ query }: { query: FormChoicesQuery }) {
  const { data: forms, isLoading, isError, isFetching, dataUpdatedAt, refetch } = query;
  return (
    <PaneToolbar
      label="Form settings controls"
      status={
        <>
          <Icon glyph={faFileLines} className="size-4 shrink-0" aria-hidden />
          {/* How many forms the site has: the one fact worth having before the list. */}
          <Text as="span" className="shrink-0 text-sm whitespace-nowrap">
            {countWords((forms ?? []).length)}
          </Text>
        </>
      }
      statusReady={!isLoading}
      statusFailed={isError}
      refresh={
        <RefreshButton
          isFetching={isFetching}
          updatedAt={forms ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      }
    />
  );
}

function FormsBody({ ctx, query }: { ctx: SurfaceContext; query: FormChoicesQuery }) {
  const { data: forms, isLoading, isError, error, refetch } = query;
  const rows = forms ?? [];
  if (isError) {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          module={MODULE}
          title="Could not load your forms"
          description="This is a problem reaching the server. Your forms, and everything people have sent through them, are unaffected."
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      </Card>
    );
  }
  if (isLoading || !forms) {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneWaiting module={MODULE} />
      </Card>
    );
  }
  if (rows.length === 0) return <NoFormsYet />;
  return <FormPicker ctx={ctx} rows={rows} />;
}

function NoFormsYet() {
  return (
    <Alert color="info" variant="soft">
      <AlertContent>
        <AlertTitle>No forms on this site yet</AlertTitle>
        <AlertDescription>
          Add a form to a page in My Site (an inquiry form, a callback request, an email sign-up)
          and it will appear here so you can say who should hear about it.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function FormPicker({
  ctx,
  rows,
}: {
  ctx: SurfaceContext;
  rows: NonNullable<FormChoicesQuery['data']>;
}) {
  return (
    <FormSection
      title="Which form?"
      description="Each form on your site has its own settings: what it is called, who gets told, and what the person who filled it in hears back."
    >
      <div className="flex flex-col gap-2">
        {rows.map((choice) => (
          <Button
            key={choice.formNodeId}
            variant="outline"
            className="justify-start"
            onClick={() => {
              ctx.open('builder.form-setting', { formNodeId: choice.formNodeId });
            }}
          >
            {formChoiceLabel(choice)}
          </Button>
        ))}
      </div>
    </FormSection>
  );
}

export function FormSettingsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const query = useFormChoices();

  useEffect(() => {
    ctx.setTitle('Form settings');
  }, [ctx]);

  return (
    <div className={PANE_SHELL}>
      <FormsToolbar query={query} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Failure and waiting branch INSIDE the content region, so a failed read
            never takes the toolbar away with the list. */}
        <div className={SETTINGS_COLUMN}>
          <FormsBody ctx={ctx} query={query} />
        </div>
      </div>
    </div>
  );
}
