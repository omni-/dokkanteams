// Builds public/data/units.json and public/images/thumbs from a DokkanWebScraper character file.
//   npm run data -- [path/to/yyyyMMddDokkanCharacterData.json]
// With no path it uses the newest dated file in ../DokkanWebScraper/data. Premium/F2P comes from
// data/obtainment.json and link effects from data/links.json, which `npm run obtainment` and
// `npm run links` keep up to date.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { buildDataset, resolveObtain } from '../src/core/dataset.ts';
import type { ScrapedCharacter } from '../src/core/dataset.ts';
import { newestScrape, readLinks, readObtainment, root } from './scraper-files.ts';

const inputPath = process.argv[2] ? resolve(process.argv[2]) : newestScrape();
const thumbSource = join(dirname(inputPath), 'images', 'thumbs');
const dataTarget = join(root, 'public', 'data', 'units.json');
const thumbTarget = join(root, 'public', 'images', 'thumbs');

const characters = JSON.parse(readFileSync(inputPath, 'utf8')) as ScrapedCharacter[];
if (!Array.isArray(characters) || characters.length === 0) {
  throw new Error(`${inputPath} has no characters.`);
}

const obtain = resolveObtain(characters, readObtainment());
const links = readLinks();
const { dataset, skipped } = buildDataset(characters, basename(inputPath), { obtain, links });
for (const reason of skipped) console.warn(`Skipped ${reason}`);

const unknownLinks = [...new Set(dataset.units.flatMap(unit => unit.links))].filter(link => !links[link]).sort();
if (unknownLinks.length > 0) {
  console.warn(`${unknownLinks.length} links have no effects in data/links.json; run npm run links first: ${unknownLinks.join(', ')}`);
}

const unclassified = dataset.units.filter(unit => unit.formOf == null && unit.obtain == null).map(unit => unit.id);
if (unclassified.length > 0) {
  console.warn(`${unclassified.length} cards aren't marked premium or F2P; run npm run obtainment first: ${unclassified.join(', ')}`);
}

mkdirSync(dirname(dataTarget), { recursive: true });
writeFileSync(dataTarget, JSON.stringify(dataset));

mkdirSync(thumbTarget, { recursive: true });
const missingThumbs: number[] = [];
let copied = 0;
for (const unit of dataset.units) {
  const source = join(thumbSource, `${unit.id}.png`);
  const target = join(thumbTarget, `${unit.id}.png`);
  if (!existsSync(source)) {
    missingThumbs.push(unit.id);
    continue;
  }
  if (!existsSync(target)) {
    copyFileSync(source, target);
    copied++;
  }
}
if (missingThumbs.length > 0) console.warn(`No thumb for ${missingThumbs.length} units: ${missingThumbs.join(', ')}`);

const forms = dataset.units.filter(unit => unit.formOf != null).length;
const leaders = dataset.units.filter(unit => unit.leader).length;
console.log(
  `Wrote ${dataset.units.length} units (${forms} transformed forms, ${leaders} parsed leader skills) from ${basename(inputPath)}; `
  + `copied ${copied} new thumbs.`,
);
