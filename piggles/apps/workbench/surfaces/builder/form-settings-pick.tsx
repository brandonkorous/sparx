'use client';

// Every form on this site, to pick one to configure. A list/detail pair like
// blueprints and saved pieces, because that is what every other builder surface
// does. A site usually has one or two forms, so this is a short list of real
// choices rather than a search.

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

export function FormSettingsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const { data: forms, isLoading, isError, isFetching, dataUpdatedAt, refetch } = useFormChoices();

  useEffect(() => {
    ctx.setTitle('Form settings');
  }, [ctx]);

  const rows = forms ?? [];

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Form settings controls"
        status={
          <>
            <Icon glyph={faFileLines} className="size-4 shrink-0" aria-hidden />
            {/* This bar was EMPTY: a card with a border and nothing in it. The
                one fact worth having before reading the list is how many forms
                the site has, and it is the fact the list is there to show. */}
            <Text as="span" className="shrink-0 text-sm whitespace-nowrap">
              {rows.length === 0
                ? 'No forms on this site'
                : rows.length === 1
                  ? '1 form'
                  : `${String(rows.length)} forms`}
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
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={SETTINGS_COLUMN}>
          {/* Both failure and waiting branch INSIDE the content region. They
              used to `return` before the toolbar, so a failed read took the bar
              away with the list — pane-load-error.tsx names that shape in its
              own header as the thing never to do. */}
          {isError ? (
            <Card className="min-h-0 flex-1 items-center justify-center">
              <PaneLoadError
                module={MODULE}
                title="Could not load your forms"
                description="This is a problem reaching the server. Your forms, and everything people have sent through them, are unaffected."
                onRetry={() => {
                  void refetch();
                }}
              />
            </Card>
          ) : isLoading || !forms ? (
            <Card className="min-h-0 flex-1 items-center justify-center">
              <PaneWaiting module={MODULE} />
            </Card>
          ) : rows.length === 0 ? (
            <Alert color="info" variant="soft">
              <AlertContent>
                <AlertTitle>No forms on this site yet</AlertTitle>
                <AlertDescription>
                  Add a form to a page in My Site (an inquiry form, a callback request, an email
                  sign-up) and it will appear here so you can say who should hear about it.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
