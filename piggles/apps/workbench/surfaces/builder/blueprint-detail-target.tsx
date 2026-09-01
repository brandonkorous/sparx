'use client';

// The action hub: which site, whether the examples come, and the one thing you
// can do to that site right now. They live together because every one of them
// pivots on the chosen site — splitting the picker from its button is how the two
// drift apart.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import { faRocket } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { installImpact } from './blueprints-words';
import { ExamplesField, NewSiteField, RemoveRow } from './blueprint-target-fields';
import type { NewSiteTarget } from './blueprint-new-site';
import type { Blueprint, BlueprintInstall } from './blueprints-data';

export interface TargetSectionProps {
  blueprint: Blueprint;
  sites: Record<string, string>;
  sitesLoaded: boolean;
  targetSite: string;
  targetName: string;
  onSite: (id: string) => void;
  /** How many pages the chosen site has, so this can say what adding a design
   *  does to THAT site. Undefined until the sites list lands. */
  targetPageCount: number | undefined;
  /** The picker's "A new site" option, once it is the one chosen. */
  newSite: NewSiteTarget;
  /** Does this design bring any examples at all? A design with none never asks. */
  hasExamples: boolean;
  sampleData: boolean;
  onSampleData: (next: boolean) => void;
  current: BlueprintInstall | undefined;
  busy: boolean;
  installing: boolean;
  publishing: boolean;
  removing: boolean;
  onInstall: () => void;
  onGoLive: () => void;
  onRemove: () => void;
}

export function BlueprintTargetSection(props: TargetSectionProps) {
  const { blueprint, current, targetName, targetSite, busy } = props;
  const impact = installImpact(targetName, props.targetPageCount);
  // A site that does not exist yet has nothing to lose, so the danger treatment
  // comes off entirely rather than being softened.
  const replacing = impact.replaces && !props.newSite.chosen;

  return (
    <FormSection
      title="Add it to a site"
      description="Pick which site this design goes into. You can add it to more than one."
    >
      <Field>
        <FieldLabel>Site</FieldLabel>
        {props.sitesLoaded ? (
          <Select
            color="module"
            items={props.sites}
            value={targetSite}
            aria-label="Which site to add this design to"
            onValueChange={(next) => {
              props.onSite(next as string);
            }}
          />
        ) : (
          <Text className="text-sm" role="status">
            Loading your sites…
          </Text>
        )}
        {/* What this does to the site CHOSEN, which changes as the picker does.
            The old text said only that other sites are untouched, which is true
            and is not the thing worth knowing: a design is a whole site, so
            adding one to a site that has pages replaces them. */}
        <FieldDescription>
          {props.newSite.chosen
            ? 'A new site is made for it, so the site you have now is left exactly as it is. Everything arrives as drafts only you can see.'
            : impact.sentence}
        </FieldDescription>
      </Field>

      {props.newSite.chosen ? <NewSiteField newSite={props.newSite} /> : null}

      {!current && impact.replaces && !props.newSite.chosen ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>
              {impact.pages === null
                ? `Adding this replaces what is on ${targetName}`
                : `Adding this replaces the ${impact.pages === 1 ? 'page' : `${String(impact.pages)} pages`} on ${targetName}`}
            </AlertTitle>
            <AlertDescription>
              To try it without losing this one, choose <strong>A new site</strong> above.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {!current && props.hasExamples ? (
        <ExamplesField value={props.sampleData} onChange={props.onSampleData} disabled={busy} />
      ) : null}

      {current ? (
        <>
          {current.status === 'installed' ? (
            <Button
              color="module"
              onClick={props.onGoLive}
              loading={props.publishing}
              disabled={busy && !props.publishing}
            >
              <Icon glyph={faRocket} className="size-4" aria-hidden />
              Publish it live on {targetName}
            </Button>
          ) : null}

          {current.status === 'running' ? (
            <Text className="text-sm">
              This design is still being added to {targetName}. Refresh in a moment to see it
              finish.
            </Text>
          ) : null}

          <RemoveRow
            targetName={targetName}
            removing={props.removing}
            disabled={busy && !props.removing}
            onRemove={props.onRemove}
          />
        </>
      ) : (
        // Danger when it destroys pages, and labelled with what it actually does.
        // "Add X to Y" is right for an empty site and is the wrong verb entirely
        // for a site being swapped out.
        <Button
          color={replacing ? 'danger' : 'module'}
          // Both labels name a design AND a site, and at 360px that is wider than
          // the button. Silica keeps a label on one line, so the end was simply
          // cut off — on the control that decides whether a site survives.
          className="h-auto py-2 whitespace-normal"
          disabled={targetSite === '' || busy || (props.newSite.chosen && !props.newSite.ready)}
          loading={props.installing}
          onClick={props.onInstall}
        >
          {props.newSite.chosen
            ? `Make ${props.newSite.label} from “${blueprint.name}”`
            : replacing
              ? `Replace ${targetName} with “${blueprint.name}”`
              : `Add “${blueprint.name}” to ${targetName}`}
        </Button>
      )}
    </FormSection>
  );
}
