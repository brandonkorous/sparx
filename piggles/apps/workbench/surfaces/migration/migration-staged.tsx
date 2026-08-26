'use client';

// WHAT WE HAVE, BEFORE ANY OF IT IS SAVED.
//
// One view for both sources: a file that has been read here in the browser, or a
// live pull. They arrive in the same canonical shape and go through the same
// validator, so this shows them the same way — which is what stops the two paths
// drifting into two different accounts of the same data.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Heading,
} from '@wizeworks/silicaui-react';
import {
  faCircleExclamation,
  faExclamationTriangle,
  faRotate,
} from '@fortawesome/pro-solid-svg-icons';

import { Icon } from '@piggles/ui';
import type { MappedEntity } from '@wizeworks/migration';
import { EntityReport, FileReport } from './migration-file-report';
import type { LivePull } from './live-connection';
import type { LoadedFile } from './data';

export interface StagedSourceProps {
  loaded: LoadedFile | null;
  live: LivePull | null;
  /** Nothing here can be imported yet, so the screen says why rather than leaving
   *  a dead Import button as the only clue. */
  nothingUsable: boolean;
  onManual: (mapped: MappedEntity | null) => void;
  reset: () => void;
}

export function StagedSource({ loaded, live, nothingUsable, onManual, reset }: StagedSourceProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Heading level={2}>{live === null ? loaded?.name : live.account}</Heading>
        <Badge color="neutral" variant="outline" size="sm">
          {live === null
            ? `${((loaded?.sizeBytes ?? 0) / 1024).toFixed(0)} KB`
            : 'Read live, nothing stored'}
        </Badge>
        <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
          <Icon glyph={faRotate} className="size-4" aria-hidden />
          {live === null ? 'Use a different file' : 'Start again'}
        </Button>
      </div>

      {live === null ? (
        loaded === null ? null : (
          <FileReport loaded={loaded} onManual={onManual} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <Alert color="success" variant="soft">
            <AlertContent>
              <AlertTitle>Read from {live.account}</AlertTitle>
              <AlertDescription>
                This is everything we found, checked the same way a file is. Nothing has been saved
                to your business yet.
              </AlertDescription>
            </AlertContent>
          </Alert>
          {live.entities.map((mapped) => (
            <EntityReport key={mapped.entity} mapped={mapped} />
          ))}
        </div>
      )}

      {nothingUsable ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>
              <Icon glyph={faCircleExclamation} className="mr-2 inline size-4" aria-hidden />
              {live === null
                ? 'Nothing in this file can come across yet'
                : 'Nothing we found can come across yet'}
            </AlertTitle>
            <AlertDescription>
              {live === null
                ? 'Fix the problems listed above in your spreadsheet, then drop it in again.'
                : 'Every record we read has a problem listed above. Fixing them on your old platform and connecting again is the quickest way through.'}
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : (
        <Alert color="info">
          <AlertContent>
            <AlertTitle>
              <Icon glyph={faExclamationTriangle} className="mr-2 inline size-4" aria-hidden />
              Try a practice run first
            </AlertTitle>
            <AlertDescription>
              It checks every row against what you already have and shows you exactly what would
              happen, without saving anything.
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
    </div>
  );
}
