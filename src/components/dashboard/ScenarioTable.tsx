'use client';

import { formatDate, formatDuration } from '@/lib/format';
import type { Res } from '@/lib/gamedata';
import type { ScenarioId } from '@/lib/planner';
import { CostList } from '../ui/display';

export interface ScenarioRow {
  id: ScenarioId;
  label: string;
  time: number;
  cost?: Partial<Record<Res, number>>;
  /** Short note under the label, e.g. when no potions were entered. */
  hint?: string;
}

/**
 * Scenarios as a table with an inline bar per row (one series, so no legend): the selected
 * scenario is emphasized, the others stay gray. Click a row to select it everywhere.
 */
export function ScenarioTable({
  rows,
  active,
  onSelect,
  now,
  showCost = true,
}: {
  rows: ScenarioRow[];
  active: ScenarioId;
  onSelect: (id: ScenarioId) => void;
  now?: number;
  showCost?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.time));
  const normal = rows.find((r) => r.id === 'normal')?.time ?? rows[0]?.time ?? 0;
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full text-[13px] sm:min-w-[560px]">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="px-2 pb-2 font-medium">Scenario</th>
            <th className="w-[45%] px-2 pb-2 font-medium sm:w-[32%]">Time to finish</th>
            <th className="hidden px-2 pb-2 font-medium sm:table-cell">Done by</th>
            {showCost && <th className="hidden px-2 pb-2 font-medium sm:table-cell">Cost</th>}
            <th className="px-2 pb-2 text-right font-medium">Saved</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const selected = r.id === active;
            const saved = normal - r.time;
            return (
              <tr
                key={r.id}
                onClick={() => onSelect(r.id)}
                className={`cursor-pointer border-t border-line transition-colors ${selected ? 'bg-hover' : 'hover:bg-hover/60'}`}
              >
                <td className="px-2 py-2">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(r.id);
                    }}
                    className={`text-left sm:whitespace-nowrap ${selected ? 'font-medium text-ink' : 'text-ink-2'}`}
                  >
                    {r.label}
                  </button>
                  {r.hint && <span className="block text-[11px] text-ink-3">{r.hint}</span>}
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 shrink-0 rounded-r"
                      style={{ width: `max(2px, calc((100% - 4.5rem) * ${r.time / max}))`, background: selected ? 'var(--series-1)' : 'var(--series-muted)' }}
                    />
                    <span className="tnum whitespace-nowrap text-ink">{r.time > 0 ? formatDuration(r.time) : 'Done'}</span>
                  </div>
                </td>
                <td className="tnum hidden whitespace-nowrap px-2 py-2 text-ink-2 sm:table-cell">{now && r.time > 0 ? formatDate(now + r.time) : '—'}</td>
                {showCost && (
                  <td className="hidden whitespace-nowrap px-2 py-2 text-ink-2 sm:table-cell">
                    <CostList cost={r.cost ?? {}} nowrap />
                  </td>
                )}
                <td className="tnum whitespace-nowrap px-2 py-2 text-right">
                  {saved > 3600 ? <span className="text-good">−{formatDuration(saved)}</span> : <span className="text-ink-3">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
