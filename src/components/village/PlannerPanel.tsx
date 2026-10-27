'use client';

import type { ReactNode } from 'react';
import { DEFAULT_SETTINGS, type PlanSettings } from '@/lib/planner';
import { NumberField, Segmented, Toggle } from './ui';

function Group({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl bg-surface-2/60 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-semibold">
        {title}
        <span className="text-muted transition group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-3 pb-2 pt-2">{children}</div>
    </details>
  );
}

export function PlannerPanel({
  settings,
  onChange,
  showBuildingOptions,
}: {
  settings: PlanSettings;
  onChange: (s: PlanSettings) => void;
  showBuildingOptions: boolean;
}) {
  const set = <K extends keyof PlanSettings>(key: K, value: PlanSettings[K]) => onChange({ ...settings, [key]: value });
  const jam = settings.hammerJam;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl tracking-wide">Planner</h2>
        <button type="button" onClick={() => onChange({ ...DEFAULT_SETTINGS, builders: settings.builders })} className="text-xs text-muted hover:text-ink">
          Reset boosts
        </button>
      </div>

      <Group title="Builders & helpers" open>
        <NumberField label="Builders" hint="5 huts + B.O.B = 6" value={settings.builders} min={1} max={8} onChange={(v) => set('builders', v)} />
        <Segmented
          label="Gold Pass boost (builder + research)"
          value={settings.goldPass}
          onChange={(v) => set('goldPass', v)}
          options={[
            { value: 0, label: 'Off' },
            { value: 0.1, label: '10%' },
            { value: 0.15, label: '15%' },
            { value: 0.2, label: '20%' },
          ]}
        />
        <NumberField label="Builder's Apprentice" hint="Level = hours saved per day" value={settings.apprentice} max={8} onChange={(v) => set('apprentice', v)} />
        <NumberField label="Lab Assistant" hint="Level = research hours saved per day" value={settings.labAssistant} max={12} onChange={(v) => set('labAssistant', v)} />
      </Group>

      <Group title="Potions" open>
        <NumberField label="Builder Potions" hint="10× builders for 1h ≈ 9h each" value={settings.builderPotions} onChange={(v) => set('builderPotions', v)} />
        <NumberField label="Research Potions" hint="24× lab for 1h ≈ 23h each" value={settings.researchPotions} onChange={(v) => set('researchPotions', v)} />
        <NumberField label="Pet Potions" hint="24× pet house for 1h" value={settings.petPotions} onChange={(v) => set('petPotions', v)} />
      </Group>

      <Group title="Books & Hammers">
        <p className="text-xs text-muted">Used on the longest upgrades. Hammers skip a level for free; books finish a running upgrade.</p>
        <NumberField label="Hammer of Heroes" value={settings.hammers.heroes} onChange={(v) => set('hammers', { ...settings.hammers, heroes: v })} />
        <NumberField label="Book of Heroes" value={settings.books.heroes} onChange={(v) => set('books', { ...settings.books, heroes: v })} />
        <NumberField label="Hammer of Building" value={settings.hammers.building} onChange={(v) => set('hammers', { ...settings.hammers, building: v })} />
        <NumberField label="Book of Building" value={settings.books.building} onChange={(v) => set('books', { ...settings.books, building: v })} />
        <NumberField label="Hammer of Fighting" value={settings.hammers.fighting} onChange={(v) => set('hammers', { ...settings.hammers, fighting: v })} />
        <NumberField label="Book of Fighting" value={settings.books.fighting} onChange={(v) => set('books', { ...settings.books, fighting: v })} />
        <NumberField label="Hammer of Spells" value={settings.hammers.spells} onChange={(v) => set('hammers', { ...settings.hammers, spells: v })} />
        <NumberField label="Book of Spells" value={settings.books.spells} onChange={(v) => set('books', { ...settings.books, spells: v })} />
        <NumberField label="Book of Everything" value={settings.books.everything} onChange={(v) => set('books', { ...settings.books, everything: v })} />
      </Group>

      <Group title="Hammer Jam" open>
        <Toggle label="Plan a Hammer Jam" hint="Upgrades started during the event cost and take less" checked={jam.enabled} onChange={(v) => set('hammerJam', { ...jam, enabled: v })} />
        {jam.enabled && (
          <>
            <NumberField label="Starts in (days)" value={jam.startDays} max={365} onChange={(v) => set('hammerJam', { ...jam, startDays: v })} />
            <NumberField label="Lasts (days)" hint="Past events: 14–18 days" value={jam.days} min={1} max={60} onChange={(v) => set('hammerJam', { ...jam, days: v })} />
            <Segmented
              label="Discount"
              value={jam.discount}
              onChange={(v) => set('hammerJam', { ...jam, discount: v })}
              options={[
                { value: 0.25, label: '25%' },
                { value: 0.3, label: '30%' },
                { value: 0.5, label: '50%' },
              ]}
            />
            <p className="text-xs text-muted">Potions are spent at the start of the event, where they are worth double.</p>
          </>
        )}
      </Group>

      {showBuildingOptions && (
        <Group title="What counts as max">
          <Toggle label="Supercharges" hint="TH16+ extra levels on max buildings" checked={settings.includeSupercharge} onChange={(v) => set('includeSupercharge', v)} />
          <Toggle label="Crafted defenses" hint="Crafting Station modules" checked={settings.includeCrafted} onChange={(v) => set('includeCrafted', v)} />
        </Group>
      )}
    </div>
  );
}
