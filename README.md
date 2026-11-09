# Dokkandle Team Builder

Team building tools for Dragon Ball Z Dokkan Battle, served at **builder.dokkandle.net**. It replaces the
tools from dokkantools.com, which is no longer updated.

- **Unit browser**: search, filter by category (any or all of several), rarity, class and type, and sort by
  leader boost, release date, cost, HP, ATK or DEF.
- **Unit details**: stats, base or EZA skills, transformations, linking partners, the units it boosts as
  leader, and the best leaders for it.
- **Team tools**: a shared-links graph, leaders that boost every member, and what each member would do as leader.
- **Battlefield**: plan 16 teams where each card is used once, with leader and friend boosts marked on every card.

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

Data comes from [DokkanWebScraper](../DokkanWebScraper), which reads DokkanStats.

```bash
# in ../DokkanWebScraper
npm run run:dokkanstats

# here: reads the newest yyyyMMddDokkanCharacterData.json, or pass a path
npm run data
npm run data -- ../DokkanWebScraper/data/20261109DokkanCharacterData.json
```

`npm run data` writes `public/data/units.json` and copies any new thumbnails into `public/images/thumbs/`.
Both are committed, so the deploy doesn't need to scrape. Commit them and push to `main` to publish.

## Leader skills

`src/core/leader.ts` turns leader skill text into targets and boosts. It reads Category, Type, Class and
all-Type leaders, the "plus an additional…" bonus, `; or` clauses and `(… characters excluded)` notes. Anything
with a condition (HP thresholds, team requirements, per-Ki-Sphere boosts, enemy debuffs) is skipped rather than
guessed at, so those leaders show no boost. A unit's boost is the average of its HP, ATK and DEF bonuses, plus
any bonus it qualifies for. The EZA leader skill is used when a unit has one.

## Layout

- `src/core/` holds the data model and all team logic as plain TypeScript with no Vue imports, tested with Vitest.
- `src/ui/` is the Vue app. `store.ts` holds state and saving; components only render it.
- `scripts/build-data.ts` turns scraper output into `public/data/units.json`.

## Deploying (GitHub Pages + custom domain)

`.github/workflows/deploy.yml` tests, builds and publishes `dist/` on every push to `main`.

1. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
2. At the DNS host for dokkandle.net (GoDaddy), add a CNAME record: `builder` → `<owner>.github.io`, where
   `<owner>` is the user or organization that owns this repository.
3. In **Settings → Pages**, set the custom domain to `builder.dokkandle.net` and turn on **Enforce HTTPS** once
   the certificate is issued. `public/CNAME` already holds the domain.
4. Verify `dokkandle.net` under your account or organization's **Settings → Pages → Verified domains** so no other
   repository can claim the subdomain.
