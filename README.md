# Dokkandle Team Builder

Team building tools for Dragon Ball Z Dokkan Battle, served at **builder.dokkandle.net**. It replaces the
tools from dokkantools.com, which is no longer updated.

- **Unit browser**: search, filter by category (any or all of several), rarity, class, type and F2P or premium,
  and sort by leader boost, release date, cost, HP, ATK or DEF. As in the game, the release sort counts a card's
  EZA and Super EZA dates, and transformed forms are listed right after their base card.
- **Unit details**: stats, base or EZA skills, transformations, linking partners, the units it boosts as
  leader, and the best leaders for it. On wide screens the details open over the unit list.
- **Team tools**: a shared-links graph, rotation pairs (the best ones, which you can rearrange by dragging one unit
  onto another), leaders that boost every member, and what each member would do as leader. Drag units into the
  team, between members to reorder, or out to remove them.
- **Battlefield**: plan 16 teams where each card is used once, with leader and friend boosts marked on every card.
  As in the game, an alt art can share a team with its original there.
  Drag units onto any slot, between slots and teams to move or swap them, or off the board to remove them.

Cards use the game's own frames, type and rarity icons and LR lightning, taken from DokkanDaily. Passives use the
game's icons for effects that activate once or last for the rest of battle, taken from DokkanStats.

Everything runs in the browser. There is no backend; favorites, the team and the Battlefield plan are kept in
`localStorage`.

## Development

Needs Node 22.18 or newer (the data script runs TypeScript directly).

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # Vitest, covers src/core
npm run build      # type check + production build into dist/
```

## Updating the character data

Data comes from [DokkanWebScraper](../DokkanWebScraper), which reads DokkanStats, and premium or F2P comes
from Dokkan Info.

```bash
# in ../DokkanWebScraper
npm run run:dokkanstats

# here: look up premium/F2P for cards that aren't in data/obtainment.json yet (needs curl)
npm run obtainment

# here: reads the newest yyyyMMddDokkanCharacterData.json, or pass a path
npm run data
npm run data -- ../DokkanWebScraper/data/20261109DokkanCharacterData.json
```

`npm run data` writes `public/data/units.json` and copies any new thumbnails into `public/images/thumbs/`.
Both are committed, so the deploy doesn't need to scrape. Commit them and push to `main` to publish.

`npm run obtainment` saves what Dokkan Info says about each card in `data/obtainment.json`, which is also
committed, so later runs only look up new cards (about a second each). Cards on a summon banner are premium.
Dokkan Info lists no banner for some cards; alt-art cards take their original's value, and the rest count as
F2P. Those cards are checked again on every run, and `--all` refreshes everything.

DokkanStats rate-limits busy scrapes, and a card that still fails after its retries is skipped with only a
warning. If the scrape log has any `Skipping DokkanStats` lines, run it again more gently:
`DOKKANSTATS_CONCURRENCY=2 DOKKANSTATS_MAX_RETRIES=10 npm run run:dokkanstats`.

## Leader skills

`src/core/leader.ts` turns leader skill text into targets and boosts. It reads Category, Type, Class and
all-Type leaders, the "plus an additional…" bonus, `; or` clauses and `(… characters excluded)` notes. Anything
with a condition (HP thresholds, team requirements, per-Ki-Sphere boosts, enemy debuffs) is skipped rather than
guessed at, so those leaders show no boost. A unit's boost is the average of its HP, ATK and DEF bonuses, plus
any bonus it qualifies for. The EZA leader skill is used when a unit has one.

## Layout

- `src/core/` holds the data model and all team logic as plain TypeScript with no Vue imports, tested with Vitest.
- `src/ui/` is the Vue app. `store.ts` holds state and saving; components only render it.
- `scripts/build-data.ts` turns scraper output into `public/data/units.json`; `scripts/update-obtainment.ts`
  keeps `data/obtainment.json` up to date.

## Deploying (Cloudflare Pages)

Cloudflare Pages builds and publishes every push to `main` through its GitHub integration. Project settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm test && npm run build` |
| Build output directory | `dist` |
| Node version | read from `.node-version` |

The custom domain is a subdomain whose DNS stays at GoDaddy:

1. In the Pages project, open **Custom domains** and add `builder.dokkandle.net` first. Creating the DNS record
   before this step leaves the domain failing to resolve.
2. At GoDaddy, add a CNAME record: `builder` → `<project>.pages.dev`.

Use a Pages project rather than a Worker: Workers custom domains need the whole domain on Cloudflare DNS.
