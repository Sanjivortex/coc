# CoC Stats

Clash of Clans progress tracker and upgrade planner: enter a player tag to see heroes, pets,
equipment, troops, spells and siege machines with the max for that Town Hall, and how long it takes
to max everything, with builders, Gold Pass, Builder's Apprentice, Lab Assistant, potions, books,
hammers and Hammer Jam taken into account. Paste the in-game village export to add defenses, traps,
walls, supercharges, crafted defenses and running upgrade timers.

Pages:

| Route | What it shows |
| --- | --- |
| `/` | Player or clan tag search |
| `/player/[tag]` | Profile from the official API, progress per hero/pet/troop, time to max, planner |
| `/tracker` | Paste the village export → every building, running timers, full time to max |
| `/clan/[tag]` | Clan info and member list |
| `/api/player/[tag]` | JSON proxy to the official API (the key stays on the server) |
| `/player/DEMO`, `/clan/DEMO` | Sample data, works without an API key |

## Setup

Requires Node.js 20.9+.

```bash
npm install
cp .env.example .env.local   # then fill in COC_API_TOKEN
npm run dev                  # http://localhost:3000
```

### API key

1. Sign in at <https://developer.clashofclans.com> and create a key.
2. Keys only work from the IP addresses you list on the key:
   - **Your own server/VPS** with a fixed IP: add that IP and set `COC_API_TOKEN`.
   - **Vercel/Netlify** (changing IPs): create the key for `45.79.218.79` and set
     `COC_API_BASE=https://cocproxy.royaleapi.dev/v1` to go through RoyaleAPI's proxy.
   - **Local development**: add your home IP (`curl ifconfig.me`).
3. Without a key, `/player/DEMO`, `/clan/DEMO` and the Upgrade Tracker still work.

Player and clan responses are cached for 5 minutes (`'use cache'` in `src/lib/coc-api.ts`).

## Deploy on a VPS with Caddy

1. DNS: add an `A` record for the subdomain (e.g. `coc`) pointing to the VPS IP.
2. Create the API key on developer.clashofclans.com with the VPS IP.
3. On the VPS (Ubuntu/Debian, as root):

   ```bash
   # Look first: lists the sites Caddy serves, ports in use and DNS. Changes nothing.
   curl -fsSL https://raw.githubusercontent.com/Sanjivortex/coc/main/deploy/setup-vps.sh | sudo bash -s -- --check coc.test-hub.xyz
   # Install, or update later with the same command:
   curl -fsSL https://raw.githubusercontent.com/Sanjivortex/coc/main/deploy/setup-vps.sh | sudo bash -s -- coc.test-hub.xyz
   ```

[`deploy/setup-vps.sh`](deploy/setup-vps.sh) installs Node.js 22 privately in `/opt/coc-node` (other
apps keep their Node), clones the repo to `/opt/coc` as a `coc` system user, asks for the API token
once (checks it directly and through the RoyaleAPI proxy, then writes `.env.local`), builds, runs the
app as the `coc` systemd service on the first free port from 3900 (localhost only), and appends one
site block to `/etc/caddy/Caddyfile` after a backup. If `caddy validate` fails, the original
Caddyfile is put back. Caddy then gets the HTTPS certificate on its own.

Logs: `journalctl -u coc -f`. If the build gets killed on a 1 GB VPS, add swap and run it again.

### Telegram builder alerts

A Telegram message 10 minutes before a home-village builder is free, for one account:

1. In Telegram, message **@BotFather**, send `/newbot` and copy the token.
2. Run the deploy command above. It asks for the bot token and your player tag, waits for you to
   send `/start` to the bot, saves `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` and `ALERT_PLAYER_TAG`
   in `.env.local`, sends a test message and starts the `coc-alerts` service.
3. Every time you start an upgrade, copy the export again and either paste it in the bot's chat
   (Telegram splits it into several messages of up to 4096 characters; the bot joins them), send it
   as a `.json`/`.txt` file, or paste it on `/tracker`, which sends it to `POST /api/alerts`. Only the
   `ALERT_PLAYER_TAG` account is accepted. The export is saved to `.data/alerts.json` and
   [`scripts/telegram-alerts.mjs`](scripts/telegram-alerts.mjs) picks it up.
