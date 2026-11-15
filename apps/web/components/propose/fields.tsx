'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { newKey } from './draft';

/** Small building blocks for the propose editor's list editors. */

export function Counter({ len, max, unit }: { len: number; max: number; unit?: string }) {
  const cls = len > max ? 'counter-err' : len >= max * 0.9 ? 'counter-warn' : '';
  return (
    <span className={cn('counter', cls)}>
      {len} / {max}
      {unit ? ` ${unit}` : ''}
    </span>
  );
}

/** Hint on the left, counter on the right, under a field. */
export function FieldFoot({ hint, children }: { hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mt-1 flex justify-between gap-3">
      <span className="hint">{hint}</span>
      {children}
    </div>
  );
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * Drag to reorder, with the grip as the only handle (so text in the fields stays
 * selectable). Up/down buttons do the same for keyboard users.
 */
export function useReorder(onMove: (from: number, to: number) => void) {
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return {
    over,
    itemProps: (index: number) => ({
      draggable: armed === index,
      onDragStart: (event: React.DragEvent) => {
        setDragging(index);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      },
      onDragOver: (event: React.DragEvent) => {
        if (dragging === null) return;
        event.preventDefault();
        setOver(index);
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        if (dragging !== null) onMove(dragging, index);
        setDragging(null);
        setOver(null);
        setArmed(null);
      },
      onDragEnd: () => {
        setDragging(null);
        setOver(null);
        setArmed(null);
      },
    }),
    handleProps: (index: number) => ({
      onPointerDown: () => setArmed(index),
      onPointerUp: () => setArmed(null),
    }),
  };
}

/** One item of a list editor: grip + number on the left, controls on top. */
export function ItemShell({
  n,
  label,
  index,
  total,
  controls,
  children,
  warn = false,
  error = false,
  reorder,
  onMove,
  onRemove,
  canRemove = true,
}: {
  n: string;
  label: string;
  index: number;
  total: number;
  controls?: ReactNode;
  children: ReactNode;
  warn?: boolean;
  error?: boolean;
  reorder: ReturnType<typeof useReorder>;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  canRemove?: boolean;
}) {
  return (
    <li
      className={cn(
        'box grid grid-cols-[28px_minmax(0,1fr)] gap-2 py-3 pl-1.5 pr-3 transition-colors',
        reorder.over === index && 'bg-bg-subtle',
      )}
      style={{ borderColor: error ? 'var(--danger)' : warn ? 'var(--warning)' : undefined }}
      {...reorder.itemProps(index)}
    >
      <div className="flex flex-col items-center gap-0.5 pt-1">
        <span
          className="subtle cursor-grab touch-none"
          aria-hidden="true"
          {...reorder.handleProps(index)}
        >
          <Icon name="grip" />
        </span>
        <span className="mono t-xs subtle">{n}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <div className="flex-1" />
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label={`Move ${label} up`}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <Icon name="chevronUp" size="sm" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label={`Move ${label} down`}
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <Icon name="chevronDown" size="sm" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label={`Remove ${label}`}
            disabled={!canRemove}
            onClick={onRemove}
          >
            <Icon name="trash" size="sm" />
          </button>
        </div>
        {children}
      </div>
    </li>
  );
}

/** Dashed full-width "Add …" button under a list. */
export function AddButton({
  id,
  label,
  onClick,
  disabled,
}: {
  id?: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      className="btn btn-secondary mt-2 w-full border-dashed"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name="plus" />
      {label}
    </button>
  );
}

/** Editable mono id: shows the generated id as a placeholder until someone types one. */
export function IdInput({
  id,
  value,
  generated,
  label,
  onChange,
}: {
  id: string;
  value: string;
  generated: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      id={id}
      className="mono t-xs subtle h-7 w-[min(220px,40vw)] rounded border border-transparent bg-transparent px-1.5 outline-none hover:border-border focus:border-accent focus:text-fg"
      value={value}
      placeholder={generated || 'id'}
      aria-label={`${label} id`}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value.toLowerCase().replace(/\s+/g, '-'))}
    />
  );
}

/** A list of one-line strings (best fit when, notes, mistakes). */
export function StringList({
  idPrefix,
  label,
  items,
  onChange,
  max,
  maxChars,
  placeholder,
}: {
  idPrefix: string;
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  max: number;
  maxChars?: number;
  placeholder?: string;
}) {
  // Keys stay stable while typing; they only need to survive add/remove.
  const [keys, setKeys] = useState(() => items.map((_, index) => `${idPrefix}-${index}`));
  const keyed = items.map((item, index) => ({ item, key: keys[index] ?? `${idPrefix}-x${index}` }));
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <ul className="flex flex-col gap-1.5">
        {keyed.map(({ item, key }, index) => (
          <li key={key} className="flex items-center gap-1.5">
            <input
              id={`${idPrefix}-${index}`}
              className="input h-8 text-[13px]"
              value={item}
              placeholder={placeholder}
              aria-label={`${label} ${index + 1}`}
              onChange={(event) =>
                onChange(items.map((value, i) => (i === index ? event.target.value : value)))
              }
            />
            {maxChars !== undefined && item.length >= maxChars * 0.9 && (
              <Counter len={item.length} max={maxChars} />
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={`Remove ${label} ${index + 1}`}
              disabled={items.length <= 1}
              onClick={() => {
                onChange(items.filter((_, i) => i !== index));
                setKeys(keys.filter((_, i) => i !== index));
              }}
            >
              <Icon name="x" size="sm" />
            </button>
          </li>
        ))}
      </ul>
      {items.length < max && (
        <button
          type="button"
          className="btn btn-ghost btn-sm mt-1.5"
          onClick={() => {
            onChange([...items, '']);
            setKeys([...keys.slice(0, items.length), newKey(idPrefix)]);
          }}
        >
          <Icon name="plus" size="sm" />
          Add
        </button>
      )}
    </div>
  );
}

/** The Must / Should segmented control. */
export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={cn('seg-b', option.value === value && 'seg-on')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
