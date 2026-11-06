"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  type Field,
  FIELDS,
  type Filter,
  filterParam,
  type Op,
  OPS,
  safe,
  SECTORS,
  type Sort,
  SORTS,
} from "@/lib/filters";

export const FIELD_LABELS: Record<Field, string> = {
  market_capitalization: "Market cap",
  earnings_share: "EPS",
  dividend_yield: "Yield (fraction: 0.02 is 2%)",
  avgvol_1d: "Volume, 1 day",
  sector: "Sector",
};

type Draft = { field: Field; op: Op; value: string };

function check(d: Draft): Filter | null {
  const value =
    d.field === "sector" ? d.value : d.value.trim() === "" ? NaN : Number(d.value);
  return safe({ field: d.field, op: d.op, value });
}

/**
 * The filter control. It builds the address of a screen and goes there; the server reads
 * the address and checks it again, because a control in the browser is a suggestion and a
 * link can say anything. Nothing here fetches.
 */
export function ScreenForm({
  filters,
  sort,
}: {
  filters: Filter[];
  sort: Sort;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(
    filters.map((f) => ({ ...f, value: String(f.value) })),
  );
  const [order, setOrder] = useState<Sort>(sort);
  const checked = drafts.map(check);
  const ready = checked.every((f) => f !== null);

  const set = (i: number, patch: Partial<Draft>) =>
    setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <form
      className="flex flex-col gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        const query = new URLSearchParams({
          f: filterParam(checked as Filter[]),
          sort: order,
        });
        router.push(`/screen?${query}`);
      }}
    >
      {drafts.map((d, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`Filter ${i + 1} field`}
            value={d.field}
            onChange={(e) => {
              const field = e.target.value as Field;
              set(
                i,
                field === "sector"
                  ? { field, op: "=", value: SECTORS[0] }
                  : { field },
              );
            }}
            className={INPUT}
          >
            {FIELDS.map((f) => (
              <option key={f} value={f}>
                {FIELD_LABELS[f]}
              </option>
            ))}
          </select>
          <select
            aria-label={`Filter ${i + 1} operator`}
            value={d.op}
            onChange={(e) => set(i, { op: e.target.value as Op })}
            className={INPUT}
          >
            {(d.field === "sector" ? (["="] as const) : OPS).map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          {d.field === "sector" ? (
            <select
              aria-label={`Filter ${i + 1} value`}
              value={d.value}
              onChange={(e) => set(i, { value: e.target.value })}
              className={INPUT}
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={`Filter ${i + 1} value`}
              inputMode="decimal"
              value={d.value}
              onChange={(e) => set(i, { value: e.target.value })}
              aria-invalid={checked[i] === null}
              className={`${INPUT} w-40 tabular-nums aria-[invalid=true]:border-red-600`}
            />
          )}
          <button
            type="button"
            onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
            className={BUTTON}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setDrafts([...drafts, { field: "dividend_yield", op: ">", value: "" }])
          }
          className={BUTTON}
        >
          Add filter
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          Sort
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as Sort)}
            className={INPUT}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={!ready}
          className={`${BUTTON} bg-zinc-900 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900`}
        >
          Run screen
        </button>
      </div>
    </form>
  );
}

const INPUT =
  "rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const BUTTON =
  "rounded border border-zinc-300 px-2.5 py-1 text-sm dark:border-zinc-700";
