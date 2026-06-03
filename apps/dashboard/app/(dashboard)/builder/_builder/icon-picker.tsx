'use client';

// The Icon node's inspector control — a searchable picker over the FULL lucide
// catalog (docs/47). Built on @sparx/ui's existing Command primitives (the same
// cmdk wrappers behind ⌘K) inside a Popover; no hand-curated subset. The catalog
// is just names (`iconNames`, strings); each preview + the chosen glyph render via
// the lazy `DynamicIcon`, so we never bundle ~1500 components. We own filtering
// (`shouldFilter={false}`) and cap the rendered list so it stays light.

import * as React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@sparx/ui';

const NAME_SET = new Set<string>(iconNames);
const MAX_RESULTS = 48;

// Shown before the author types — common UI/commerce glyphs. Filtered against the
// real catalog so a renamed/removed lucide icon never yields a broken preview.
const COMMON = (
  [
    'star',
    'heart',
    'check',
    'x',
    'plus',
    'minus',
    'arrow-right',
    'arrow-left',
    'chevron-right',
    'chevron-down',
    'zap',
    'shield',
    'shield-check',
    'truck',
    'package',
    'shopping-cart',
    'shopping-bag',
    'tag',
    'gift',
    'sparkles',
    'sun',
    'moon',
    'leaf',
    'flame',
    'droplet',
    'battery',
    'plug',
    'wrench',
    'settings',
    'phone',
    'mail',
    'map-pin',
    'globe',
    'clock',
    'calendar',
    'user',
    'users',
    'house',
    'search',
    'bell',
    'lock',
    'credit-card',
    'dollar-sign',
    'percent',
    'award',
    'badge-check',
    'thumbs-up',
    'rocket',
  ] as string[]
).filter((n) => NAME_SET.has(n)) as IconName[];

export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const results = React.useMemo<IconName[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMON;
    const out: IconName[] = [];
    for (const n of iconNames) {
      if (n.includes(q)) {
        out.push(n);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [query]);

  const current = (value && NAME_SET.has(value) ? value : 'star') as IconName;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="bx-iconpick" aria-label="Choose icon">
          <span className="bx-iconpick__preview">
            <DynamicIcon name={current} size={18} />
          </span>
          <span className="bx-iconpick__name">{value || 'star'}</span>
          <ChevronsUpDown className="bx-iconpick__chev" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="bx-iconpick__pop" align="start" sideOffset={6}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search icons…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No icons match “{query}”.</CommandEmpty>
            <div className="bx-iconpick__grid">
              {results.map((n) => (
                <CommandItem
                  key={n}
                  value={n}
                  title={n}
                  className="bx-iconpick__opt"
                  data-on={n === current}
                  onSelect={() => {
                    onChange(n);
                    setOpen(false);
                  }}
                >
                  <DynamicIcon name={n} size={20} />
                </CommandItem>
              ))}
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
