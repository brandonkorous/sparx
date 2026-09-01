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
} from '@wizeworks/silicaui-react';

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formChoiceLabel, useFormChoices } from './form-settings-data';
import { SETTINGS_COLUMN } from './form-settings-column';

export function FormSettingsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const { data: forms, isLoading, isError, refetch } = useFormChoices();

  useEffect(() => {
    ctx.setTitle('Form settings');
  }, [ctx]);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            title="Could not load your forms"
            description="This is a problem reaching the server. Your forms, and everything people have sent through them, are unaffected."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isLoading || !forms) return <PaneWaiting />;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Form settings controls" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={SETTINGS_COLUMN}>
          {forms.length === 0 ? (
            <Alert color="info" variant="soft">
              <AlertContent>
                <AlertTitle>No forms on this site yet</AlertTitle>
                <AlertDescription>
                  Add a form to a page in My Site — an enquiry form, a callback request, an email
                  sign-up — and it will appear here so you can say who should hear about it.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : (
            <FormSection
              title="Which form?"
              description="Each form on your site has its own settings: what it is called, who gets told, and what the person who filled it in hears back."
            >
              <div className="flex flex-col gap-2">
                {forms.map((choice) => (
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
