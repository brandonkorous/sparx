'use client';

// A design-system combobox (Popover + cmdk Command) for the automation editor —
// FREE TEXT first-class (type any value) alongside curated, searchable
// suggestions, replacing the browser-native <datalist> (which renders an
// unstyled OS popup). Used for the trigger event type and the condition field
// path. The trigger button shows the current value (mono); the popover offers a
// search box, the filtered suggestions (value + optional human label), and a
// "use this exact value" row for anything not in the catalog. We own the
// filtering (shouldFilter=false) so the custom row is always predictable.

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@sparx/ui';

export interface ComboOption {
  value: string;
  /** Optional human label shown under the value (e.g. "Customer created"). */
  label?: string;
}

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Sub-text on the "use the raw typed value" row. */
  customHint?: string;
  /** Width / sizing of the trigger button (default `w-full max-w-md`). */
  triggerClassName?: string;
  'aria-label'?: string;
}

export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Search or type…',
  customHint = 'Use this exact value',
  triggerClassName,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const trimmed = search.trim();
  const q = trimmed.toLowerCase();
  const filtered = q
    ? options.filter(
        (o) => o.value.toLowerCase().includes(q) || (o.label?.toLowerCase().includes(q) ?? false)
      )
    : options;
  // Offer the raw typed text whenever it isn't already an exact catalog entry.
  const showRaw = trimmed.length > 0 && !options.some((o) => o.value.toLowerCase() === q);

  function commit(next: string) {
    onChange(next);
    setSearch('');
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          color="neutral"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn('justify-between font-normal', triggerClassName ?? 'w-full max-w-md')}
        >
          <span
            className={cn(
              'truncate text-sm',
              value ? 'font-mono' : 'text-[var(--color-text-tertiary)]'
            )}
          >
            {value ? value : (placeholder ?? 'Choose or type…')}
          </span>
          <ChevronsUpDown
            className="ml-2 h-4 w-4 shrink-0 text-[var(--color-text-muted)]"
            aria-hidden
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-0"
        style={{ minWidth: 'var(--radix-popover-trigger-width)' }}
      >
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {showRaw && (
              <CommandGroup heading="Custom">
                <CommandItem value={`raw:${trimmed}`} onSelect={() => commit(trimmed)}>
                  <Check className="h-4 w-4 shrink-0 opacity-0" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-mono text-xs whitespace-nowrap">{trimmed}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{customHint}</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length > 0 && (
              <CommandGroup heading="Suggestions">
                {filtered.map((o) => (
                  <CommandItem key={o.value} value={o.value} onSelect={() => commit(o.value)}>
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        value === o.value ? 'text-[var(--module-active)] opacity-100' : 'opacity-0'
                      )}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-mono text-xs whitespace-nowrap">{o.value}</span>
                      {o.label && (
                        <span className="text-xs whitespace-nowrap text-[var(--color-text-muted)]">
                          {o.label}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
