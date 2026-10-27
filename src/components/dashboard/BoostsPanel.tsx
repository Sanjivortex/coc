'use client';

import type { ReactNode } from 'react';
import { DEFAULT_SETTINGS, type PlanSettings } from '@/lib/planner';
import { Button, Field, Segmented, Stepper, Switch } from '../ui/controls';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-3">{title}</h3>
      <div className="divide-y divide-line/60">{children}</div>
    </div>
  );
}

const GOLD_OPTIONS = [
  { value: 0.1, label: '10%' },
  { value: 0.15, label: '15%' },
  { value: 0.2, label: '20%' },
];
const JAM_OPTIONS = [
  { value: 0.25, label: '25%' },
  { value: 0.3, label: '30%' },
  { value: 0.5, label: '50%' },
];

/** Every planner input in one place: builders, helpers, Gold Pass, Hammer Jam window and the magic-item inventory. */
export function BoostsPanel({ settings, onChange, showBuildingOptions }: { settings: PlanSettings; onChange: (s: PlanSettings) => void; showBuildingOptions: boolean }) {
  const set = <K extends keyof PlanSettings>(key: K, value: PlanSettings[K]) => onChange({ ...settings, [key]: value });
  const jam = settings.hammerJam;
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
        <Group title="Builders">
          <Field label="Builders" hint="5 huts + B.O.B">
            <Stepper label="Builders" value={settings.builders} min={1} max={8} onChange={(v) => set('builders', v)} />
          </Field>
          <Field label="Goblin Builder" hint="Event builder">
            <Switch label="Goblin Builder" checked={settings.goblinBuilder} onChange={(v) => set('goblinBuilder', v)} />
          </Field>
          {settings.goblinBuilder && (
            <Field label="Goblin stays" hint="Days, 0 = whole plan">
              <Stepper label="Goblin Builder days" value={settings.goblinDays} max={365} onChange={(v) => set('goblinDays', v)} />
            </Field>
          )}
          <Field label="Builder's Apprentice" hint="Level = hours saved per day">
            <Stepper label="Builder's Apprentice level" value={settings.apprentice} max={8} onChange={(v) => set('apprentice', v)} />
          </Field>
          <Field label="Lab Assistant" hint="Level = hours saved per day">
            <Stepper label="Lab Assistant level" value={settings.labAssistant} max={12} onChange={(v) => set('labAssistant', v)} />
          </Field>
        </Group>

        <Group title="Events">
          <Field label="Gold Pass boost" hint="Builder & research time and cost">
            <Segmented label="Gold Pass boost" value={settings.goldPass} options={GOLD_OPTIONS} onChange={(v) => set('goldPass', v)} />
          </Field>
          <Field label="Hammer Jam starts in" hint="Days from today">
            <Stepper label="Hammer Jam starts in days" value={jam.startDays} max={365} onChange={(v) => set('hammerJam', { ...jam, startDays: v })} />
          </Field>
          <Field label="Hammer Jam lasts" hint="Past events: 14–18 days">
            <Stepper label="Hammer Jam length in days" value={jam.days} min={1} max={60} onChange={(v) => set('hammerJam', { ...jam, days: v })} />
          </Field>
          <Field label="Hammer Jam discount" hint="Time and cost">
            <Segmented label="Hammer Jam discount" value={jam.discount} options={JAM_OPTIONS} onChange={(v) => set('hammerJam', { ...jam, discount: v })} />
          </Field>
        </Group>

        <Group title="Potions">
          <Field label="Builder Potions" hint="10× builders for 1 hour">
            <Stepper label="Builder Potions" value={settings.builderPotions} onChange={(v) => set('builderPotions', v)} />
          </Field>
          <Field label="Research Potions" hint="24× laboratory for 1 hour">
            <Stepper label="Research Potions" value={settings.researchPotions} onChange={(v) => set('researchPotions', v)} />
          </Field>
          <Field label="Pet Potions" hint="24× pet house for 1 hour">
            <Stepper label="Pet Potions" value={settings.petPotions} onChange={(v) => set('petPotions', v)} />
          </Field>
          <p className="pt-2 text-xs text-ink-3">The game does not share your inventory; enter it here once. It is saved in this browser.</p>
        </Group>

        <Group title="Books & hammers">
          <Field label="Hammer of Heroes">
            <Stepper label="Hammer of Heroes" value={settings.hammers.heroes} onChange={(v) => set('hammers', { ...settings.hammers, heroes: v })} />
          </Field>
          <Field label="Book of Heroes">
            <Stepper label="Book of Heroes" value={settings.books.heroes} onChange={(v) => set('books', { ...settings.books, heroes: v })} />
          </Field>
          <Field label="Hammer of Building">
            <Stepper label="Hammer of Building" value={settings.hammers.building} onChange={(v) => set('hammers', { ...settings.hammers, building: v })} />
          </Field>
          <Field label="Book of Building">
            <Stepper label="Book of Building" value={settings.books.building} onChange={(v) => set('books', { ...settings.books, building: v })} />
          </Field>
          <Field label="Hammer / Book of Fighting">
            <span className="flex gap-1.5">
              <Stepper label="Hammer of Fighting" value={settings.hammers.fighting} onChange={(v) => set('hammers', { ...settings.hammers, fighting: v })} />
              <Stepper label="Book of Fighting" value={settings.books.fighting} onChange={(v) => set('books', { ...settings.books, fighting: v })} />
            </span>
          </Field>
          <Field label="Hammer / Book of Spells">
            <span className="flex gap-1.5">
              <Stepper label="Hammer of Spells" value={settings.hammers.spells} onChange={(v) => set('hammers', { ...settings.hammers, spells: v })} />
              <Stepper label="Book of Spells" value={settings.books.spells} onChange={(v) => set('books', { ...settings.books, spells: v })} />
            </span>
          </Field>
          <Field label="Book of Everything">
            <Stepper label="Book of Everything" value={settings.books.everything} onChange={(v) => set('books', { ...settings.books, everything: v })} />
          </Field>
        </Group>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {showBuildingOptions ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            <label className="flex items-center gap-2">
              <Switch label="Count supercharges" checked={settings.includeSupercharge} onChange={(v) => set('includeSupercharge', v)} />
              Count supercharges as max
            </label>
            <label className="flex items-center gap-2">
              <Switch label="Count crafted defenses" checked={settings.includeCrafted} onChange={(v) => set('includeCrafted', v)} />
              Count crafted defenses
            </label>
          </div>
        ) : (
          <span />
        )}
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_SETTINGS, builders: settings.builders, apprentice: settings.apprentice, labAssistant: settings.labAssistant })}>
          Reset potions and events
        </Button>
      </div>
    </div>
  );
}
