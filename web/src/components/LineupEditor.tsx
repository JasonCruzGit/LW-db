"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { Song } from "@/lib/types";

export type LineupRow = {
  songId: string;
  title: string;
  bpm: number;
  originalKey: string;
  selectedKey: string;
  notes: string;
};

function SortableRow({
  row,
  index,
  onChange,
  onRemove,
  onMove,
  total,
}: {
  row: LineupRow;
  index: number;
  onChange: (index: number, patch: Partial<LineupRow>) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  total: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.songId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <button
          type="button"
          className="cursor-grab touch-none rounded border border-dashed border-zinc-300 px-2 py-1 text-xs text-zinc-500 dark:border-zinc-600"
          {...attributes}
          {...listeners}
        >
          Drag
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 font-semibold">
              <span className="text-zinc-500">{index + 1}.</span> {row.title}
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
              Seq
              <input
                type="number"
                min={1}
                max={total}
                className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-950"
                value={index + 1}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  const to = Math.max(1, Math.min(total, Math.trunc(n))) - 1;
                  if (to !== index) onMove(index, to);
                }}
                aria-label="Sequence number"
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-medium text-zinc-500">
              Key (override)
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={row.selectedKey}
                onChange={(e) => onChange(index, { selectedKey: e.target.value })}
              />
            </label>
            <div className="text-xs text-zinc-500">
              Original
              <div className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{row.originalKey}</div>
            </div>
            <div className="text-xs text-zinc-500">
              BPM
              <div className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{row.bpm}</div>
            </div>
          </div>
          <label className="text-xs font-medium text-zinc-500">
            Notes
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              rows={1}
              placeholder="e.g. repeat chorus 2×"
              value={row.notes}
              onChange={(e) => onChange(index, { notes: e.target.value })}
            />
          </label>
        </div>
        <button
          type="button"
          className="text-sm text-red-600 hover:underline"
          onClick={() => {
            if (window.confirm(`Remove “${row.title}” from this lineup?`)) onRemove(index);
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function LineupEditor({
  serviceDate,
  onServiceDateChange,
  songLeaderName,
  onSongLeaderNameChange,
  changeNote,
  onChangeNoteChange,
  rows,
  onRowsChange,
  songPicker,
}: {
  serviceDate: string;
  onServiceDateChange: (v: string) => void;
  songLeaderName: string;
  onSongLeaderNameChange: (v: string) => void;
  changeNote: string;
  onChangeNoteChange: (v: string) => void;
  rows: LineupRow[];
  onRowsChange: (rows: LineupRow[]) => void;
  songPicker: ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const ids = useMemo(() => rows.map((r) => r.songId), [rows]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onRowsChange(arrayMove(rows, oldIndex, newIndex));
  }

  function updateRow(i: number, patch: Partial<LineupRow>) {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    onRowsChange(next);
  }

  function moveRow(from: number, to: number) {
    if (from === to) return;
    if (from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
    onRowsChange(arrayMove(rows, from, to));
  }

  function removeRow(i: number) {
    onRowsChange(rows.filter((_, j) => j !== i));
  }

  return (
    <div data-tour="lineup-editor" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium uppercase text-zinc-500">
          Service date
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={serviceDate}
            onChange={(e) => onServiceDateChange(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium uppercase text-zinc-500">
          Song leader
          <input
            type="text"
            placeholder="Name for Sunday"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            value={songLeaderName}
            onChange={(e) => onSongLeaderNameChange(e.target.value)}
          />
        </label>
      </div>

      <label className="block text-xs font-medium uppercase text-zinc-500">
        Service announcement / changes
        <textarea
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          rows={2}
          placeholder="Pinned note shown at the top of Service view (e.g. key changes, transitions, special cues)."
          value={changeNote}
          onChange={(e) => onChangeNoteChange(e.target.value)}
        />
      </label>

      {songPicker}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {rows.map((row, index) => (
              <SortableRow
                key={row.songId}
                row={row}
                index={index}
                onChange={updateRow}
                onRemove={removeRow}
                onMove={moveRow}
                total={rows.length}
              />
            ))}
            {rows.length === 0 && (
              <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500 dark:border-zinc-700">
                Add songs from the library to build your set.
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export function songToRow(s: Song): LineupRow {
  return {
    songId: s.id,
    title: s.title,
    bpm: s.bpm,
    originalKey: s.key,
    selectedKey: s.key,
    notes: "",
  };
}