4. For each new export the bot asks with buttons which boost is running (Builder Potion, Builder
   Bite, both, none), then the time left for each (1h…6h for potions, 15m…3h for bites, the
   export's potion time, or a typed time like `2h 41m`). `/boost` asks again; typed replies such as
   `potion 2h 41m bite 45m` or `no` work at any time. Without an answer it uses
   `boosts.builder_boost` from the export. The export's timers are the time left at normal speed;
   builders work 10× with a Builder Potion, 2× with a Builder Bite and 11× with both, counted from
   the export's time until the end you gave. `/status` lists the finish times.

Optional: `ALERT_LEAD_MINUTES` (default 10), `ALERT_TIMEZONE` (default `Asia/Kolkata`).
Logs: `journalctl -u coc-alerts -f`. Preview the alert times for an export without sending anything:
`node scripts/telegram-alerts.mjs --plan export.json`.

## Where the data comes from

- **Official API** (`GET /v1/players/{tag}`): heroes, hero equipment, pets, troops, spells, siege
  machines, builder base units, trophies, clan, achievements. It does **not** include buildings,
  traps, walls or timers.
- **In-game export** (Settings → More Settings → Data Export → Copy): JSON with every building,
  trap, wall, unit, hero, pet and equipment level, helper levels and the seconds left on running
  upgrades. Parsed in `src/lib/village.ts`; stays in the browser's localStorage.
- **Game data** (upgrade time, cost and Town Hall requirement per level, building counts per Town
  Hall): the [`clash-of-clans-data`](https://www.npmjs.com/package/clash-of-clans-data) package
  (from the Clash of Clans Wiki), compacted into `src/data/gamedata.json`, with images resized into
  `public/game/`. After a game update:

  ```bash
  npm update clash-of-clans-data && npm run gamedata
  ```

## How "time to max" is calculated

`src/lib/planner.ts` turns the village into upgrade chains (each building instance, hero, troop… is
a sequence of levels that must be done in order) and simulates three queues:

- **Builders** (N in parallel, default 6): buildings, traps, heroes, TH weapon, guardians, crafted
  defense modules, supercharges. When a builder frees up it takes the chain with the most work left,
  which keeps all builders busy until the end.
- **Laboratory** (1): troops, spells, siege machines. **Pet House** (1): pets.
- Walls cost resources only (no timer); hero equipment costs ore only.

Boosts:

| Boost | Model |
| --- | --- |
| Gold Pass | −10/15/20% time and cost on builder and lab upgrades (not pets) |
| Builder Potion | builders work 10× for 1 hour (≈ 9 h saved per busy builder) |
| Research / Pet Potion | lab / pet house 24× for 1 hour (≈ 23 h) |
| Builder's Apprentice / Lab Assistant | level L = L hours extra progress, once per day, on the longest running upgrade |
| Hammer | skips one level for free (goes to the longest, then most expensive, step) |
| Book | finishes a running upgrade (time only, cost still paid) |
| Hammer Jam | upgrades **started** between the event's start and end dates cost and take 50% (configurable); potions are spent at the event start |

Example (unit-tested): Archer Queen 97 → 110 at TH18 is 13 upgrades × 8 days = **104 days** and
5.6M Dark Elixir; 83.2 days with a 20% Gold Pass; 88 days with a 15-day Hammer Jam starting today
(four upgrades start inside the event); 52 days if every upgrade got the Hammer Jam price.

The **Hammer Jam** tab plans the event itself: enter its start and end, Gold Pass, potions, builders
(plus a Goblin Builder) and which builder the Apprentice helps, then give every builder one thing to
work on (a hero, every copy of a building, or "auto"). Each builder starts the next level as soon as
the last one is done, and the tab shows the level each one reaches with every upgrade it starts
before the event ends, next to what the same builders would reach without the event.

These are estimates: the simulation does not model resource income or building prerequisites inside
the same Town Hall (e.g. Laboratory level before troop levels).

## Scripts

```bash
npm run dev       # development server
npm run build     # production build
npm start         # serve the build
npm test          # planner, parser and formatting tests (vitest)
npm run lint
npm run gamedata  # rebuild src/data/gamedata.json and public/game/ from clash-of-clans-data
```

## Roadmap ideas

- History tracking (trophies, donations, war stars over time) with a database and a cron job, like
  ClashOfStats/Clash-Track: store player snapshots every few hours.
- Clan war, war log and CWL pages (`/clans/{tag}/currentwar`, `/warlog`, `/currentwar/leaguegroup`).
- Leaderboards (`/locations/{id}/rankings/players`).
- Accounts/login to sync tracked villages across devices.

---

This material is unofficial and is not endorsed by Supercell. For more information see Supercell's
[Fan Content Policy](https://www.supercell.com/fan-content-policy).
