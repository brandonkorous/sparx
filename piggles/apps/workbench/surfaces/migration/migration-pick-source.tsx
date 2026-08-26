'use client';

// PICKING A SOURCE — the first thing a person sees on this errand.
//
// Two roads that end in the same place: connect to the platform they are leaving,
// or drop the export it gave them. The connect card comes first where there is one,
// because the export queue is a step nobody needs to take when a key will do.

import { useRef } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import { faFileArrowUp, faPlug, faSpinner } from '@fortawesome/pro-solid-svg-icons';

import { Icon } from '@piggles/ui';
import { ReportProblemButton } from '../../components/feedback/report-problem-button';
import { ModuleScope } from '../../components/module-scope';
import { productCopy } from '../../lib/product';
import { vendorHue, type VendorCard } from './data';

export interface PickSourceProps {
  vendor: VendorCard | undefined;
  reading: boolean;
  readError: string | null;
  onFile: (file: File) => void;
  onConnect: () => void;
}

export function PickSource({ vendor, reading, readError, onFile, onConnect }: PickSourceProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Heading level={2}>
          {vendor === undefined ? 'Bring in a file' : `Moving from ${vendor.name}`}
        </Heading>
        <Text>
          {vendor?.connector == null
            ? 'Drop the export your current platform made. We read it right here on your own machine and tell you what is in it — nothing is sent anywhere until you say so.'
            : `Two ways in, and they end up in the same place. Connect to ${vendor.name} and we fetch it for you, or drop an export in if you would rather. Either way you see exactly what will happen before anything is saved.`}
        </Text>
      </div>

      {/* The faster road first, when there is one. Everything on the roster
      works from a file; three platforms also answer to a key, and for
      those the export queue is a step nobody needs to take. */}
      {vendor?.connector == null ? null : (
        <ModuleScope module={vendorHue(vendor.kind)}>
          <div className="border-module bg-module bg-soft flex flex-col gap-3 rounded-xl border p-5">
            <Heading level={3} className="text-base">
              Connect to {vendor.name} and skip the exporting
            </Heading>
            <Text>
              Paste one read-only key and we read your{' '}
              {vendor.connector.resources
                .slice(0, 3)
                .map((resource) => resource.label.toLowerCase())
                .join(', ')}
              {vendor.connector.resources.length > 3 ? ' and more' : ''} straight from your account.
              It takes about two minutes to set up and nothing is stored afterwards.
            </Text>
            <Button
              color="module"
              className="self-start"
              onClick={() => {
                onConnect();
              }}
            >
              <Icon glyph={faPlug} className="size-4" aria-hidden />
              Connect to {vendor.name}
            </Button>
          </div>
        </ModuleScope>
      )}

      <label className="border-base-300 hover:border-primary flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors">
        <Icon glyph={faFileArrowUp} className="size-8" aria-hidden />
        <span className="flex flex-col gap-1">
          <Text className="font-medium">Choose a file, or drop one here</Text>
          <Text className="text-sm">CSV, XML or JSON — whatever your platform gave you.</Text>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.xml,.json,text/csv,text/xml,application/json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) void onFile(file);
          }}
        />
      </label>

      {reading ? (
        <Text>
          <Icon glyph={faSpinner} className="mr-2 inline size-4 animate-spin" aria-hidden />
          Reading it…
        </Text>
      ) : null}

      {readError !== null ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>We could not read that file</AlertTitle>
            <AlertDescription>{readError}</AlertDescription>
            {/* A file we cannot read is the one failure the tenant genuinely
            cannot fix alone — they exported what their platform gave them.
            Sending it to us is the correct next move, not a last resort. */}
            <ReportProblemButton
              className="mt-3 self-start"
              label="Send this to us"
              subject={productCopy(
                'migration.helpSubject.export',
                'sparx could not read my export file'
              )}
              details={[
                `Moving from: ${vendor?.name ?? 'not chosen'}`,
                `What the screen said: ${readError}`,
              ].join('\n')}
            />
          </AlertContent>
        </Alert>
      ) : null}
    </div>
  );
}
