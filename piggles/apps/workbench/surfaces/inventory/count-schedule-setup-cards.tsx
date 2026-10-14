'use client';

// The schedule's name, its location, and what stock it covers.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  Heading,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { plural, type StockLocation } from './data';
import { abcLabel, abcTone, type AbcClass, type useCountScheduleCoverage } from './planning-data';
import type { Draft } from './count-schedule-draft';

interface FieldProps {
  draft: Draft;
  patch: (next: Partial<Draft>) => void;
}

export function CountScheduleNameCard({
  draft,
  patch,
  isNew,
  activeLocations,
}: FieldProps & { isNew: boolean; activeLocations: StockLocation[] }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <label className="flex flex-col gap-1">
        <span className="text-base">What to call it</span>
        <Input
          value={draft.name}
          placeholder="Top-value stock, monthly"
          onChange={(event) => {
            patch({ name: event.target.value });
          }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-base">Which location</span>
        <NativeSelect
          value={draft.warehouseId}
          disabled={!isNew}
          onChange={(event) => {
            patch({ warehouseId: event.target.value });
          }}
        >
          <option value="">Choose a location…</option>
          {activeLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </NativeSelect>
        {!isNew ? (
          <span className="text-sm">
            A schedule belongs to its location. Set up another one to cover somewhere else.
          </span>
        ) : null}
      </label>
    </Card>
  );
}

function StockClassField({ draft, patch }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-base">Which stock</span>
      <NativeSelect
        value={draft.abcClass}
        onChange={(event) => {
          patch({ abcClass: event.target.value as '' | AbcClass });
        }}
      >
        <option value="">Everything at this location</option>
        <option value="A">Top-value stock only</option>
        <option value="B">Mid-value stock only</option>
        <option value="C">The long tail only</option>
      </NativeSelect>
      {draft.abcClass ? (
        <span className="text-sm">
          <Badge color={abcTone(draft.abcClass)} variant="soft" size="sm">
            {abcLabel(draft.abcClass)}
          </Badge>{' '}
          is worked out from what you actually use in a year, and it is kept up to date overnight,
          so this schedule follows the stock, not a list you have to maintain.
        </span>
      ) : null}
    </label>
  );
}

type Coverage = ReturnType<typeof useCountScheduleCoverage>['data'];

interface CoverageNoticeProps {
  coverage: Coverage;
  narrowedBy: string[];
  widenSentence: string;
}

// Said HERE, before saving: a schedule covering nothing looks exactly like one
// covering everything until the counts fail to appear (issue 499).
function CoverageNotice({ coverage, narrowedBy, widenSentence }: CoverageNoticeProps) {
  if (!coverage) return null;
  if (coverage.coveredLevels !== 0) {
    return (
      <Text className="text-sm">
        {plural(coverage.coveredLevels, 'item', 'items')} would be covered by this.
      </Text>
    );
  }
  return (
    <Alert color="warning" variant="soft">
      <AlertContent>
        <AlertTitle>Nothing is covered by this</AlertTitle>
        <AlertDescription>
          {narrowedBy.length === 0
            ? 'There is no stock at this location at all, so this schedule would never raise a count. Pick the place your stock actually sits.'
            : `Nothing at this location matches ${narrowedBy.join(' and ')}, so this schedule would never raise a count. ${widenSentence}, or pick the place your stock actually sits.`}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

export function CountScheduleCoverageCard({
  draft,
  patch,
  ...notice
}: FieldProps & CoverageNoticeProps) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <Heading level={3} className="text-base">
        What it covers
      </Heading>
      <Text className="text-sm">
        Counting where the money is often, and the long tail rarely, covers a whole catalog for a
        fraction of the effort of a full stocktake.
      </Text>

      <StockClassField draft={draft} patch={patch} />

      <label className="flex flex-col gap-1">
        <span className="text-base">Narrow to one zone (optional)</span>
        <Input
          value={draft.zoneName}
          placeholder="e.g. Mezzanine"
          onChange={(event) => {
            patch({ zoneName: event.target.value });
          }}
        />
        <span className="text-sm">
          Leave blank for the whole location. A zone is whatever you named it on your shelves.
        </span>
      </label>

      <CoverageNotice {...notice} />
    </Card>
  );
}
