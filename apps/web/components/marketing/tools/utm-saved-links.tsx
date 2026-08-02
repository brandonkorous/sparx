'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button, List, ListColGrow, ListRow } from '@wizeworks/silicaui-react';
import { Panel, CopyButton } from './ui-kit';

export interface SavedLink {
  url: string;
  campaign: string;
}

export interface SavedLinksProps {
  links: SavedLink[];
  onRemove: (url: string) => void;
  onClear: () => void;
}

/**
 * The visitor's locally-persisted campaign-link history.
 *
 * A `List` of rows rather than hand-built cards: each row is one saved link
 * (campaign name + the full URL) with copy + remove as trailing actions. The
 * list's own base-100 fill is dropped (`bg-transparent`) and its row gutters
 * zeroed so the rows align with the rest of the panel's content — the panel's
 * `Card` already supplies the surface.
 */
export function SavedLinks({ links, onRemove, onClear }: SavedLinksProps) {
  if (links.length === 0) return null;
  return (
    <Panel
      title="Saved links"
      action={
        <Button color="error" type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear all
        </Button>
      }
    >
      <List className="bg-transparent [&_.list-row]:px-0">
        {links.map((link) => (
          <ListRow key={link.url}>
            <ListColGrow>
              <div className="text-md font-medium">{link.campaign}</div>
              <div className="truncate font-mono text-sm">{link.url}</div>
            </ListColGrow>
            <CopyButton
              value={link.url}
              label=""
              copiedLabel=""
              aria-label="Copy link"
              shape="square"
            />
            <Button
              type="button"
              color="error"
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Remove link"
              onClick={() => onRemove(link.url)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ListRow>
        ))}
      </List>
    </Panel>
  );
}
