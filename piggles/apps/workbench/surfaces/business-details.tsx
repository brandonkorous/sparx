'use client';

// Business details: who the business IS, as a legal entity. Deliberately NOT a site;
// it is what a customer-facing DOCUMENT is issued by. Nothing is required, so there is
// no validation gate, only a Save. Its state and save live in business-details-state.ts.

import { Button } from '@wizeworks/silicaui-react';
import { faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../components/pane-toolbar';
import { RefreshButton } from '../components/refresh-button';
import { EditorLayout } from '../components/editor-layout';
import { ManagersOnly, ManagersOnlyNotice } from '../components/managers-only';
import { PaneLoadError } from '../components/pane-load-error';
import { useManageRights } from '../lib/manage-rights';
import { BusinessMainColumn, BusinessRailColumn } from './business-details-columns';
import { useBusinessDetails, type BusinessDetailsState } from './business-details-state';

function BusinessToolbar({ state }: { state: BusinessDetailsState }) {
  const rights = useManageRights();
  const { query, save, dirty, emailMalformed, setEmailTouched } = state;
  return (
    <PaneToolbar
      label="Business details actions"
      primary={
        // No Save for somebody who may not change these: the notice below says
        // so before they start (sparx persona issue 168).
        rights.known && !rights.canManage ? undefined : (
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            // A malformed address blocks the save outright: the server would answer
            // with a generic 400 that never points at the field.
            disabled={!dirty || emailMalformed || query.isPending || save.isPending}
            onClick={() => {
              setEmailTouched(true);
              save.mutate();
            }}
          >
            <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        )
      }
      refresh={
        <RefreshButton
          isFetching={query.isFetching}
          updatedAt={query.data ? query.dataUpdatedAt : undefined}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    />
  );
}

export function BusinessDetailsSurface() {
  const state = useBusinessDetails();
  const { query, form, set, setForm, zones, emailError, setEmailTouched } = state;

  // A failed load is shown INSTEAD of the form: blank fields would read as "nothing
  // filled in", and someone would retype their address into a form that cannot save.
  if (query.isError) {
    return (
      <PaneLoadError
        title="Could not load your business details"
        description="Nothing has been lost. This is a problem reaching the server, not with your saved details."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  return (
    <div className={PANE_SHELL}>
      <BusinessToolbar state={state} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ManagersOnly>
          <EditorLayout
            banner={<ManagersOnlyNotice change="change your business details" />}
            main={
              <BusinessMainColumn
                form={form}
                set={set}
                emailError={emailError}
                onEmailBlur={() => {
                  setEmailTouched(true);
                }}
              />
            }
            rail={<BusinessRailColumn form={form} set={set} setForm={setForm} zones={zones} />}
          />
        </ManagersOnly>
      </div>
    </div>
  );
}
