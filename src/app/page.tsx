import Image from 'next/image';
import Link from 'next/link';
import { TagSearch } from '@/components/TagSearch';
import { GAME_DATA_SOURCE, MAX_TH } from '@/lib/gamedata';

const features = [
  {
    icon: '/game/home/heroes/archer-queen/icon.webp',
    title: 'Live profile',
    text: 'Heroes, pets, equipment, troops, spells and siege machines straight from the official Clash of Clans API.',
  },
  {
    icon: '/game/home/defenses/inferno-tower/normal/level-12.webp',
    title: 'Full village',
    text: 'Paste the in-game export to add every defense, trap, wall, supercharge and running upgrade timer.',
  },
  {
    icon: '/game/magic-items/potions/builder-potion.webp',
    title: 'Time to max',
    text: 'Days left per hero and for the whole Town Hall – with builders, Gold Pass, potions, books, hammers and Hammer Jam.',
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-10 py-6">
      <section className="flex w-full flex-col items-center gap-5 text-center">
        <p className="rounded-full border border-line px-3 py-1 text-xs text-muted">Updated for Town Hall {MAX_TH}</p>
        <h1 className="font-display text-4xl leading-tight tracking-wide sm:text-5xl">
          How far are you from <span className="text-accent">max</span>?
        </h1>
        <p className="max-w-2xl text-muted">
          Enter a player tag to see current levels, the max for your Town Hall, and how long every upgrade will take – with or
          without builder potions and Hammer Jam.
        </p>
        <TagSearch />
        <p className="text-sm text-muted">
          No tag handy?{' '}
          <Link href="/player/DEMO" className="text-accent underline-offset-4 hover:underline">
            Open the demo profile
          </Link>
        </p>
      </section>

      <section className="grid w-full gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card flex gap-4 p-5">
            <Image src={f.icon} alt="" width={56} height={56} className="h-14 w-14 shrink-0 object-contain" />
            <div>
              <h2 className="font-display text-xl tracking-wide">{f.title}</h2>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="card w-full p-6">
        <h2 className="font-display text-2xl tracking-wide">Want defenses and walls too?</h2>
        <p className="mt-2 text-sm text-muted">
          The official API only shares heroes, troops, spells, pets and equipment. For buildings, copy your village from the game:
        </p>
        <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
          {['Open Settings ⚙️', 'Tap “More Settings”', 'Scroll to “Data Export”', 'Tap “Copy”, then paste it in the Upgrade Tracker'].map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <span className="font-display grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <Link href="/tracker" className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:brightness-110">
          Open Upgrade Tracker
        </Link>
      </section>
      <p className="text-xs text-muted">Upgrade data: {GAME_DATA_SOURCE}</p>
    </div>
  );
}
