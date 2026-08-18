'use client';

// The social block's list of places, edited as a list.
//
// A row is a place and its address, and the whole list is written as one patch —
// `links` is a single field on the node, so adding one and undoing it is one step
// rather than an insert the author has to press ⌘Z twice to get out of.

import { Button, Field, FieldLabel, Input, NativeSelect } from '@wizeworks/silicaui-react';
import type { SocialLink, SocialNode, SocialPlatform } from '@wizeworks/silicaui-builder/email';
import { StudioIcon } from '../../icon';
import { usePatch } from './fields';

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'pinterest', label: 'Pinterest' },
];

export function SocialLinks({ node }: { node: SocialNode }) {
  const patch = usePatch(node.id);

  const write = (label: string, links: SocialLink[]): void => patch(label, { links });

  const update = (index: number, change: Partial<SocialLink>): void => {
    write(
      'Change a social link',
      node.links.map((link, at) => (at === index ? { ...link, ...change } : link))
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {node.links.map((link, index) => (
        <Field key={`${link.platform}-${index}`}>
          <FieldLabel>Place {index + 1}</FieldLabel>
          <div className="flex items-center gap-2">
            <NativeSelect
              size="sm"
              value={link.platform}
              onChange={(event) =>
                update(index, { platform: event.currentTarget.value as SocialPlatform })
              }
            >
              {PLATFORMS.map((platform) => (
                <option key={platform.value} value={platform.value}>
                  {platform.label}
                </option>
              ))}
            </NativeSelect>
            <Input
              size="sm"
              defaultValue={link.url}
              placeholder="https://"
              onBlur={(event) => {
                const url = event.currentTarget.value;
                if (url !== link.url) update(index, { url });
              }}
            />
            {/* Removing one row of a list is not a destructive act on a record —
                it is undoable with ⌘Z like every other edit here. */}
            <Button
              size="sm"
              shape="square"
              aria-label={`Remove ${link.platform}`}
              onClick={() =>
                write(
                  'Remove a social link',
                  node.links.filter((_, at) => at !== index)
                )
              }
            >
              <StudioIcon name="trash" className="inline-flex size-4" />
            </Button>
          </div>
        </Field>
      ))}

      <Button
        size="sm"
        color="primary"
        variant="soft"
        onClick={() =>
          write('Add a social link', [...node.links, { platform: 'facebook', url: '' }])
        }
      >
        Add a place
      </Button>

      {node.links.length === 0 ? (
        <p className="text-base-content text-sm">
          Nothing here yet. Add the places people can find you.
        </p>
      ) : null}
    </div>
  );
}
