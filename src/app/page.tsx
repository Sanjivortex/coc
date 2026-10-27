import Link from 'next/link';
import { CalendarClock, FileUp, Hammer, Swords } from 'lucide-react';
import { TagSearch } from '@/components/TagSearch';
import { buttonClass } from '@/components/ui/styles';
import { Panel } from '@/components/ui/display';
import { formatDuration } from '@/lib/format';
import { MAX_TH, itemByKey } from '@/lib/gamedata';
import { DEFAULT_SETTINGS, SCENARIOS, buildChains, chainCost, simulateChain } from '@/lib/planner';
import type { Village } from '@/lib/village';

// A real calculation from the same engine the site uses: Archer Queen 97 → 110 at TH18.
const example = (() => {
  const village: Village = {
    source: 'api',
    tag: '#EXAMPLE',
    townHall: 18,
    builderHall: 0,
    entries: [{ item: itemByKey('home:archer-queen')!, level: 97, count: 1 }],
    helpers: { apprentice: 0, labAssistant: 0 },
    superTroops: [],
    unknown: [],
  };
  const chain = buildChains(village).find((c) => c.item.id === 'archer-queen')!;
  const rows = SCENARIOS.filter((s) => ['normal', 'gold', 'jam', 'jamGold'].includes(s.id)).map((s) => ({
    label: s.label,
    time: simulateChain(chain, DEFAULT_SETTINGS, s.id).makespan,
  }));
  return { chain, rows, cost: chainCost(chain).D ?? 0 };
})();

const FEATURES = [
  {
    icon: Swords,
    title: 'Every level, against your Town Hall',
    text: 'Heroes, pets, equipment, troops, spells and siege machines from the official API, with the max for your hall and what is rushed.',
  },
  {
    icon: CalendarClock,
    title: 'Time to max, honestly scheduled',
    text: 'Builders work in parallel, heroes level one at a time. See the date you finish, not just a sum of timers.',
  },
  {
    icon: Hammer,
    title: 'Potions, Gold Pass, Hammer Jam',
    text: 'Enter your potions and books once, add a Goblin Builder, and compare every scenario side by side.',
  },
];

export default function Home() {
  const max = Math.max(...example.rows.map((r) => r.time));
  return (
    <div className="pb-8">
      <section className="mx-auto max-w-3xl pb-14 pt-10 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden />
          Updated for Town Hall {MAX_TH}
        </span>
        <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Know exactly when you&apos;ll be maxed</h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] text-ink-2">
          Clash of Clans stats with an upgrade planner built in: every hero, pet and building timed with your builders, potions, Gold Pass and
          Hammer Jam.
        </p>
        <div className="mt-8 flex justify-center">
          <TagSearch />
        </div>
        <p className="mt-2 text-[13px] text-ink-3">
          No tag handy?{' '}
          <Link href="/player/DEMO" className="text-ink underline-offset-4 hover:underline">
            Open the demo profile
          </Link>
        </p>
      </section>

      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-panel p-6">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-raised text-ink-2">
              <f.icon size={16} aria-hidden />
            </span>
            <h2 className="mt-4 text-sm font-semibold">{f.title}</h2>
            <p className="mt-1.5 text-[13px] text-ink-3">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title={`Example: Archer Queen 97 → ${example.chain.to} at Town Hall 18`}
          description={`${example.chain.steps.length} upgrades of 8 days · ${(example.cost / 1e6).toFixed(1)}M Dark Elixir`}
        >
          <table className="w-full text-[13px]">
            <tbody>
              {example.rows.map((r, i) => (
                <tr key={r.label} className={i ? 'border-t border-line' : ''}>
                  <td className="w-[45%] py-2 pr-3 text-ink-2">{r.label}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2 shrink-0 rounded-r"
                        style={{ width: `calc((100% - 4.5rem) * ${r.time / max})`, background: i === 0 ? 'var(--series-muted)' : 'var(--series-1)' }}
                      />
                      <span className="tnum whitespace-nowrap text-ink">{formatDuration(r.time)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-3">
            Hammer Jam here is a 15-day event starting today at 50% off: only upgrades that start inside it are discounted. Gold Pass at 20%.
          </p>
        </Panel>

        <Panel title="Add defenses, walls and live timers" description="The official API leaves buildings out. The game can export them.">
          <ol className="space-y-2.5 text-[13px]">
            {['Open Settings in Clash of Clans', 'Tap More Settings', 'Scroll to Data Export and tap Copy', 'Paste it into the Upgrade Tracker'].map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-raised text-xs text-ink-2">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <Link href="/tracker" className={buttonClass('secondary', 'md', 'mt-5')}>
            <FileUp size={16} aria-hidden /> Open Upgrade Tracker
          </Link>
        </Panel>
      </section>
    </div>
  );
}
