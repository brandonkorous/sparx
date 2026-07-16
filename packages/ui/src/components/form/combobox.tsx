'use client';

// Combobox — a design-system "choose or type" control (Popover + cmdk Command)
// with FREE TEXT first-class: curated, searchable suggestions plus a "use this
// exact value" row for anything not in the catalog. Replaces the browser-native
// <datalist> (an unstyled OS popup) and powers smart lookups where the option
// set is open-ended (product type, vendor, tax class) or technical (automation
// event types / field paths — pass `mono`). `MultiCombobox` is the token-input
// cousin for multi-value fields (tags) — selected values render as removable
// chips and the popover stays open while picking.

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '../../utils/cn';
import { Button } from '../primitives/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../overlay/command-palette';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../overlay/popover';
import { Tag } from '../data/tag';

export interface ComboboxOption {
  value: string;
  /** Optional human label shown under the value (e.g. "Customer created"). */
  label?: string;
}

interface SharedProps {
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Sub-text on the "use the raw typed value" row. */
  customHint?: string;
  /** Allow committing free text not present in `options`. Default true. */
  allowCustom?: boolean;
  /** Render values in a monospace font (technical keys/paths). Default false. */
  mono?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

function useFiltered(options: ComboboxOption[], search: string) {
  const trimmed = search.trim();
  const q = trimmed.toLowerCase();
  const filtered = q
    ? options.filter(
        (o) => o.value.toLowerCase().includes(q) || (o.label?.toLowerCase().includes(q) ?? false)
      )
    : options;
  const exact = options.some((o) => o.value.toLowerCase() === q);
  return { trimmed, filtered, exact };
}

function OptionRow({
  option,
  selected,
  mono,
  onSelect,
}: {
  option: ComboboxOption;
  selected: boolean;
  mono: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem value={option.value} onSelect={onSelect}>
      <Check
        className={cn('h-4 w-4 shrink-0', selected ? 'text-module opacity-100' : 'opacity-0')}
        aria-hidden
      />
      <span className="flex min-w-0 flex-col">
        <span className={cn('truncate text-sm', mono && 'font-mono text-xs')}>{option.value}</span>
        {option.label && <span className="text-base-content truncate text-xs">{option.label}</span>}
      </span>
    </CommandItem>
  );
}

function CustomRow({
  text,
  hint,
  mono,
  onSelect,
}: {
  text: string;
  hint: string;
  mono: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandGroup heading="Custom">
      <CommandItem value={`raw:${text}`} onSelect={onSelect}>
        <Check className="h-4 w-4 shrink-0 opacity-0" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className={cn('truncate text-sm', mono && 'font-mono text-xs')}>{text}</span>
          <span className="text-base-content text-xs">{hint}</span>
        </span>
      </CommandItem>
    </CommandGroup>
  );
}

interface ComboboxProps extends SharedProps {
  id?: string;
  value: string;
  color?: string;
  onChange: (value: string) => void;
  /** Width / sizing of the trigger button (default `w-full`). */
  triggerClassName?: string;
}

export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Search or type…',
  customHint = 'Use this exact value',
  allowCustom = true,
  mono = false,
  color = '',
  disabled,
  triggerClassName,
  'aria-label': ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const listboxId = React.useId();
  const { trimmed, filtered, exact } = useFiltered(options, search);
  const showRaw = allowCustom && trimmed.length > 0 && !exact;

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
          color={color}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn('justify-between font-normal', triggerClassName ?? 'w-full')}
        >
          <span
            className={cn(
              'truncate text-sm',
              value ? (mono ? 'font-mono' : '') : 'text-base-content'
            )}
          >
            {value ? value : (placeholder ?? 'Choose or type…')}
          </span>
          <ChevronsUpDown className="text-base-content ml-2 h-4 w-4 shrink-0" aria-hidden />
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
          <CommandList id={listboxId}>
            <CommandEmpty>No matches.</CommandEmpty>
            {showRaw && (
              <CustomRow
                text={trimmed}
                hint={customHint}
                mono={mono}
                onSelect={() => commit(trimmed)}
              />
            )}
            {filtered.length > 0 && (
              <CommandGroup heading="Suggestions">
                {filtered.map((o) => (
                  <OptionRow
                    key={o.value}
                    option={o}
                    selected={value === o.value}
                    mono={mono}
                    onSelect={() => commit(o.value)}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface MultiComboboxProps extends SharedProps {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** Hard cap on number of selected values. */
  max?: number;
  /** Width / sizing of the box (default `w-full`). */
  triggerClassName?: string;
}

export function MultiCombobox({
  id,
  value,
  onChange,
  options,
  placeholder = 'Add…',
  searchPlaceholder = 'Search or type…',
  customHint = 'Add this tag',
  allowCustom = true,
  mono = false,
  max,
  disabled,
  triggerClassName,
  'aria-label': ariaLabel,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const listboxId = React.useId();
  const atMax = max !== undefined && value.length >= max;
  // Selected values are never offered again in the suggestion list.
  const unselected = options.filter((o) => !value.includes(o.value));
  const { trimmed, filtered, exact } = useFiltered(unselected, search);
  const alreadySelected = value.some((v) => v.toLowerCase() === search.trim().toLowerCase());
  const showRaw = allowCustom && !atMax && trimmed.length > 0 && !exact && !alreadySelected;

  function add(next: string) {
    if (atMax || value.includes(next)) return;
    onChange([...value, next]);
    setSearch('');
  }
  function remove(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverAnchor asChild>
        <div
          className={cn(
            'border-base-300 bg-base-100 flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border px-2 py-1.5',
            'focus-within:ring-2 focus-within:ring-[var(--color-primary)]',
            disabled && 'cursor-not-allowed opacity-50',
            triggerClassName
          )}
        >
          {value.map((v) => (
            // Stop pointerdown from reaching Radix's outside-click dismissal
            // so removing a tag (or clicking a chip) never closes the popover.
            <span key={v} onPointerDown={(e) => e.stopPropagation()}>
              <Tag
                color="neutral"
                variant="soft"
                onRemove={disabled ? undefined : () => remove(v)}
                removeLabel={`Remove ${v}`}
                className={mono ? 'font-mono' : undefined}
              >
                {v}
              </Tag>
            </span>
          ))}
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-label={ariaLabel}
              disabled={atMax || disabled}
              className={cn(
                'flex flex-1 items-center justify-between gap-2 self-stretch text-left text-sm',
                'text-base-content disabled:cursor-not-allowed',
                value.length > 0 && 'min-w-[6rem]'
              )}
            >
              <span className="truncate">{atMax ? `Max ${max} reached` : placeholder}</span>
              <ChevronsUpDown className="text-base-content h-4 w-4 shrink-0" aria-hidden />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-0"
        style={{ minWidth: 'var(--radix-popover-trigger-width)' }}
      >
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList id={listboxId}>
            <CommandEmpty>No matches.</CommandEmpty>
            {showRaw && (
              <CustomRow
                text={trimmed}
                hint={customHint}
                mono={mono}
                onSelect={() => add(trimmed)}
              />
            )}
            {filtered.length > 0 && (
              <CommandGroup heading="Suggestions">
                {filtered.map((o) => (
                  <OptionRow
                    key={o.value}
                    option={o}
                    selected={false}
                    mono={mono}
                    onSelect={() => add(o.value)}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
