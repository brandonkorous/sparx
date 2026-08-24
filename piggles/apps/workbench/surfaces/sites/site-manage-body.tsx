'use client';

// The body of the manage view: where the site lives, how it is doing, and the
// two fields that name it.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Text,
} from '@wizeworks/silicaui-react';
import { faArrowUpRightFromSquare } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { productCopy } from '../../lib/product';
import { SiteTraffic, TRAFFIC_WINDOW_DAYS } from './traffic';

/** A site is a WEBSITE, so the pane opens by saying where it lives. Its NAME is
 *  the pane's tab and the rename field below, so it is not repeated here. */
export function SiteAddressLine({ host }: { host: string | null }) {
  if (!host) return <Text className="text-sm">No web address yet</Text>;
  return (
    <a
      href={`https://${host}`}
      target="_blank"
      rel="noreferrer"
      className="link inline-flex w-fit items-center gap-1 font-mono text-sm"
    >
      {host}
      <Icon glyph={faArrowUpRightFromSquare} className="size-3" aria-hidden />
    </a>
  );
}

export function SiteTrafficSection({
  propertyId,
  onOpenDomains,
}: {
  propertyId: string;
  onOpenDomains: (beside: boolean) => void;
}) {
  return (
    <FormSection
      title={`Visitors · last ${String(TRAFFIC_WINDOW_DAYS)} days`}
      description={productCopy(
        'sites.analytics.firstParty',
        'Counted by Piggles itself, without cookies, so there is nothing for visitors to accept and nothing to set up.'
      )}
      action={
        <Button
          size="sm"
          variant="ghost"
          title="Web addresses for this site"
          onClick={(event) => {
            onOpenDomains(event.shiftKey);
          }}
        >
          Web addresses
        </Button>
      }
    >
      <SiteTraffic propertyId={propertyId} />
    </FormSection>
  );
}

export function SiteNameFields({
  name,
  onName,
  handle,
  host,
}: {
  name: string;
  onName: (next: string) => void;
  handle: string;
  /** The address this handle produced, so the field explains itself with the
   *  real thing rather than describing it. */
  host: string | null;
}) {
  return (
    <FormSection
      title="Name and web address"
      description="What this site is called, and the address visitors reach it at."
    >
      <Field>
        <FieldLabel>Site name</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={name}
              onChange={(event) => {
                onName(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>What visitors see.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Web address</FieldLabel>
        <FieldControl render={<Input value={handle} readOnly disabled />} />
        <FieldDescription>
          {host ? (
            <>
              Chosen when the site was created, and fixed since:{' '}
              <span className="font-mono">{host}</span> already points at it. To move to a different
              address, connect your own domain under Web addresses.
            </>
          ) : (
            'Chosen when the site was created, and fixed since — web addresses already point at it. To move to a different address, connect your own domain under Web addresses.'
          )}
        </FieldDescription>
      </Field>
    </FormSection>
  );
}
