// Saves what every link skill does at level 10 in data/links.json, from DokkanStats' link list.
//   npm run links
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { linkSkillFromDokkanStats } from '../src/core/links.ts';
import type { DokkanStatsLink } from '../src/core/links.ts';
import type { LinkSkill } from '../src/core/types.ts';
import { linksPath } from './scraper-files.ts';

const LINKS_URL = 'https://dokkanstats.com/api/data/en/links';

const response = await fetch(LINKS_URL, { headers: { Accept: 'application/json', 'User-Agent': 'dokkan-team-builder' } });
if (!response.ok) throw new Error(`DokkanStats link list request failed (${response.status}).`);
const list = (await response.json()) as DokkanStatsLink[];
if (!Array.isArray(list) || list.length === 0) throw new Error(`${LINKS_URL} returned no links.`);

const links: Record<string, LinkSkill> = {};
for (const entry of [...list].sort((a, b) => a.name.localeCompare(b.name))) {
  const { skill, unknownFields } = linkSkillFromDokkanStats(entry);
  if (unknownFields.length > 0) console.warn(`${entry.name}: left out stats this site doesn't know yet: ${unknownFields.join(', ')}`);
  links[entry.name] = skill;
}

mkdirSync(dirname(linksPath), { recursive: true });
writeFileSync(linksPath, `${JSON.stringify(links, null, 2)}\n`);
console.log(`Saved ${list.length} links to ${linksPath}.`);
